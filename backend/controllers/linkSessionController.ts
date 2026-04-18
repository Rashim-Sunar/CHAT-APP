/**
 * ----------------------------------------------------------------------------
 * linkSessionController
 * ----------------------------------------------------------------------------
 * Purpose:
 * Handles secure device-linking sessions for E2EE account access across devices.
 *
 * Device linking in this system:
 * A newly authenticated device (without local private key material) requests
 * approval from an already trusted device. The trusted device encrypts key
 * material with the new device's temporary public key and sends it through the
 * backend as opaque ciphertext.
 *
 * Why this controller exists:
 * In multi-device E2EE, authentication alone is not enough. A device also needs
 * local cryptographic material to decrypt messages. This controller orchestrates
 * approval, relay, and expiry while keeping the server zero-knowledge.
 *
 * Security model:
 * - Server stores/relays only public keys and encrypted payloads.
 * - Private keys are never stored or handled in plaintext server-side.
 * - Sessions are short-lived and one-time to reduce replay and stale-session risk.
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import type { Response } from 'express';
import LinkSession from '../models/linkSessionModel.js';
import type {
  CreateLinkSessionDto,
  LinkSessionCompleteDto,
  LinkSessionRespondDto,
} from '../types/dtos/linkSession.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import { emitToUserDevices } from '../socket/socket.js';

const LINK_SESSION_TTL_MS = 2 * 60 * 1000;

// Helper keeps expiration checks consistent for all endpoints that touch a session.
const isSessionExpired = (expiresAt: Date): boolean => expiresAt.getTime() <= Date.now();

/**
 * Marks a pending/approved session as expired when TTL has elapsed.
 *
 * Why this exists:
 * TTL index cleanup in MongoDB is asynchronous; a record can still be present
 * shortly after expiry. We enforce expiry at read/write time to guarantee that
 * stale sessions cannot be approved, completed, or queried as active.
 */
const updateExpiredSessionIfNeeded = async (
  sessionId: string,
  expiresAt: Date,
  currentStatus: string
): Promise<boolean> => {
  if (!isSessionExpired(expiresAt) || currentStatus === 'expired') {
    return false;
  }

  await LinkSession.findOneAndUpdate({ sessionId }, { status: 'expired' });
  return true;
};

// Uses forwarded header first (proxy-aware), then socket fallback.
const getClientIp = (forwardedFor: string | string[] | undefined, fallback?: string): string => {
  const forwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || '').split(',')[0]?.trim();

  return forwarded || fallback || 'unknown';
};

/**
 * Minimal structural guard for JWK-like temporary public keys.
 *
 * We only enforce basic shape here (presence of `kty`) because crypto import
 * validation remains the client responsibility. The backend intentionally stays
 * protocol-agnostic and relay-focused to preserve zero-knowledge boundaries.
 */
const isValidJwkLike = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;

  const jwk = value as Record<string, unknown>;
  return typeof jwk.kty === 'string';
};

/**
 * Creates a new device-linking session.
 *
 * Called by:
 * A newly authenticated device that lacks local E2EE private key material.
 *
 * Input:
 * - `tempPublicKey`: ephemeral public key generated on requesting device.
 * - optional device metadata for user awareness/auditing.
 *
 * Output:
 * - `sessionId`, `pending` status, and expiry timestamp.
 *
 * Security significance:
 * - Temporary key ensures only the requesting device can decrypt transferred secrets.
 * - Server stores no plaintext secret and only relays encrypted continuation data.
 */
export const createLinkSession = async (
  req: AuthenticatedRequest<unknown, unknown, CreateLinkSessionDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { tempPublicKey, deviceInfo } = req.body;

    // Auth guard: linking is only valid for an authenticated account owner.
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    // Reject malformed key material early; prevents unusable/poisoned sessions.
    if (!isValidJwkLike(tempPublicKey)) {
      res.status(400).json({
        status: 'fail',
        message: 'tempPublicKey is required and must be a JWK object',
      });
      return;
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + LINK_SESSION_TTL_MS);

    // Session starts in `pending` until an existing trusted device explicitly responds.
    await LinkSession.create({
      sessionId,
      userId,
      tempPublicKey,
      status: 'pending',
      expiresAt,
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        platform: deviceInfo?.platform,
        browser: deviceInfo?.browser,
        ip: getClientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress),
      },
    });

    // Notify already-linked devices in real time. This surfaces unexpected login
    // attempts to the user and requires an explicit approval action.
    emitToUserDevices(String(userId), 'link_request', {
      sessionId,
      requestedAt: new Date().toISOString(),
      deviceInfo: {
        userAgent: req.headers['user-agent'],
        platform: deviceInfo?.platform,
        browser: deviceInfo?.browser,
        label: deviceInfo?.label,
      },
      expiresAt: expiresAt.toISOString(),
    });

    // New device is authenticated but remains E2EE-gated until approval completes.
    res.status(201).json({
      status: 'success',
      data: {
        sessionId,
        status: 'pending',
        expiresAt,
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in createLinkSession',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * Approves or rejects a pending link session.
 *
 * Called by:
 * An existing trusted device after user confirmation.
 *
 * Input:
 * - `sessionId`
 * - `action`: `approve` or `reject`
 *
 * Output:
 * - Updated session status.
 *
 * Security significance:
 * - Enforces explicit user consent before key transfer can proceed.
 * - Prevents unauthorized device activation from password-only login attempts.
 */
export const respondToLinkSession = async (
  req: AuthenticatedRequest<unknown, unknown, LinkSessionRespondDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { sessionId, action } = req.body;

    // Edge case: invalid auth context or forged request.
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'fail', message: 'Unauthorized' });
      return;
    }

    // Strict action allowlist avoids ambiguous state transitions.
    if (!sessionId || (action !== 'approve' && action !== 'reject')) {
      res.status(400).json({
        status: 'fail',
        message: 'sessionId and action(approve|reject) are required',
      });
      return;
    }

    const session = await LinkSession.findOne({ sessionId, userId });

    if (!session) {
      res.status(404).json({ status: 'fail', message: 'Link session not found' });
      return;
    }

    // Edge case: stale session still present in DB before TTL cleanup executes.
    if (await updateExpiredSessionIfNeeded(sessionId, session.expiresAt, session.status)) {
      res.status(410).json({ status: 'fail', message: 'Link session expired' });
      return;
    }

    // Idempotency/abuse guard: only pending sessions may transition.
    if (session.status !== 'pending') {
      res.status(409).json({
        status: 'fail',
        message: `Link session already ${session.status}`,
      });
      return;
    }

    // State transition: pending -> approved|rejected
    session.status = action === 'approve' ? 'approved' : 'rejected';
    session.approvedAt = action === 'approve' ? new Date() : undefined;

    await session.save();

    // Notify all devices so pending requester can react immediately in UI.
    emitToUserDevices(String(userId), 'link_session_updated', {
      sessionId,
      status: session.status,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      status: 'success',
      data: {
        sessionId,
        status: session.status,
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in respondToLinkSession',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * Returns details for a single link session, including temporary public key.
 *
 * Called by:
 * Trusted device after approval to retrieve requester temporary key and perform
 * client-side encryption of transfer secret.
 *
 * Security significance:
 * - Server returns only public/metadata fields required for relay flow.
 * - No private key material is ever fetched or stored here.
 */
export const getLinkSession = async (
  req: AuthenticatedRequest<{ sessionId: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { sessionId } = req.params;

    // Edge case: access without valid authenticated user context.
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'fail', message: 'Unauthorized' });
      return;
    }

    const session = await LinkSession.findOne({ sessionId, userId });

    if (!session) {
      res.status(404).json({ status: 'fail', message: 'Link session not found' });
      return;
    }

    // Expired sessions cannot be used to encrypt or complete transfer.
    if (await updateExpiredSessionIfNeeded(sessionId, session.expiresAt, session.status)) {
      res.status(410).json({ status: 'fail', message: 'Link session expired' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        sessionId,
        tempPublicKey: session.tempPublicKey,
        status: session.status,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error: unknown) {
    console.log('Error in getLinkSession', error instanceof Error ? error.message : String(error));
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * Returns lightweight status for polling pending requester device.
 *
 * Called by:
 * Device waiting for approval to update local gate state (pending/rejected/expired).
 *
 * Security significance:
 * - Keeps polling response minimal (status + expiry only).
 * - Avoids exposing unnecessary session internals.
 */
export const getLinkSessionStatus = async (
  req: AuthenticatedRequest<{ sessionId: string }>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { sessionId } = req.params;

    // Unauthorized callers must not observe session state.
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'fail', message: 'Unauthorized' });
      return;
    }

    // Query only fields needed for status poll to minimize data exposure.
    const session = await LinkSession.findOne({ sessionId, userId }).select('sessionId status expiresAt');

    if (!session) {
      res.status(404).json({ status: 'fail', message: 'Link session not found' });
      return;
    }

    // Return terminal expired state even if document has not been TTL-removed yet.
    if (await updateExpiredSessionIfNeeded(sessionId, session.expiresAt, session.status)) {
      res.status(200).json({
        status: 'success',
        data: {
          sessionId,
          status: 'expired',
          expiresAt: session.expiresAt,
        },
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        sessionId,
        status: session.status,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in getLinkSessionStatus',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

/**
 * Completes a previously approved link session by relaying encrypted secret.
 *
 * Called by:
 * Trusted device after encrypting transfer payload with requester's temporary key.
 *
 * Input:
 * - `sessionId`
 * - `encryptedSecret` envelope (ciphertext + wrapped AES key + IV)
 *
 * Output:
 * - Success response and real-time relay to requester device.
 *
 * Security significance:
 * - Server relays opaque encrypted data only.
 * - One-time completion semantics block replay/reuse of session IDs.
 */
export const completeLinkSession = async (
  req: AuthenticatedRequest<unknown, unknown, LinkSessionCompleteDto>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { sessionId, encryptedSecret } = req.body;

    // Unauthorized access guard.
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'fail', message: 'Unauthorized' });
      return;
    }

    // Payload integrity guard: all envelope parts are required for client decryption.
    if (
      !sessionId ||
      !encryptedSecret ||
      !encryptedSecret.encryptedPayload ||
      !encryptedSecret.encryptedAesKey ||
      !encryptedSecret.iv
    ) {
      res.status(400).json({
        status: 'fail',
        message: 'sessionId and encryptedSecret payload are required',
      });
      return;
    }

    const session = await LinkSession.findOne({ sessionId, userId });

    // Edge case: invalid or already-cleaned session identifier.
    if (!session) {
      res.status(404).json({ status: 'fail', message: 'Link session not found' });
      return;
    }

    // Expired sessions are terminal and cannot carry key transfer.
    if (await updateExpiredSessionIfNeeded(sessionId, session.expiresAt, session.status)) {
      res.status(410).json({ status: 'fail', message: 'Link session expired' });
      return;
    }

    // Enforce approval gate so secret transfer cannot bypass user confirmation.
    if (session.status !== 'approved') {
      res.status(409).json({
        status: 'fail',
        message: 'Link session must be approved before completion',
      });
      return;
    }

    // Replay guard: completed sessions are single-use by design.
    if (session.usedAt) {
      res.status(409).json({
        status: 'fail',
        message: 'Link session already used',
      });
      return;
    }

    // Mark as used before relay to make completion idempotent under retries/races.
    session.usedAt = new Date();
    await session.save();

    // Relay encrypted payload as opaque data to the requesting device.
    // Server never receives plaintext key material and cannot decrypt ciphertext.
    emitToUserDevices(String(userId), 'link_secret_ready', {
      sessionId,
      encryptedSecret,
    });

    // One-time use: remove completed session to prevent replay attempts.
    await LinkSession.deleteOne({ sessionId });

    res.status(200).json({
      status: 'success',
      data: {
        sessionId,
        status: 'approved',
      },
    });
  } catch (error: unknown) {
    console.log(
      'Error in completeLinkSession',
      error instanceof Error ? error.message : String(error)
    );
    res.status(500).json({ status: 'fail', message: 'Internal server error' });
  }
};

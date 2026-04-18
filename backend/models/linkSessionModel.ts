/**
 * -----------------------------------------------------------------------------
 * Link Session Model
 * -----------------------------------------------------------------------------
 * Stores short-lived device-linking sessions used to recover E2EE continuity on
 * newly authenticated devices.
 *
 * In this flow, a new device submits a temporary public key and waits for an
 * existing trusted device to approve and send encrypted key material. The
 * backend persists only session metadata plus the temporary public key and never
 * stores private keys or plaintext secrets.
 */
import mongoose, { Schema, type Document } from 'mongoose';

// Explicit lifecycle states for secure, one-time linking progression.
export type LinkSessionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Optional request metadata for risk visibility and audit context.
export interface LinkSessionDeviceInfo {
  userAgent?: string;
  platform?: string;
  browser?: string;
  ip?: string;
}

// Canonical persisted shape for a device-linking session record.
export interface ILinkSession {
  // Public session identifier exchanged between devices and API endpoints.
  sessionId: string;
  // Owner of the link session; sessions are always scoped to one authenticated user.
  userId: mongoose.Types.ObjectId;
  // Ephemeral public key (JWK-like) from the requesting device.
  tempPublicKey: Record<string, unknown>;
  // Workflow state: pending -> approved/rejected -> expired/deleted.
  status: LinkSessionStatus;
  createdAt: Date;
  // Hard deadline after which session is invalid even if still present in DB.
  expiresAt: Date;
  // Set when an existing trusted device approves the request.
  approvedAt?: Date;
  // Set after encrypted secret relay to enforce one-time session usage.
  usedAt?: Date;
  deviceInfo?: LinkSessionDeviceInfo;
}

export interface ILinkSessionDocument extends ILinkSession, Document {}

const linkSessionSchema = new Schema<ILinkSession>(
  {
    // Random, unguessable ID used by clients when polling/responding.
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Reference to account owner so sessions cannot cross user boundaries.
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },
    // Temporary public key from the new device. Existing devices encrypt the
    // transfer secret with this key so only the requesting device can decrypt it.
    tempPublicKey: {
      type: Schema.Types.Mixed,
      required: true,
    },
    // Session lifecycle:
    // pending -> approved/rejected -> expired/deleted.
    // Sessions are one-time and short-lived to reduce replay risk.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    // TTL anchor and server-side policy deadline for request validity.
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Approval timestamp supports audits and response-latency analysis.
    approvedAt: {
      type: Date,
    },
    // Completion marker prevents replay or accidental double-complete races.
    usedAt: {
      type: Date,
    },
    // Best-effort client/environment fingerprint for user awareness.
    deviceInfo: {
      type: {
        userAgent: String,
        platform: String,
        browser: String,
        ip: String,
      },
      required: false,
    },
  },
  {
    // Mongoose-managed createdAt/updatedAt improve traceability and incident review.
    timestamps: true,
  }
);

// TTL cleanup runs asynchronously in MongoDB; controllers still enforce expiry
// at runtime so stale documents cannot be used during cleanup lag.
linkSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LinkSession = mongoose.model<ILinkSession>('linkSession', linkSessionSchema);

export default LinkSession;

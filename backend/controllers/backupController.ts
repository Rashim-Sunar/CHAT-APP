// ----------------------------------------
// @file   backupController.ts
// @desc   Stores and serves encrypted private-key backup blobs (zero-knowledge)
// ----------------------------------------

import type { Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import type { AuthenticatedRequest } from '../types/express/index.js';

interface EnableBackupBody {
  cipher?: string;
  salt?: string;
  iv?: string;
}

/**
 * Persists the user's encrypted private-key backup envelope.
 * Called only after client-side encryption, so plaintext keys and password
 * never reach the server and zero-knowledge constraints remain intact.
 */
export const enableEncryptedBackup = async (
  req: AuthenticatedRequest<unknown, unknown, EnableBackupBody>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;
    const { cipher, salt, iv } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    if (!cipher || !salt || !iv) {
      res.status(400).json({
        status: 'fail',
        message: 'cipher, salt and iv are required',
      });
      return;
    }

    const existingUser = await User.findById(userId).select('backupEnabled');
    if (!existingUser) {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
      return;
    }

    if (existingUser.backupEnabled) {
      res.status(409).json({
        status: 'fail',
        message: 'Encrypted backup is already enabled',
      });
      return;
    }

    await User.findByIdAndUpdate(
      userId,
      {
        encryptedPrivateKey: cipher,
        backupSalt: salt,
        backupIv: iv,
        backupEnabled: true,
        backupUpdatedAt: new Date(),
      },
      { new: false, runValidators: false }
    );

    res.status(200).json({
      status: 'success',
      message: 'Encrypted key backup enabled',
    });
  } catch (error: unknown) {
    console.log(
      'Error in enableEncryptedBackup',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * Returns encrypted backup metadata for client-side recovery.
 * The payload is opaque ciphertext plus KDF/AES parameters so only the
 * browser can attempt password-based decryption on the requesting device.
 */
export const getEncryptedBackup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized',
      });
      return;
    }

    const user = await User.findById(userId).select(
      'backupEnabled encryptedPrivateKey backupSalt backupIv backupUpdatedAt'
    );

    if (!user) {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      backupEnabled: Boolean(user.backupEnabled),
      encryptedPrivateKey: user.encryptedPrivateKey || null,
      salt: user.backupSalt || null,
      iv: user.backupIv || null,
      backupUpdatedAt: user.backupUpdatedAt || null,
    });
  } catch (error: unknown) {
    console.log(
      'Error in getEncryptedBackup',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

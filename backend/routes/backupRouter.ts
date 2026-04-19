// ----------------------------------------
// @file   backupRouter.ts
// @desc   Routes for encrypted private-key backup setup and restore fetch
// ----------------------------------------

import express from 'express';
import protectRoute from '../middlewares/protectRoute.js';
import { enableEncryptedBackup, getEncryptedBackup } from '../controllers/backupController.js';
import { backupFetchLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// ----------------------------------------
// @desc    Enables encrypted key backup for authenticated user
// @route   POST /api/backup/enable
// @access  Private
// ----------------------------------------
router.post('/enable', protectRoute, enableEncryptedBackup);

// ----------------------------------------
// @desc    Returns encrypted backup payload for client-side restore
// @route   GET /api/backup
// @access  Private
// ----------------------------------------
router.get('/', protectRoute, backupFetchLimiter, getEncryptedBackup);

export default router;

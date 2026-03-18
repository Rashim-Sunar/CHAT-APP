// ----------------------------------------
// @file   messageRouter.ts
// @desc   Defines messaging-related routes (send & retrieve messages)
// ----------------------------------------

import express from 'express';
import protectRoute from '../middlewares/protectRoute.js';

import { sendMessage, getMessage } from '../controllers/messageController.js';

const router = express.Router();

// ----------------------------------------
// @desc    Retrieves messages between logged-in user and another user
// @route   GET /api/messages/:id
// @access  Private
// ----------------------------------------
router.get('/:id', protectRoute, getMessage);

// ----------------------------------------
// @desc    Sends a message to a specific user
// @route   POST /api/messages/send/:id
// @access  Private
// ----------------------------------------
router.post('/send/:id', protectRoute, sendMessage);

export default router;
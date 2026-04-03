// ----------------------------------------
// @file   messageRouter.ts
// @desc   Defines messaging-related routes (send & retrieve messages)
// ----------------------------------------

import express from 'express';
import protectRoute from '../middlewares/protectRoute.js';

import {
	sendMessage,
	getMessage,
	createUploadSignature,
	createFileDeliveryUrl,
} from '../controllers/messageController.js';

const router = express.Router();

// ----------------------------------------
// @desc    Retrieves messages between logged-in user and another user
// @route   GET /api/messages/:id
// @access  Private
// ----------------------------------------
router.get('/:id', protectRoute, getMessage);

// ----------------------------------------
// @desc    Creates a signed Cloudinary upload payload
// @route   POST /api/messages/upload-signature
// @access  Private
// ----------------------------------------
router.post('/upload-signature', protectRoute, createUploadSignature);

// Signed delivery is only requested for restricted assets when the public CDN
// URL cannot be opened directly (for example, raw assets marked blocked in the console).
router.post('/file-delivery-url', protectRoute, createFileDeliveryUrl);

// ----------------------------------------
// @desc    Sends a message to a specific user
// @route   POST /api/messages/send/:id
// @access  Private
// ----------------------------------------
router.post('/send/:id', protectRoute, sendMessage);

export default router;
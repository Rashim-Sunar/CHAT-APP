// ----------------------------------------
// @file   messageRouter.ts
// @desc   Defines messaging-related routes (send & retrieve messages)
// ----------------------------------------

import express from 'express';

import {
	sendMessage,
	getMessage,
	createUploadSignature,
	createFileDeliveryUrl,
	editMessage,
	deleteMessage,
	reactToMessage,
	pinMessage,
	unpinMessage,
} from '../controllers/messageController.js';

const router = express.Router();

// ----------------------------------------
// @desc    Retrieves messages between logged-in user and another user
// @route   GET /api/messages/:id
// @access  Private
// ----------------------------------------
router.get('/:id', getMessage);

// ----------------------------------------
// @desc    Creates a signed Cloudinary upload payload
// @route   POST /api/messages/upload-signature
// @access  Private
// ----------------------------------------
router.post('/upload-signature', createUploadSignature);

// Signed delivery is only requested for restricted assets when the public CDN
// URL cannot be opened directly (for example, raw assets marked blocked in the console).
router.post('/file-delivery-url', createFileDeliveryUrl);

// ----------------------------------------
// @desc    Sends a message to a specific user
// @route   POST /api/messages/send/:id
// @access  Private
// ----------------------------------------
router.post('/send/:id', sendMessage);

// ----------------------------------------
// @desc    Edits a message
// @route   PUT /api/messages/:id
// @access  Private
// ----------------------------------------
router.put('/:id', editMessage);

// ----------------------------------------
// @desc    Deletes a message for self or everyone
// @route   DELETE /api/messages/:id
// @access  Private
// ----------------------------------------
router.delete('/:id', deleteMessage);

// ----------------------------------------
// @desc    Adds, replaces, or removes the requester's reaction on a message
// @route   POST /api/messages/:id/react
// @access  Private
// ----------------------------------------
router.post('/:id/react', reactToMessage);

// ----------------------------------------
// @desc    Pins/unpins a message — any current conversation participant may
// @route   POST/DELETE /api/messages/:id/pin
// @access  Private
// ----------------------------------------
router.post('/:id/pin', pinMessage);
router.delete('/:id/pin', unpinMessage);

export default router;
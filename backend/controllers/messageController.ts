// ----------------------------------------
// @file   messageController.ts
// @desc   Handles messaging functionality (send & retrieve messages)
// ----------------------------------------

import type { Response } from 'express';
import Conversation, { ConversationDocument } from '../models/conversationModel.js';
import Message, { MessageDocument } from '../models/messageModel.js';
import { getReceiverSocketId, io } from '../socket/socket.js';
import type { AuthenticatedRequest } from '../types/express/index.js';
import type { SendMessageDto } from '../types/dtos/message.js';

/**
 * @desc    Sends a message between users and updates conversation
 * @route   POST /api/messages/:id
 * @access  Private
 * @param   req.params.id - receiver user ID
 * @param   req.body.message - message content
 * @returns JSON response with created message
 */
export const sendMessage = async (
  req: AuthenticatedRequest<{ id: string }, unknown, SendMessageDto>,
  res: Response
): Promise<void> => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user;
    const { message } = req.body;

    // Find existing conversation between sender and receiver
    let conversation = (await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    })) as ConversationDocument | null;

    // Create new conversation if not exists
    if (!conversation) {
      conversation = (await Conversation.create({
        participants: [senderId, receiverId],
      })) as ConversationDocument;
    }

    // Create new message document
    const newMessage = new Message({
      senderId,
      receiverId,
      message,
    });

    // Link message to conversation
    conversation.messages.push(newMessage._id);

    // Save both message and conversation concurrently
    await Promise.all([newMessage.save(), conversation.save()]);

    const messageWithTimestamps = newMessage as unknown as MessageDocument & {
      createdAt: Date;
      updatedAt: Date;
    };

    const realtimeMessagePayload = {
      _id: String(newMessage._id),
      senderId: String(newMessage.senderId),
      receiverId: String(newMessage.receiverId),
      conversationId: String(conversation._id),
      message: newMessage.message,
      createdAt: messageWithTimestamps.createdAt,
      updatedAt: messageWithTimestamps.updatedAt,
    };

    // Emit real-time message to receiver if online
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('newMessage', realtimeMessagePayload);
    }

    res.status(201).json({ newMessage: realtimeMessagePayload });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Some error occured in message controller',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).send({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Retrieves all messages between authenticated user and another user
 * @route   GET /api/messages/:id
 * @access  Private
 * @param   req.params.id - user to chat with
 * @returns Array of messages
 */
export const getMessage = async (
  req: AuthenticatedRequest<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user;

    // Fetch conversation and populate message documents
    const conversation = (await Conversation.findOne({
      participants: { $all: [senderId, userToChatId] },
    }).populate('messages')) as ConversationDocument | null;

    // Return empty array if no conversation exists
    if (!conversation) {
      res.status(200).json([]);
      return;
    }

    const messages = conversation.messages;

    res.status(200).json(messages);
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Error in getMessages controller: ',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({ error: 'Internal server error' });
  }
};
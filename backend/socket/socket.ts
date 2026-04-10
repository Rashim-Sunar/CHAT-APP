// ----------------------------------------
// @file   socket.ts
// @desc   Initializes Socket.IO server for real-time communication
// ----------------------------------------

import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import { recordConversationSeen } from '../Utils/readReceipt.js';

const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

// Create HTTP server instance for Socket.IO integration
const server = http.createServer(app);

// Initialize Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: clientOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Maps userId to active socketId for real-time communication
type UserSocketMap = Record<string, string>;
const userSocketMap: UserSocketMap = {}; // { userId: socketId }

/**
 * @desc    Returns socketId of a connected user
 * @param   receiverId - user ID of message recipient
 * @returns socketId if user is online, otherwise undefined
 */
export const getReceiverSocketId = (receiverId: string): string | undefined => {
  return userSocketMap[receiverId];
};

// ----------------------------------------
// Socket Connection Handling
// ----------------------------------------
io.on('connection', (socket) => {
  console.log('A new user connected with id: ', socket.id);

  // Extract userId from handshake query (sent from client during connection)
  const userId = String(socket.handshake.query.userId || '');

  // Store mapping only if valid userId is provided
  if (userId && userId !== 'undefined') {
    userSocketMap[userId] = socket.id;
  }

  // Broadcast updated list of online users to all clients
  io.emit('getOnlineUsers', Object.keys(userSocketMap));

  // Handle user disconnect
  socket.on('conversation:seen', async (payload: { conversationId: string; readerId: string }) => {
    try {
      const receipt = await recordConversationSeen(payload.conversationId, payload.readerId);
      if (!receipt) return;

      const recipientSocketId = getReceiverSocketId(receipt.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('conversation:seen', receipt);
      }
    } catch (error) {
      console.log(
        'Error in conversation:seen handler',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.id);

    // Remove user from active socket map
    if (userId) delete userSocketMap[userId];

    // Broadcast updated online users list
    io.emit('getOnlineUsers', Object.keys(userSocketMap));
  });
});

export { app, io, server };
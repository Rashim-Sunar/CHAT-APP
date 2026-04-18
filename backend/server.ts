// ----------------------------------------
// @file   server.ts
// @desc   Entry point of the application - sets up server, middleware, routes, and DB connection
// ----------------------------------------

// import path from 'path';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import authRouter from './routes/authRouter.js';
import messageRouter from './routes/messageRouter.js';
import userRouter from './routes/userRouter.js';
import linkSessionRouter from './routes/linkSessionRouter.js';
import connectToDB from './db/connectdb.js';
import cookieParser from 'cookie-parser';
import { app, server } from './socket/socket.js';
import { authLimiter, messageLimiter, apiLimiter } from './middlewares/rateLimiter.js';

// Load environment variables from .env file
dotenv.config();

// Resolve application port (default: 8000)
const port = process.env.PORT ? Number(process.env.PORT) : 8000;
const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ----------------------------------------
// Middleware Configuration
// ----------------------------------------

// Parse incoming JSON requests
app.use(express.json());

// Render terminates TLS at a proxy, so trust the first proxy hop for secure cookies.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Parse cookies from request headers
app.use(cookieParser());

// ----------------------------------------
// API Routes  (rate limiters applied per tier)
// ----------------------------------------
app.use('/api/auth/', authLimiter, authRouter);
app.use('/api/messages/', messageLimiter, messageRouter);
app.use('/api/users/', apiLimiter, userRouter);
app.use('/api/user/', apiLimiter, userRouter);
app.use('/api/link-session/', apiLimiter, linkSessionRouter);

// ----------------------------------------
// Server Initialization
// ----------------------------------------
server.listen(port, () => {
  // Establish database connection on server start
  connectToDB();

  console.log('Server listening on port:', port);
});

// ----------------------------------------
// Global Server Error Handling
// ----------------------------------------
server.on('error', (err) => {
  console.log('Internal server occured:', err);
});
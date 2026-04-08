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
import connectToDB from './db/connectdb.js';
import cookieParser from 'cookie-parser';
import { app, server } from './socket/socket.js';
import { authLimiter, messageLimiter, apiLimiter } from './middlewares/rateLimiter.js';

// const __dirname = path.resolve();

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

// ----------------------------------------
// Static File Serving (Frontend Build)
// ----------------------------------------
// app.use(express.static(path.join(__dirname, '/frontend/dist')));

// Fallback route for SPA (React/Vite/etc.)
// app.get('*', (req: Request, res: Response) => {
//   res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
// });

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
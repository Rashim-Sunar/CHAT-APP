// ----------------------------------------
// @file   generateToken.ts
// @desc   Generates JWT token and attaches it to response as HTTP-only cookie
// ----------------------------------------

import jwt from 'jsonwebtoken';
import type { Response } from 'express';

/**
 * @desc    Generates JWT for authenticated user and sets it in cookie
 * @param   userId - unique identifier of the user
 * @param   res - Express response object
 * @returns void
 */
const generateWebTokenAndSetCookie = (userId: string, res: Response): void => {
  // Sign JWT token with userId payload and expiration
  const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: '15d',
  });

  // Set token in HTTP-only cookie for secure client storage
  res.cookie('jwt', token, {
    maxAge: 15 * 24 * 60 * 60 * 1000, // Cookie expiration time (15 days)

    httpOnly: true, // Prevents access via client-side JS (XSS protection)

    // sameSite: 'strict', // Mitigates CSRF attacks
    sameSite: 'none', // Allows cross-site cookies for frontend-backend communication

    // Ensures cookie is sent only over HTTPS in production
    secure: process.env.NODE_ENV === 'production',
  });
};

export default generateWebTokenAndSetCookie;
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
  const isProduction = process.env.NODE_ENV === 'production';

  // Sign JWT token with userId payload and expiration
  const token = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: '15d',
  });

  // Set token in HTTP-only cookie for secure client storage
  res.cookie('jwt', token, {
    maxAge: 15 * 24 * 60 * 60 * 1000, // Cookie expiration time (15 days)

    httpOnly: true, // Prevents access via client-side JS (XSS protection)

    // In production, cross-site deployments need SameSite=None + Secure.
    // In local HTTP development, SameSite=None without Secure is rejected by browsers.
    sameSite: isProduction ? 'none' : 'lax',

    // Ensures cookie is sent only over HTTPS in production
    secure: isProduction,
  });
};

export default generateWebTokenAndSetCookie;
// ----------------------------------------
// @file   protectRoute.ts
// @desc   Middleware to protect routes using JWT authentication
// ----------------------------------------

import jwt from 'jsonwebtoken';
import { NextFunction, Response } from 'express';
import type { AuthenticatedRequest, JwtPayload } from '../types/express/index.js';

/**
 * @desc    Verifies JWT token from cookies and attaches user ID to request
 * @access  Private
 * @middleware
 */
const protectRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract JWT token from cookies
    const token = req.cookies?.jwt;

    // Reject request if token is missing
    if (!token) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized - No token provided!',
      });
      return;
    }

    // Verify token using secret key
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    // Validate decoded payload structure
    if (!decoded || !decoded.userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Unauthorized - Invalid token',
      });
      return;
    }

    // Attach authenticated user ID to request object
    req.user = decoded.userId;

    next();
  } catch (error: unknown) {
    // Log error for debugging (e.g., token expired or invalid)
    console.log(
      'Error occured in protectRoute',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

export default protectRoute;
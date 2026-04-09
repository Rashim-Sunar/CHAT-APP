// ----------------------------------------
// @file   index.d.ts
// @desc   Defines custom Express types and JWT payload structure
// ----------------------------------------

import { Request } from 'express';

/**
 * @desc    Structure of decoded JWT payload
 */
export interface JwtPayload {
  userId: string; // Unique identifier of authenticated user
}

/**
 * @desc    Extends Express Request to include authenticated user
 * @template P        Route params type
 * @template ResBody  Response body type
 * @template ReqBody  Request body type
 * @template ReqQuery Query params type
 */
export interface AuthenticatedRequest<
  // P = Record<string, any>,
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  // user?: string; // Populated after successful authentication
  user?: any; // User ID extracted from JWT token
}
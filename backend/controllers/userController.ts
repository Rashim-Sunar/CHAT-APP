// ----------------------------------------
// @file   userController.ts
// @desc   Handles user-related operations (e.g., fetching users for sidebar)
// ----------------------------------------

import type { Response } from 'express';
import User from '../models/userModel.js';
import type { AuthenticatedRequest } from '../types/express/index.js';

/**
 * @desc    Retrieves all users except the logged-in user (for sidebar display)
 * @route   GET /api/users
 * @access  Private
 * @returns JSON response with list of users
 */
export const getUsersForSidebar = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Extract authenticated user ID (attached via auth middleware)
    const loggedinUserId = req.user;

    // Fetch all users excluding the current logged-in user
    const filteredUsers = await User.find({ _id: { $ne: loggedinUserId } });

    res.status(200).json({
      status: 'success',
      users: filteredUsers.length,
      data: {
        users: filteredUsers,
      },
    });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Error in getUserForSidebar',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};
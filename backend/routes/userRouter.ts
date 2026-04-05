// ----------------------------------------
// @file   userRouter.ts
// @desc   Defines user-related routes (e.g., fetching users for sidebar)
// ----------------------------------------

import express from 'express';
import { getUserDetails, getUsersForSidebar } from '../controllers/userController.js';
import protectRoute from '../middlewares/protectRoute.js';

const router = express.Router();

// ----------------------------------------
// @desc    Retrieves all users except the logged-in user
// @route   GET /api/users
// @access  Private
// ----------------------------------------
router.get('/', protectRoute, getUsersForSidebar);

// ----------------------------------------
// @desc    Retrieves selected user details with shared media/links/documents
// @route   GET /api/users/:id/details
// @access  Private
// ----------------------------------------
router.get('/:id/details', protectRoute, getUserDetails);

export default router;
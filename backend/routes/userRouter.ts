// ----------------------------------------
// @file   userRouter.ts
// @desc   Defines user-related routes (e.g., fetching users for sidebar)
// ----------------------------------------

import express from 'express';
import {
  getUserDetails,
  getUsersForSidebar,
  updateUserName,
  getProfilePictureUploadSignature,
  saveProfilePictureUrl,
  deleteProfilePicture,
} from '../controllers/userController.js';
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

// ----------------------------------------
// @desc    Updates authenticated user's display name
// @route   PATCH /api/users/update-name
// @access  Private
// ----------------------------------------
router.patch('/update-name', protectRoute, updateUserName);

// ----------------------------------------
// @desc    Generates signed upload token for profile picture
// @route   POST /api/users/upload-profile-pic-signature
// @access  Private
// ----------------------------------------
router.post('/upload-profile-pic-signature', protectRoute, getProfilePictureUploadSignature);

// ----------------------------------------
// @desc    Saves uploaded profile picture URL to user document
// @route   POST /api/users/upload-profile-pic
// @access  Private
// ----------------------------------------
router.post('/upload-profile-pic', protectRoute, saveProfilePictureUrl);

// ----------------------------------------
// @desc    Deletes user's profile picture
// @route   DELETE /api/users/delete-profile-pic
// @access  Private
// ----------------------------------------
router.delete('/delete-profile-pic', protectRoute, deleteProfilePicture);

export default router;
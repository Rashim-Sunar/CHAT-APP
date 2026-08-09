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
  savePublicKey,
  getUserPublicKey,
  getUserPublicKeysBatch,
} from '../controllers/userController.js';

const router = express.Router();

// ----------------------------------------
// @desc    Retrieves all users except the logged-in user
// @route   GET /api/users
// @access  Private
// ----------------------------------------
router.get('/', getUsersForSidebar);

// Public key endpoint stores only the key that peers use to encrypt messages.
// The server never receives private keys and therefore cannot decrypt payloads.
router.post('/public-key', savePublicKey);

router.get('/:id/public-key', getUserPublicKey);

// Batch variant — used when resolving a group's full membership before
// encrypting an outgoing message.
router.post('/public-keys', getUserPublicKeysBatch);

// ----------------------------------------
// @desc    Retrieves selected user details with shared media/links/documents
// @route   GET /api/users/:id/details
// @access  Private
// ----------------------------------------
router.get('/:id/details', getUserDetails);

// ----------------------------------------
// @desc    Updates authenticated user's display name
// @route   PATCH /api/users/update-name
// @access  Private
// ----------------------------------------
router.patch('/update-name', updateUserName);

// ----------------------------------------
// @desc    Generates signed upload token for profile picture
// @route   POST /api/users/upload-profile-pic-signature
// @access  Private
// ----------------------------------------
router.post('/upload-profile-pic-signature', getProfilePictureUploadSignature);

// ----------------------------------------
// @desc    Saves uploaded profile picture URL to user document
// @route   POST /api/users/upload-profile-pic
// @access  Private
// ----------------------------------------
router.post('/upload-profile-pic', saveProfilePictureUrl);

// ----------------------------------------
// @desc    Deletes user's profile picture
// @route   DELETE /api/users/delete-profile-pic
// @access  Private
// ----------------------------------------
router.delete('/delete-profile-pic', deleteProfilePicture);

export default router;
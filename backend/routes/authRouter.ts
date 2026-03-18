// ----------------------------------------
// @file   authRouter.ts
// @desc   Defines authentication-related routes (login, signup, logout)
// ----------------------------------------

import express from 'express';
import { signUpUser, loginUser, logOutUser } from "../controllers/authController.js";

const router = express.Router();

// ----------------------------------------
// @desc    Handles user login
// @route   POST /api/auth/login
// @access  Public
// ----------------------------------------
router.post('/login', loginUser);

// ----------------------------------------
// @desc    Handles user registration
// @route   POST /api/auth/signup
// @access  Public
// ----------------------------------------
router.post('/signup', signUpUser);

// ----------------------------------------
// @desc    Handles user logout
// @route   POST /api/auth/logout
// @access  Private
// ----------------------------------------
router.post('/logout', logOutUser);

export default router;
// ----------------------------------------
// @file   authController.ts
// @desc   Handles user authentication (signup, login, logout)
// ----------------------------------------

import type { Request, Response } from 'express';
import User, { IUserDocument } from '../models/userModel.js';
import generateToken from '../Utils/generateToken.js';
import type { SignUpDto, LoginDto } from '../types/dtos/auth.js';

/**
 * @desc    Registers a new user
 * @route   POST /api/auth/signup
 * @access  Public
 * @param   req.body - user registration data
 * @returns JSON response with created user
 */
export const signUpUser = async (
  req: Request<unknown, unknown, SignUpDto>,
  res: Response
): Promise<void> => {
  try {
    const { password, confirmPassword } = req.body;

    // Validate password confirmation
    if (password !== confirmPassword) {
      res.status(400).json({
        status: 'fail',
        message: 'Password and confirmPassword not matching',
      });
      return;
    }

    // Assign default avatar based on gender if not provided
    if (!req.body.profilePic) {
      if (req.body.gender === 'male') {
        req.body.profilePic = `https://avatar.iran.liara.run/public/boy?username=${req.body.userName}`;
      } else {
        req.body.profilePic = `https://avatar.iran.liara.run/public/girl?username=${req.body.userName}`;
      }
    }

    // Create user in database
    const newUser = await User.create(req.body);

    // Generate JWT and attach to response (cookie/header)
    generateToken(newUser._id.toString(), res);

    res.status(200).json({
      status: 'success',
      data: {
        user: newUser,
      },
    });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Some error occured in signUpUser',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      messgae: 'Internal server error',
    });
  }
};

/**
 * @desc    Authenticates user and returns JWT
 * @route   POST /api/auth/login
 * @access  Public
 * @param   req.body - email and password
 * @returns JSON response with authenticated user
 */
export const loginUser = async (
  req: Request<unknown, unknown, LoginDto>,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Fetch user with password explicitly selected
    const user = (await User.findOne({ email }).select('+password')) as IUserDocument | null;

    // Validate user existence and password match
    if (!user || !(await user.comparePasswordInDB(password, user.password))) {
      res.status(400).json({
        status: 'fail',
        message: 'User with the email and password not found',
      });
      return;
    }

    // Generate JWT for authenticated user
    generateToken(user._id.toString(), res);

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Error occured in login user',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};

/**
 * @desc    Logs out user by clearing auth cookie
 * @route   POST /api/auth/logout
 * @access  Private
 * @returns Success message
 */
export const logOutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Clear JWT cookie
    res.cookie('jwt', '', { maxAge: 0 });

    res.status(200).json({
      status: 'success',
      message: 'User looged out successfully',
    });
  } catch (error: unknown) {
    // Log error for debugging
    console.log(
      'Error occured while logging out',
      error instanceof Error ? error.message : String(error)
    );

    res.status(500).json({
      status: 'fail',
      message: 'Internal server error',
    });
  }
};
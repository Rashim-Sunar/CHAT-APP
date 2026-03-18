// ----------------------------------------
// @file   auth.d.ts
// @desc   Defines DTOs for authentication requests
// ----------------------------------------

/**
 * @desc    Data required for user registration
 */
export interface SignUpDto {
  email: string;
  userName: string;
  password: string;
  confirmPassword: string; // Used for password confirmation validation
  gender: 'male' | 'female' | 'others';
  profilePic?: string; // Optional profile image URL
}

/**
 * @desc    Data required for user login
 */
export interface LoginDto {
  email: string;
  password: string;
}
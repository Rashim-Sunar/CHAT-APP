// ----------------------------------------
// @file   profile.d.ts
// @desc   Defines DTOs for profile update operations
// ----------------------------------------

/**
 * @desc    Data required to update user name
 */
export interface UpdateUserNameDto {
  userName: string;
}

/**
 * @desc    Response structure for profile operations
 */
export interface ProfileUpdateResponse {
  status: 'success' | 'fail';
  data?: {
    user: {
      _id: string;
      email: string;
      userName: string;
      gender: 'male' | 'female' | 'others';
      profilePic?: string;
      createdAt?: string;
      updatedAt?: string;
    };
  };
  message?: string;
}

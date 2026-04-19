// ----------------------------------------
// @file   userModel.ts
// @desc   Defines user schema and authentication-related methods
// ----------------------------------------

import mongoose, { Document } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';

export type Gender = 'male' | 'female' | 'others';

export interface IUser {
  email: string;
  userName: string;
  password: string;
  gender: Gender;
  profilePic?: string;
  publicKey?: Record<string, unknown>;
  encryptedPrivateKey?: string;
  backupSalt?: string;
  backupIv?: string;
  backupEnabled: boolean;
  backupUpdatedAt?: Date;
}

// Extends IUser with mongoose document and custom methods
export interface IUserDocument extends IUser, Document {
  comparePasswordInDB(pass: string, passInDB: string): Promise<boolean>;
}

// ----------------------------------------
// User Schema Definition
// ----------------------------------------
const userSchema = new mongoose.Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'EMail field is require'],
      unique: true,
      // Validates email format using validator library
      validate: [validator.isEmail, 'Please enter a valid email'],
    },
    userName: {
      type: String,
      minlength: [5, 'fullName must be atleast 5 characters'],
      required: true,
    },
    password: {
      type: String,
      required: [true, 'Password is reauired field'],
      minlength: [5, 'Password must contain atleast 5 characters'],
      // Excludes password from query results by default
      select: false,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'others'],
      required: true,
    },
    profilePic: {
      type: String,
    },
    // Only the public key is persisted server-side. The private key never leaves
    // the client, which keeps the server unable to decrypt E2EE messages.
    publicKey: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Encrypted backup blob for private key recovery; server stores ciphertext only.
    encryptedPrivateKey: {
      type: String,
      default: null,
    },
    // Random salt for PBKDF2 key derivation, base64 encoded.
    backupSalt: {
      type: String,
      default: null,
    },
    // AES-GCM IV used to encrypt private key backup, base64 encoded.
    backupIv: {
      type: String,
      default: null,
    },
    // Indicates whether user has opted into encrypted private-key backup.
    backupEnabled: {
      type: Boolean,
      default: false,
    },
    // Timestamp for latest backup rotation/update.
    backupUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

// ----------------------------------------
// Middleware: Hash password before saving
// ----------------------------------------
userSchema.pre('save', async function (next) {
  // Skip hashing if password is not modified
  if (!this.isModified('password')) return next();

  // Hash password with salt rounds = 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ----------------------------------------
// Instance Method: Compare passwords
// ----------------------------------------
userSchema.methods.comparePasswordInDB = async function (
  pass: string,
  passInDB: string
): Promise<boolean> {
  // Compares plain password with hashed password in DB
  return bcrypt.compare(pass, passInDB);
};

// Create and export User model
const User = mongoose.model('user', userSchema);

export default User;
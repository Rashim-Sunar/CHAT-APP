// ----------------------------------------
// @file   connectdb.ts
// @desc   Establishes connection to MongoDB using Mongoose
// ----------------------------------------

import mongoose from 'mongoose';

/**
 * @desc    Connects application to MongoDB database
 * @returns Promise<void>
 */
const connectToDB = async (): Promise<void> => {
  try {
    // Attempt to connect using URI from environment variables
    console.log('Connecting to Mongodb...', process.env.MONGO_DB_URI);

    await mongoose.connect(process.env.MONGO_DB_URI);

    console.log('Connected to mongodb successfully');
  } catch (error: unknown) {
    // Log connection errors for debugging
    console.log(
      'Error connecting to database',
      error instanceof Error ? error.message : String(error)
    );
  }
};

export default connectToDB;
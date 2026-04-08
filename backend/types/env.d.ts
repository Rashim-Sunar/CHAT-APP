// ----------------------------------------
// @file   env.d.ts
// @desc   Defines type-safe environment variables for the application
// ----------------------------------------

declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string; // Application port (optional, defaults can be handled in code)

    NODE_ENV?: "development" | "production" | "test"; // Current runtime environment
    CLIENT_URL?: string;
    CLIENT_ORIGINS?: string;

    JWT_SECRET: string; // Secret key used for signing and verifying JWT tokens

    MONGO_DB_URI: string; // MongoDB connection string

    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    MAX_UPLOAD_SIZE_BYTES?: string;
  }
}

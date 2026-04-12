# ChatApp
A real-time full-stack chat application built with the MERN stack, TypeScript, and Socket.io. It provides one-to-one messaging, file sharing, real-time updates, and session-based authentication with a modern React UI.

## Project Overview
ChatApp is designed for fast, reliable, real-time communication between authenticated users.

- One-to-one chat with live Socket.io updates
- Secure authentication backed by HTTP-only JWT cookies
- Message lifecycle support for send, edit, and delete
- Media support for images, videos, and files
- Read receipts, unread badges, and conversation previews
- User profile details with shared media, links, and documents

The app is suitable for messaging platforms, support tools, and collaborative communication workflows.

## Architecture Overview
This project uses a client-server architecture with a dedicated real-time socket layer.

| Layer | Responsibility |
| --- | --- |
| Frontend (React + TypeScript) | UI, routing, chat state, auth state, and socket listeners |
| Backend (Node.js + Express + TypeScript) | REST API, authentication, validation, and message persistence |
| Database (MongoDB) | Users, conversations, messages, and read-receipt metadata |
| Realtime (Socket.io) | Instant message delivery, edits, deletes, presence, and seen events |

## Features

### Authentication
- Signup, login, logout, and current-session verification
- JWT stored in an HTTP-only cookie for safer session handling
- Frontend session hydration from `localStorage` with `/api/auth/me` validation on load
- Automatic clearing of local auth state on `401 Unauthorized`
- Protected routes on both the frontend and backend

### Real-Time Chat
- Instant message delivery through Socket.io
- Online user presence updates
- Socket-driven sync for new messages, message edits, deletions, and seen receipts
- Conversation state keyed per chat to avoid duplicate renders during socket + HTTP races

### Message Management
- Text, image, video, and file messages
- Edit text messages after sending
- Delete messages for me or for everyone
- Soft-delete tracking so each participant sees the correct message state
- Deleted messages are removed from the conversation preview and user view as appropriate

### Media Upload and Delivery
- Direct-to-Cloudinary upload flow using a backend-signed upload signature
- Backend-side validation for MIME type, file name, and file size
- Signed delivery URLs for restricted assets when a public CDN URL is not enough
- Upload support for common chat media and document formats

### Conversation and Sidebar UX
- Conversation list with last-message preview and unread counts
- Read receipts and seen timestamps
- User details panel with shared media, links, and documents
- Mobile-friendly conversation navigation

### Reliability and Error Handling
- `401` responses clear stale local auth state and trigger session revalidation
- `400`, `403`, `404`, and `500` responses are handled with clear backend errors
- Route-level rate limiting for auth, message, and user endpoints

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- DaisyUI
- Zustand
- Socket.io Client
- Framer Motion
- React Hot Toast

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB with Mongoose
- Socket.io
- JWT
- bcryptjs
- Cloudinary
- express-rate-limit

## Installation & Setup

### 1) Clone the repository
```bash
git clone https://github.com/Rashim-Sunar/CHAT-APP.git
cd CHAT-APP
```

### 2) Install dependencies
```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3) Configure environment variables
Create the required `.env` files before running either app.

### 4) Run in development
Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

The frontend dev server uses a local Vite proxy for `/api` requests. In production, use the real backend URL instead of the proxy.

### Production setup
Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
```

For production, set `VITE_API_BASE_URL` to the deployed backend URL and do not rely on the Vite proxy.

## Environment Variables

### Backend `.env`
```env
PORT=8000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
CLIENT_ORIGINS=http://localhost:3000
JWT_SECRET=your-jwt-secret
MONGO_DB_URI=your-mongodb-connection-string
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
MAX_UPLOAD_SIZE_BYTES=15728640
```

Notes:
- `CLIENT_ORIGINS` can contain a comma-separated list of allowed frontend origins.
- `CLIENT_URL` is still supported for compatibility with local development.
- `MAX_UPLOAD_SIZE_BYTES` is optional. If omitted, the app uses the built-in default upload limit.

### Frontend `.env.local`
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_SOCKET_URL=http://localhost:8000
```

### Frontend production example
```env
VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
VITE_SOCKET_URL=https://your-backend-url.onrender.com
```

Notes:
- `VITE_API_BASE_URL` is required by the frontend API wrapper.
- `VITE_SOCKET_URL` is optional. If omitted, the socket connection is derived from `VITE_API_BASE_URL`.
- The Vite proxy in `frontend/vite.config.ts` is development-only.

## Deployment

This project is deployed on Render.

Recommended Render setup:

1. Create a Render Web Service for the backend.
2. Set the backend environment variables listed above.
3. Build the backend with `npm run build` and start it with `npm start`.
4. Deploy the frontend as a separate static site or host it on your preferred frontend platform.
5. Set the frontend `VITE_API_BASE_URL` to the Render backend URL.
6. Add the deployed frontend origin to `CLIENT_ORIGINS` so cookies and CORS work correctly.

Important production notes:
- The backend trusts the first proxy hop so secure cookies work correctly behind Render.
- JWT cookies are configured with production-safe cookie settings.
- If the frontend and backend are on different domains, `credentials: include` must remain enabled in API calls.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - register a new user
- `POST /api/auth/login` - log in a user
- `POST /api/auth/logout` - clear the session cookie
- `GET /api/auth/me` - return the current authenticated user

### Users
- `GET /api/users` - fetch sidebar users and conversation summaries
- `GET /api/users/:id/details` - fetch a user profile with shared media, links, and documents

### Messages
- `GET /api/messages/:id` - fetch messages between the current user and another user
- `POST /api/messages/send/:id` - send a new message
- `PUT /api/messages/:id` - edit a text message
- `DELETE /api/messages/:id` - delete a message for me or for everyone
- `POST /api/messages/upload-signature` - request a Cloudinary upload signature
- `POST /api/messages/file-delivery-url` - request a signed delivery URL for restricted files

Example delete payload:
```json
{
	"type": "everyone"
}
```

## Folder Structure
```text
CHAT_APP/
├── backend/
│   ├── controllers/
│   ├── db/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   ├── types/
│   └── Utils/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── config/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── Utils/
│   │   ├── types/
│   │   └── zustand/
│   ├── public/
│   └── vite.config.ts
└── README.md
```

## Known Issues / Troubleshooting

- If production API calls fail, confirm that `VITE_API_BASE_URL` points to the deployed backend and includes `/api`.
- If login appears to work but the app immediately signs out, check that the frontend origin is listed in `CLIENT_ORIGINS` and that cookies are allowed by the browser.
- If socket updates do not arrive in production, verify that `VITE_SOCKET_URL` is correct or that the backend origin can be derived from `VITE_API_BASE_URL`.
- If media uploads fail, confirm the Cloudinary variables are set and the file is within the configured size limit.
- If the app keeps returning `401 Unauthorized`, clear the `chat-user` item from `localStorage` and sign in again.
- The Vite proxy only applies during local development. It is not used after building the frontend for production.

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

## Author
Rashim Sunar<br/>
MERN Stack Developer
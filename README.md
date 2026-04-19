# ChatApp

A production-minded real-time chat application built with the MERN stack, TypeScript, and Socket.io.

## What This Project Demonstrates

This codebase demonstrates engineering depth across security, realtime architecture, and production readiness.

- Strong end-to-end encryption design with key isolation and zero-knowledge server patterns
- Secure multi-device key continuity through device linking and encrypted key backup
- Practical system design with REST + WebSocket coordination, state reconciliation, and rate limiting
- Production concerns including strict TypeScript, CORS/cookie hardening, error handling, and deploy-ready env setup
- Real user workflows covering messaging lifecycle, media delivery, read receipts, profile, and conversation UX

## Documentation Index

- [E2EE Overview](E2EE.README.md)
- [E2EE Device Linking and Login Gating](E2EE-DEVICE-LINKING.README.md)
- [E2EE Encrypted Key Backup and Recovery](E2EE-BACKUP.README.md)

## Security Highlights (Key Strength)

### 1. End-to-End Encryption (E2EE)
- Hybrid encryption model:
  - RSA-OAEP for key wrapping
  - AES-GCM for message payload confidentiality + integrity
- Server stores encrypted fields as opaque payloads and never decrypts message content.
- Private keys are kept client-side only (IndexedDB), not persisted on backend.

### 2. Encryption-Ready Login Gating
- Authentication is not enough to access chat data.
- App enforces two states:
  - Authenticated session
  - Local private-key availability
- If private key is missing, chat remains gated until key recovery succeeds.

### 3. Secure Device Linking
- New device creates ephemeral temporary RSA key pair.
- Existing trusted device explicitly approves request.
- Trusted device encrypts transfer secret client-side and relays encrypted payload only.
- Server coordinates sessions and sockets but never sees plaintext key material.

### 4. Encrypted Private-Key Backup (Optional)
- One-time user opt-in backup with local password.
- Password-derived key via PBKDF2 (SHA-256, high iteration count).
- Private key encrypted with AES-GCM before upload.
- Server stores only encrypted blob + salt + IV.
- Recovery/decryption runs fully on client; password never sent to backend.

### 5. Defensive API Hardening
- HTTP-only JWT cookies for session auth.
- Route-level rate limiting (auth/message/api + backup restore fetch).
- Structured error responses and explicit unauthorized handling.

## Core Feature Set

### Authentication and Session
- Signup/login/logout/current-user endpoints
- Cookie-based auth with client revalidation
- Auto-reset local auth state on unauthorized responses

### Real-Time Messaging
- One-to-one chat with Socket.io
- Instant delivery and online presence
- Socket + HTTP reconciliation to avoid duplicate/stale state

### Message Lifecycle
- Send text and media messages
- Edit text messages
- Delete for self and delete for everyone
- Read receipts and unread counters

### Media and Files
- Direct-to-Cloudinary upload with backend-signed parameters
- MIME/type/size validation on client and server
- Signed delivery URL support for protected delivery paths

### Conversation UX
- Sidebar previews with unread counts
- Seen indicators and last-message metadata
- Shared media/links/documents in details panel
- Mobile-friendly conversation behavior

## Architecture

| Layer | Responsibility |
| --- | --- |
| Frontend (React + TypeScript) | UI, routing, local auth/session state, E2EE crypto, socket event handling |
| Backend (Node + Express + TypeScript) | API, auth/session validation, persistence, rate limiting, link-session orchestration |
| MongoDB | Users, conversations, messages, link session metadata |
| Socket.io | Presence, message events, link-session events, realtime sync |

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS + DaisyUI
- Zustand
- Socket.io Client
- Framer Motion
- React Hot Toast

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- Socket.io
- JWT
- bcryptjs
- Cloudinary
- express-rate-limit

## API Surface (High-Level)

### Auth
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Users
- GET /api/users
- GET /api/users/:id/details
- POST /api/users/public-key
- GET /api/users/:id/public-key

### Messages
- GET /api/messages/:id
- POST /api/messages/send/:id
- PUT /api/messages/:id
- DELETE /api/messages/:id
- POST /api/messages/upload-signature
- POST /api/messages/file-delivery-url

### Device Linking
- POST /api/link-session/create
- POST /api/link-session/respond
- POST /api/link-session/complete
- GET /api/link-session/status/:sessionId
- GET /api/link-session/:sessionId

### E2EE Backup
- POST /api/backup/enable
- GET /api/backup

## Local Setup

### 1) Clone
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

Backend .env
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

Frontend .env.local
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_SOCKET_URL=http://localhost:8000
```

### 4) Run in development

Backend
```bash
cd backend
npm run dev
```

Frontend
```bash
cd frontend
npm run dev
```

### 5) Production build

Backend
```bash
cd backend
npm run build
npm start
```

Frontend
```bash
cd frontend
npm run build
```

## Deployment Notes

- Designed for split frontend/backend deployment.
- Render-friendly backend setup with proxy-aware cookie behavior.
- For cross-domain frontend/backend:
  - keep credentials enabled on client fetch
  - ensure frontend origin is included in CLIENT_ORIGINS

## Repository Structure

```text
CHAT_APP/
|- backend/
|  |- controllers/
|  |- db/
|  |- middlewares/
|  |- models/
|  |- routes/
|  |- socket/
|  |- types/
|  |- Utils/
|- frontend/
|  |- src/
|  |  |- components/
|  |  |- config/
|  |  |- context/
|  |  |- hooks/
|  |  |- pages/
|  |  |- Utils/
|  |  |- types/
|  |  |- zustand/
|  |- public/
|- E2EE.README.md
|- E2EE-DEVICE-LINKING.README.md
|- E2EE-BACKUP.README.md
|- README.md
```

## Author

Rashim Sunar  
MERN Stack Developer

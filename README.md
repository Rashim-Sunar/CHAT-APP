# ChatApp

A production-minded real-time chat application built with the MERN stack, TypeScript, and Socket.io.

## What This Project Demonstrates

This codebase demonstrates engineering depth across security, realtime architecture, and production readiness.

- Strong end-to-end encryption design with key isolation and zero-knowledge server patterns
- Secure multi-device key continuity through device linking and encrypted key backup
- Practical system design with REST + WebSocket coordination, state reconciliation, and rate limiting
- Production concerns including strict TypeScript, CORS/cookie hardening, error handling, and deploy-ready env setup
- Full CI/CD pipeline: automated quality gates on every push, monorepo-aware path filtering, and Continuous Delivery to Render via deploy hooks with a GitHub Environment approval gate
- Real user workflows covering messaging lifecycle, media delivery, read receipts, profile, and conversation UX

## Documentation Index

- [E2EE Overview](E2EE.README.md)
- [E2EE Device Linking and Login Gating](E2EE-DEVICE-LINKING.README.md)
- [E2EE Encrypted Key Backup and Recovery](E2EE-BACKUP.README.md)
- [Docker Usage](DOCKER.README.md)
- [CI/CD Pipeline](#cicd-pipeline)

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

- Designed for split frontend/backend deployment (backend Web Service + frontend Static Site / Web Service on Render).
- Render-friendly backend setup with proxy-aware cookie behavior.
- For cross-domain frontend/backend:
  - keep credentials enabled on client fetch
  - ensure frontend origin is included in CLIENT_ORIGINS
- Deployments are driven by the CD pipeline — no manual dashboard clicks required after initial service setup.

## CI/CD Pipeline

The project ships a two-workflow GitHub Actions pipeline:

### CI (`ci.yml`) — runs on every push and pull request to `master`

| Job | What it does |
|---|---|
| Detect Changes | Path-filters the diff so only affected services run downstream jobs |
| Frontend / Lint | `npm run lint` via ESLint |
| Frontend / Build | `tsc` + `vite build` — catches type errors and bundle failures |
| Backend / Build | `tsc` compile — catches type errors before deploy |
| Backend / Security Audit | `npm audit --audit-level=high` — flags high-severity CVEs |
| PR Report | Posts a structured check summary as a PR comment (auto-updates on re-push) |

All jobs are path-filtered: a frontend-only change skips all backend jobs and vice versa.
The `concurrency` block cancels stale in-progress runs when a new push arrives on the same branch.

### CD (`cd.yml`) — runs on push to `master` only

Continuous Delivery (not raw auto-deploy): every production deploy requires a one-click approval from a designated reviewer before it goes live.

```
git push master
      │
      ▼
  CI workflow — lint / build / audit
      │
      ▼
  CD workflow — detects which service changed
  ├── deploy-backend  ──► ⏸  Awaiting approval (GitHub Environment: production)
  └── deploy-frontend ──► ⏸  Awaiting approval (GitHub Environment: production)
            │  (reviewer clicks ✅ Approve)
            ▼
      POST Render Deploy Hook URL
            │
            ▼
      Render rebuilds + redeploys service ✅
```

**Key design decisions:**

- **Deploy hooks over registry push** — Render rebuilds directly from the repo; no Docker registry credentials are stored in GitHub.
- **GitHub Environment protection** — the `production` environment requires a named reviewer, providing an explicit change-management gate before any code reaches users.
- **Monorepo path filtering** — `cd.yml` detects which service changed using the same git-diff approach as CI, so a frontend-only commit never triggers a backend redeploy and vice versa.
- **`cancel-in-progress` concurrency** — rapid successive pushes cancel the previous CD run, preventing stale deploys from racing ahead.
- **Job summaries** — each deploy job writes a structured summary (commit SHA, author, timestamp) to the GitHub Actions run for audit-trail observability.

**Secrets required (GitHub → Settings → Secrets → Actions):**

| Secret | Value |
|---|---|
| `RENDER_BACKEND_DEPLOY_HOOK_URL` | Deploy hook URL from the Render backend service |
| `RENDER_FRONTEND_DEPLOY_HOOK_URL` | Deploy hook URL from the Render frontend service |

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
|  |- Dockerfile
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
|  |- Dockerfile
|  |- nginx.conf
|- .github/
|  |- workflows/
|  |  |- ci.yml         # Lint, build, audit — runs on every push + PR
|  |  |- cd.yml         # Continuous Delivery to Render via deploy hooks
|- docker-compose.yml
|- docker-compose.prod.yml
|- E2EE.README.md
|- E2EE-DEVICE-LINKING.README.md
|- E2EE-BACKUP.README.md
|- DOCKER.README.md
|- README.md
```

## Author

Rashim Sunar  
MERN Stack Developer

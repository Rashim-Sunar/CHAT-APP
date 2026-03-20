# ChatApp
A real-time full-stack chat application built using the MERN stack (MongoDB, Express, React, Node.js) with TypeScript and Socket.io, designed to deliver seamless and scalable real-time communication.

The application supports instant messaging, user authentication, and efficient event-driven communication using WebSockets.

## Project Overview
ChatApp enables users to communicate in real-time with a responsive and modern interface:

- Real-time messaging using WebSockets
- Secure user authentication
- Scalable backend architecture
- Efficient event-driven communication
  
Real-world use case: messaging platforms, customer support systems, collaborative tools, and social communication apps.

## Architecture Overview
This project follows a client-server architecture with WebSocket integration.

#### Components

| Layer                             | Responsibility                                   |
| --------------------------------- | ------------------------------------------------ |
| **Frontend (React)**         | UI, chat interface, state management             |
| **Backend (Node + Express + TS)** | API handling, authentication, socket integration |
| **Database (MongoDB)**            | Stores users, messages, and chat metadata        |
| **WebSocket (Socket.io)**         | Real-time bidirectional communication            |


## Features

#### Real-Time Messaging
- Instant message delivery using Socket.io
- Event-driven communication between users
- Low-latency chat experience

#### User Authentication
- Secure login and signup system
- Session handling and protected routes

#### Chat System
- One-to-one messaging
- Dynamic conversation updates
- Real-time UI synchronization

#### Scalable Backend
- Modular architecture with clear separation of concerns
- Optimized API handling

#### State Management
- Efficient frontend state handling
- Real-time updates without page reloads

## Tech Stack

#### Frontend
- React (TypeScript)
- Tailwind CSS
- Axios
#### Backend
- Node.js
- Express.js (TypeScript)
- MongoDB (Mongoose)

#### Real-Time Communication
- Socket.io

#### Tools & Utilities
- JWT (Authentication)
- REST APIs

## 📁 Folder Structure
```
chat-app/
│
├── frontend/src/             # React + Tailwind
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── context/
│   ├── zustand/
│   └── Utils/
│
├── backend/               # Express + TypeScript API
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middlewares/
│   ├── socket/
│   ├── types/
│   └── Utils/
│
└── README.md
```

## ⚙️ Installation & Setup

#### 1) Clone Repository
```
git clone https://github.com/Rashim-Sunar/CHAT-APP.git
cd CHAT-APP
```

#### 2) Install Dependencies
Backend
```
cd backend
npm install
```

Frontend
```
cd frontend
npm install
```

#### ▶️ Running the Application
Start Backend
```
cd backend
npm run dev
```

Start Frontend
```
cd frontend
npm run dev
```

## 🔐 Environment Variables

Backend (.env)
```
PORT = 8000
NODE_ENV = development
JWT_SECRET = 
USERNAME = 
PASSWORD = 
MONGO_DB_URI = 
```

## Future Improvements
- Group chat functionality
- Message read receipts (seen/delivered)
- Media sharing (images, files)
- Push notifications
- End-to-end encryption
- Typing indicators

## 🤝 Contributing
1. Fork the repository
2. Create a branch (feature/new-feature)
3. Commit your changes
4. Open a pull request
   
## 👨‍💻 Author
Rashim Sunar <br/>
MERN Stack Developer
# Secure Messaging Platform — Signal Clone

A full-stack Signal-inspired secure messaging demo built for an SDE assignment.

## Stack

- Frontend: Next.js + TypeScript + CSS
- Backend: FastAPI + SQLAlchemy
- Database: SQLite
- Real-time: FastAPI WebSockets
- Authentication: mocked fixed OTP (`123456`) with bearer sessions
- Deployment: Vercel (frontend) + Render (backend)

> This project intentionally mocks cryptographic key exchange and phone verification. It is a functional messaging demo, not a production E2EE implementation.
## Live Demo

- Frontend: https://signal-clone-tbsq.vercel.app
- Backend API: https://signal-clone-4knz.onrender.com
- API Documentation: https://signal-clone-4knz.onrender.com/docs
- Health Check: https://signal-clone-4knz.onrender.com/health

## Features

- Register/login with username and fixed OTP
- Session persistence with localStorage
- Profile/avatar
- Conversation list sorted by latest activity
- Search conversations and contacts
- Add contacts
- One-to-one real-time messaging
- Sending/sent/delivered/read states
- Typing indicator
- Online/last-seen status
- Group creation
- Group members
- Admin add/remove members
- Persistent messages and conversations
- Unread counts
- Settings placeholders
- Toast notifications for user feedback and actions
- Emoji Picker
- Responsive layout
- Seed data
- Mocked calls/stories/linked devices/E2EE sections

## Demo users

All demo users use OTP `123456`.

| Username | Display name |
|---|---|
| alice | Alice Johnson |
| bob | Bob Smith |
| carol | Carol Williams |
| dave | Dave Brown |

## Local setup

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS/Linux

npm run dev
```

Open http://localhost:3000.

## Environment variables
Backend:

```env
JWT_SECRET=your-secret
FRONTEND_URL=https://signal-clone-tbsq.vercel.app
DATABASE_URL=sqlite:///./signal.db
Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

Production:

```env
NEXT_PUBLIC_API_URL=https://signal-clone-4knz.onrender.com
NEXT_PUBLIC_WS_URL=wss://signal-clone-4knz.onrender.com
```

## Architecture

```text
Browser
  |
  | HTTP REST
  v
Next.js UI --------------------+
  |                            |
  | WebSocket                  |
  v                            v
FastAPI ------------------> ConnectionManager
  |
  v
SQLAlchemy
  |
  v
SQLite
```

REST handles authentication, contacts, conversations, history, groups and read receipts.

WebSockets handle:
- new messages
- typing events
- read events
- online presence
- real-time fan-out to conversation members

## Database schema

```text
users
  id PK
  username UNIQUE
  phone
  display_name
  avatar_url
  bio
  is_online
  last_seen
  created_at

contacts
  id PK
  owner_id FK -> users.id
  contact_id FK -> users.id
  UNIQUE(owner_id, contact_id)

conversations
  id PK
  type = direct | group
  name
  avatar_url
  created_by FK -> users.id
  created_at
  updated_at

conversation_members
  id PK
  conversation_id FK -> conversations.id
  user_id FK -> users.id
  role = member | admin
  joined_at
  UNIQUE(conversation_id, user_id)

messages
  id PK
  conversation_id FK -> conversations.id
  sender_id FK -> users.id
  body
  status = sending | sent | delivered | read
  created_at

message_reads
  id PK
  message_id FK -> messages.id
  user_id FK -> users.id
  read_at
  UNIQUE(message_id, user_id)
```

## API overview

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Users / contacts
- `GET /api/users/search?q=`
- `GET /api/contacts`
- `POST /api/contacts`

### Conversations
- `GET /api/conversations`
- `POST /api/conversations/direct`
- `GET /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/read`

### Groups
- `POST /api/groups`
- `GET /api/groups/{id}`
- `POST /api/groups/{id}/members`
- `DELETE /api/groups/{id}/members/{user_id}`

### WebSocket

`GET/WS /ws/{user_id}?token=...`

Client events:

```json
{"type":"message","conversation_id":1,"body":"Hello"}
{"type":"typing","conversation_id":1,"is_typing":true}
{"type":"read","conversation_id":1}
{"type":"ping"}
```

Server events include `message`, `typing`, `read`, `presence`, and `pong`.

## Deployment

### Backend on Render

Create a Render Web Service pointing at `backend/`.

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Frontend on Vercel

Create a Vercel project pointing at `frontend/`.

Add:

```env
NEXT_PUBLIC_API_URL=https://signal-clone-4knz.onrender.com
NEXT_PUBLIC_WS_URL=wss://signal-clone-4knz.onrender.com
```

Then redeploy.

## Important evaluation explanation

### Why REST + WebSocket?

REST is better for request/response operations such as login, search and loading history. WebSocket is appropriate for low-latency bidirectional events such as new messages and typing indicators.

### Why SQLite?

The assignment explicitly requires SQLite. SQLAlchemy keeps the persistence layer modular so the application can later move to PostgreSQL with minimal model/query changes.

### Why mock encryption?

The assignment explicitly says actual E2EE can be mocked. The application therefore labels encryption as simulated rather than falsely claiming to provide Signal's cryptographic guarantees.

### Why localStorage?

The assignment asks for session persistence. The demo stores the access token and user object locally. A production application would use secure, httpOnly cookies plus refresh-token rotation.

## Original-work note

The UI is an original implementation inspired by Signal's interaction patterns. It does not copy Signal source code or repositories.

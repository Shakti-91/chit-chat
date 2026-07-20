# Chat App — Next.js + Prisma + NextAuth

A full chat application with:

- **Authentication** — username/password, hashed with bcrypt, sessions via NextAuth (JWT).
  - Username: **unique**, letters only, **more than 5 characters** (6+).
  - Password: **more than 8 characters** (9+), any characters allowed.
- **One-to-one messaging** — direct messages between any two users.
- **Room-based chat** — create a room (get a unique join code) or join an existing room with a code. Anyone in the room sees all messages.
- **Live-ish updates** — the active conversation polls every 2.5s for new messages (no separate WebSocket server needed, works on any standard Next.js host).

## Tech stack

- Next.js 14 (App Router, TypeScript)
- Prisma ORM (PostgreSQL by default — easy to swap to MySQL/SQLite)
- NextAuth.js (Credentials provider)
- Tailwind CSS

## 1. Install dependencies

```bash
cd chat-app
npm install
```

## 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

- `DATABASE_URL` — your Postgres connection string. Locally you can spin one up with Docker:
  ```bash
  docker run --name chat-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=chatapp -p 5432:5432 -d postgres:16
  ```
  then set:
  ```
  DATABASE_URL="postgresql://postgres:password@localhost:5432/chatapp?schema=public"
  ```
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev.

> Prefer MySQL or SQLite? Open `prisma/schema.prisma` and change the `provider` in the `datasource` block (e.g. `"mysql"` or `"sqlite"`), then update `DATABASE_URL` to match.

## 3. Set up the database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

This creates the tables: `User`, `Room`, `RoomMember`, `Message` (DMs), `RoomMessage`.

Optional demo users:

```bash
npm run seed
```

This creates `alicesmith` / `password123` and `bobjohnson` / `password123`.

## 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`. Click "Sign up" to register a new account.

## How it works

### Auth
- `/api/register` validates and creates a user (hashed password, unique username enforced both at the app layer and via a DB unique constraint).
- NextAuth's Credentials provider (`src/lib/auth.ts`) checks the username/password on login and issues a JWT session.
- `src/middleware.ts` protects `/dashboard/*` — unauthenticated users are redirected to `/login`.

### One-to-one messaging
- `GET/POST /api/messages/[userId]` reads/writes rows in the `Message` table, scoped to the pair of users (sender/receiver in either direction).

### Rooms
- `POST /api/rooms` creates a room and auto-generates a unique 6-character code; the creator is added as the first member.
- `POST /api/rooms/join` looks up a room by code and adds the current user as a member (idempotent — joining twice is a no-op).
- `GET /api/rooms` lists the rooms the current user belongs to.
- `GET/POST /api/rooms/[roomId]/messages` reads/writes `RoomMessage` rows, but only for users who are members of that room (checked server-side on every request).

### Frontend
- `src/app/dashboard/DashboardClient.tsx` is the single-page chat UI: a sidebar listing other users (for DMs) and joined rooms, plus modals to create/join a room, and a chat pane that polls for new messages.

## Notes / possible upgrades

- Polling is used instead of WebSockets to keep deployment simple (works on Vercel etc. without a custom server). For true real-time push, swap the polling `useEffect` in `DashboardClient.tsx` for a WebSocket/Pusher/Ably client, or add a custom Node server with `socket.io`.
- Add rate limiting on `/api/register` and message endpoints if deploying publicly.
- Consider adding pagination/cursor-based loading for very long conversation histories (currently capped at the last 200 messages).

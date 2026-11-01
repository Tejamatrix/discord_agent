# Discord Control Hub 🎛️

> **Version:** 1.0 (MVP Release)  
> **Architecture:** Multi-tenant SaaS (Dashboard + REST API + Gateway/Voice Engine)

Discord Control Hub is a modern SaaS web application that enables Discord community administrators and content creators to control Discord bot operations—including music playback, voice connections, channel announcements, server fleet settings, and security audits—without typing bot commands in chat.

---

## 🚀 Key Modules Implemented

- **Remote Discord Account Controller (Bluecord / Token)**  
  Direct client mode supporting user account tokens (in raw string or JSON format). Controls real joined servers, real channels, and sends live messages.
- **Audio File Uploads & High-Volume VC Soundboard**  
  Upload custom audio files (mp3, wav, ogg, m4a, flac, opus) and trigger high-sound optimized playback directly into voice channels with gain multipliers up to 200%.
- **Auto-Join Server via Invite**  
  Accepts invite links or codes, automatically bypassing Discord onboarding questions and rule acceptance.
- **Module C: Music Management**  
  Play audio streams, pause, resume, skip, stop, real-time audio progress timeline, volume slider, interactive queue manager (add/remove tracks), preset streams.
- **Module D: Voice Management**  
  Connect bot to voice channels, disconnect bot, display active voice states in real time.
- **Module E: Announcements**  
  Text channel selector, rich announcement composer, live Discord message preview, Text-to-Speech (TTS) toggle, broadcast confirmation modal, announcement history.
- **Module F: Server Fleet Management**  
  Overview of authorized Discord servers, channel list inspection, bot installation status, OAuth invite link generator, bot removal.
- **Module G: All Control & Settings**  
  Persistent server configurations (default volume, announcement prefix, auto-disconnect inactivity timeout) stored in the database.
- **Module H: Activity & Security**  
  Full audit logging of operator actions, session login history, credential sanitization.

---

## 🛠️ Technology Stack

- **Monorepo:** npm workspaces (`packages/shared`, `apps/server`, `apps/web`)
- **Backend API & Bot Engine:** Node.js, Express, Socket.io, `discord.js` v14, `@discordjs/voice`
- **Frontend Dashboard:** React 18, Vite, Tailwind CSS, Lucide Icons, Socket.io client
- **Database & ORM:** Prisma ORM with SQLite for zero-config local development and PostgreSQL support for cloud deployments
- **Security:** OAuth2 state validation, zero user token collection, tenant boundary verification middleware

---

## 🏁 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
A configured `.env` file is already provided for local testing. To connect your real Discord Bot application, fill in your credentials from the [Discord Developer Portal](https://discord.com/developers/applications):

```env
PORT=3001
DATABASE_URL="file:./apps/server/prisma/dev.db"
JWT_SECRET="discord-control-hub-session-secret-key-32chars"

DISCORD_CLIENT_ID="YOUR_DISCORD_APPLICATION_CLIENT_ID"
DISCORD_CLIENT_SECRET="YOUR_DISCORD_CLIENT_SECRET"
DISCORD_BOT_TOKEN="YOUR_DISCORD_BOT_TOKEN"
DISCORD_REDIRECT_URI="http://localhost:3001/api/v1/auth/callback"
FRONTEND_URL="http://localhost:5173"

# DEMO_MODE enables instant SaaS preview with simulated guilds and audio
DEMO_MODE=true
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start Development Servers
Run backend and frontend concurrently:
```bash
# Terminal 1: Start Backend API & Discord Bot Engine
npm run dev:server

# Terminal 2: Start Vite Web Dashboard
npm run dev:web
```

Open your browser at **`http://localhost:5173`**.

---

## 🔒 Security & Privacy Guarantees

As strictly mandated by the PRD:
1. **Zero Personal Token Collection:** Users authenticate exclusively via official Discord OAuth2. Personal account tokens are never collected or stored.
2. **Tenant Isolation:** All operations (playback, volume, announcements, settings) require explicit guild ownership or `ADMINISTRATOR` / `MANAGE_GUILD` permissions.
3. **Audit Trails:** Sensitive credentials and API tokens never appear in activity logs.

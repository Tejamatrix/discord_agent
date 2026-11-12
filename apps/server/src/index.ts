process.on('uncaughtException', (err: any) => {
  console.error('Unhandled Exception caught safely:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection caught safely:', reason?.message || reason);
});

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { connectDb } from './db/prisma';
import { seedInitialData } from './db/seed';
import { socketService } from './socket';
import { botService } from './bot/client';

// Routers
import authRouter from './api/routes/auth';
import dashboardRouter from './api/routes/dashboard';
import serversRouter from './api/routes/servers';
import musicRouter from './api/routes/music';
import voiceRouter from './api/routes/voice';
import announcementsRouter from './api/routes/announcements';
import settingsRouter from './api/routes/settings';
import activityRouter from './api/routes/activity';
import accountRouter from './api/routes/account';
import adminRouter from './api/routes/admin';
import { keyService } from './services/keyService';

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins (Vercel domains, localhost, custom domains) with credentials
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Initialize Socket.io
socketService.initialize(server);

// API Route Bindings
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/servers', serversRouter);
app.use('/api/v1/music', musicRouter);
app.use('/api/v1/voice', voiceRouter);
app.use('/api/v1/announcements', announcementsRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/activity', activityRouter);
app.use('/api/v1/account', accountRouter);
app.use('/api/v1/admin', adminRouter);

// Root & Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'GOD x LIVE Backend API Gateway',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.3.3-dave-ready-soundboard-fix',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    bot_online: botService.isConnected,
    demo_mode: config.demoMode,
  });
});

async function bootstrap() {
  await connectDb();
  await seedInitialData();
  await keyService.ensureSeedKey();
  await botService.start();

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Discord Control Hub API & Gateway running on http://0.0.0.0:${config.port}`);
    console.log(`🌐 Dashboard frontend target: ${config.frontendUrl}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

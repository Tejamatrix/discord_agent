import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace or server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'discord-control-hub-session-secret-key-32chars',
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/callback',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  demoMode: process.env.DEMO_MODE !== 'false', // Default to true if not explicitly false
  adminEmail: (process.env.ADMIN_EMAIL || 'palisettisunitha@gmail.com').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'toman@12112',
};

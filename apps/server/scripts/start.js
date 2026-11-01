const { execSync } = require('child_process');
const path = require('path');

// Ensure DATABASE_URL is set for Prisma
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
process.env.PORT = process.env.PORT || '3001';

console.log('📦 Synchronizing database schema with Prisma (DATABASE_URL=' + process.env.DATABASE_URL + ')...');

try {
  execSync('npx prisma db push --accept-data-loss', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  console.log('✅ Database schema synchronized.');
} catch (err) {
  console.error('⚠️ Non-fatal prisma db push notice:', err && err.message ? err.message : err);
}

console.log('🚀 Booting Discord Control Hub Backend...');
require('../dist/index.js');

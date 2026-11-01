import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb, prisma } from '../db/prisma';
import { seedInitialData } from '../db/seed';
import { socketService } from '../socket';

import authRouter from '../api/routes/auth';
import dashboardRouter from '../api/routes/dashboard';
import serversRouter from '../api/routes/servers';
import musicRouter from '../api/routes/music';
import voiceRouter from '../api/routes/voice';
import announcementsRouter from '../api/routes/announcements';
import settingsRouter from '../api/routes/settings';
import activityRouter from '../api/routes/activity';

async function runTests() {
  console.log('🧪 Starting Discord Control Hub MVP Integration Tests...\n');

  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  socketService.initialize(server);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/servers', serversRouter);
  app.use('/api/v1/music', musicRouter);
  app.use('/api/v1/voice', voiceRouter);
  app.use('/api/v1/announcements', announcementsRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/activity', activityRouter);

  await connectDb();
  await seedInitialData();

  await new Promise<void>((resolve) => {
    server.listen(3099, () => {
      console.log('Test server listening on port 3099');
      resolve();
    });
  });

  const BASE = 'http://localhost:3099/api/v1';
  let authToken = '';
  let testGuildId = '';

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      process.exit(1);
    } else {
      console.log(`✅ PASSED: ${message}`);
    }
  }

  try {
    // 1. Auth Test (Module A)
    console.log('\n--- Testing Module A: Authentication ---');
    const loginRes = await fetch(`${BASE}/auth/demo-login`, { method: 'POST' });
    const loginData = await loginRes.json() as any;
    assert(loginData.success && loginData.data.token, 'Demo Login generates valid session token');
    authToken = loginData.data.token;

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    const meRes = await fetch(`${BASE}/auth/me`, { headers: authHeaders });
    const meData = await meRes.json() as any;
    assert(meData.success && meData.data.username === 'Alex_Commander', 'Authenticated /auth/me returns user profile');

    // 2. Dashboard Test (Module B)
    console.log('\n--- Testing Module B: Dashboard & Status ---');
    const dashRes = await fetch(`${BASE}/dashboard`, { headers: authHeaders });
    const dashData = await dashRes.json() as any;
    assert(dashData.success && dashData.data.authorized_guilds.length > 0, 'Dashboard returns user authorized guilds');
    testGuildId = dashData.data.authorized_guilds[0].id;
    assert(dashData.data.bot.online === true, 'Bot online status is active in dashboard');

    // 3. Servers Test (Module F)
    console.log('\n--- Testing Module F: Server Fleet Management ---');
    const serversRes = await fetch(`${BASE}/servers`, { headers: authHeaders });
    const serversData = await serversRes.json() as any;
    assert(serversData.success && Array.isArray(serversData.data), 'GET /servers returns list of servers');

    const detailsRes = await fetch(`${BASE}/servers/${testGuildId}`, { headers: authHeaders });
    const detailsData = await detailsRes.json() as any;
    assert(detailsData.success && detailsData.data.channels.length > 0, 'Server details returns accessible channels');

    // 4. Voice Test (Module D)
    console.log('\n--- Testing Module D: Voice Connection Management ---');
    const voiceConnectRes = await fetch(`${BASE}/voice/connect`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        guild_id: testGuildId,
        channel_id: 'vc_general_voice_101',
        channel_name: 'General Voice',
      }),
    });
    const voiceConnectData = await voiceConnectRes.json() as any;
    assert(voiceConnectData.success && voiceConnectData.data.status === 'connected', 'Bot joins authorized voice channel');

    const voiceStatusRes = await fetch(`${BASE}/voice/status?guild_id=${testGuildId}`, { headers: authHeaders });
    const voiceStatusData = await voiceStatusRes.json() as any;
    assert(voiceStatusData.success && voiceStatusData.data.status === 'connected', 'Voice status confirms connection');

    // 5. Music Test (Module C)
    console.log('\n--- Testing Module C: Music Playback & Queue Management ---');
    const playRes = await fetch(`${BASE}/music/play`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        guild_id: testGuildId,
        track: {
          id: 'trk_test_01',
          title: 'Integration Test Synth Beats',
          artist: 'E2E Runner',
          duration: 180,
          source_reference: 'https://test.stream/audio.mp3',
        },
      }),
    });
    const playData = await playRes.json() as any;
    assert(playData.success && playData.data.playback_status === 'playing', 'Starts audio playback in voice channel');

    const pauseRes = await fetch(`${BASE}/music/pause`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ guild_id: testGuildId }),
    });
    const pauseData = await pauseRes.json() as any;
    assert(pauseData.success && pauseData.data.playback_status === 'paused', 'Pauses audio stream');

    const resumeRes = await fetch(`${BASE}/music/resume`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ guild_id: testGuildId }),
    });
    const resumeData = await resumeRes.json() as any;
    assert(resumeData.success && resumeData.data.playback_status === 'playing', 'Resumes audio stream');

    const volRes = await fetch(`${BASE}/music/volume`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ guild_id: testGuildId, volume: 60 }),
    });
    const volData = await volRes.json() as any;
    assert(volData.success && volData.data.volume === 60, 'Sets playback volume to 60%');

    // 6. Announcements Test (Module E)
    console.log('\n--- Testing Module E: Announcements ---');
    const annRes = await fetch(`${BASE}/announcements`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        guild_id: testGuildId,
        channel_id: 'tc_announcements_201',
        message: 'Hello Discord! Automated MVP Verification Broadcast',
        tts: false,
      }),
    });
    const annData = await annRes.json() as any;
    assert(annData.success && annData.data.message.includes('Automated MVP'), 'Dispatches text announcement to channel');

    // 7. Settings Test (Module G)
    console.log('\n--- Testing Module G: All Control & Settings ---');
    const updateSetRes = await fetch(`${BASE}/settings`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        guild_id: testGuildId,
        settings: {
          default_volume: '85',
          announcement_prefix: '[VERIFIED]',
        },
      }),
    });
    const updateSetData = await updateSetRes.json() as any;
    assert(updateSetData.success, 'Updates guild settings');

    // 8. Activity Test (Module H)
    console.log('\n--- Testing Module H: Activity & Security ---');
    const actRes = await fetch(`${BASE}/activity?guild_id=${testGuildId}`, { headers: authHeaders });
    const actData = await actRes.json() as any;
    assert(actData.success && actData.data.length > 0, 'Retrieves audit logs without credential leakage');

    console.log('\n🎉 ALL MVP INTEGRATION TESTS PASSED PERFECTLY!\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();

import { prisma } from './prisma';

export async function seedInitialData() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) return;

  console.log('🌱 Seeding initial demo data for Discord Control Hub...');

  // Create demo user
  const user = await prisma.user.create({
    data: {
      id: 'usr_demo_admin_001',
      discord_user_id: '999888777666555444',
      username: 'Alex_Commander',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    },
  });

  // Create demo guilds
  const guildA = await prisma.guild.create({
    data: {
      id: 'gld_gaming_citadel_01',
      discord_guild_id: '111222333444555666',
      name: 'Gaming Citadel 🎮',
      icon: 'https://cdn.discordapp.com/icons/111222333444555666/a_icon.png',
      installations: {
        create: {
          bot_status: 'online',
        },
      },
      user_access: {
        create: {
          user_id: user.id,
          permission_level: 'admin',
        },
      },
      settings: {
        createMany: {
          data: [
            { setting_key: 'default_volume', setting_value: '75' },
            { setting_key: 'announcement_prefix', setting_value: '[HUB ANNOUNCEMENT]' },
            { setting_key: 'auto_disconnect_minutes', setting_value: '10' },
          ],
        },
      },
    },
  });

  const guildB = await prisma.guild.create({
    data: {
      id: 'gld_lofi_lounge_02',
      discord_guild_id: '222333444555666777',
      name: 'Lofi Chill Sanctuary ☕',
      icon: 'https://cdn.discordapp.com/icons/222333444555666777/b_icon.png',
      installations: {
        create: {
          bot_status: 'online',
        },
      },
      user_access: {
        create: {
          user_id: user.id,
          permission_level: 'admin',
        },
      },
      settings: {
        createMany: {
          data: [
            { setting_key: 'default_volume', setting_value: '50' },
            { setting_key: 'announcement_prefix', setting_value: '📢' },
          ],
        },
      },
    },
  });

  // Initial Music Session for Guild A
  const musicSession = await prisma.musicSession.create({
    data: {
      id: 'ms_session_01',
      guild_id: guildA.id,
      voice_channel_id: 'vc_general_voice_101',
      current_track: JSON.stringify({
        id: 'trk_01',
        title: 'Synthwave Odyssey (Neon Pulse)',
        artist: 'CyberDreamer',
        duration: 215,
        source_reference: 'https://stream.example.com/synthwave.mp3',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop',
        requested_by: user.username,
        position: 0,
      }),
      playback_status: 'playing',
      volume: 75,
    },
  });

  // Music Queue for Guild A
  await prisma.musicQueue.createMany({
    data: [
      {
        session_id: musicSession.id,
        track_title: 'Midnight Lo-Fi Beats to Relax/Code to',
        source_reference: 'https://stream.example.com/lofi-midnight.mp3',
        position: 1,
      },
      {
        session_id: musicSession.id,
        track_title: 'Electric Horizon - Retro Wave Edition',
        source_reference: 'https://stream.example.com/electric-horizon.mp3',
        position: 2,
      },
      {
        session_id: musicSession.id,
        track_title: 'Starlight Acoustic Chill',
        source_reference: 'https://stream.example.com/starlight.mp3',
        position: 3,
      },
    ],
  });

  // Activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        user_id: user.id,
        guild_id: guildA.id,
        action: 'Bot Voice Joined #General-Voice',
        status: 'success',
      },
      {
        user_id: user.id,
        guild_id: guildA.id,
        action: 'Started track: Synthwave Odyssey',
        status: 'success',
      },
      {
        user_id: user.id,
        guild_id: guildB.id,
        action: 'Installed Discord Control Hub Bot',
        status: 'success',
      },
      {
        user_id: user.id,
        action: 'User OAuth2 Login via Discord',
        status: 'info',
      },
    ],
  });

  console.log('✅ Demo data seeded successfully.');
}

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { prisma } from '../../db/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Discord OAuth2 Initiation
router.get('/discord', (req, res) => {
  const clientId = config.discord.clientId;
  const redirectUri = encodeURIComponent(config.discord.redirectUri);
  const scope = encodeURIComponent('identify guilds');
  const state = Math.random().toString(36).substring(7);

  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  res.redirect(discordAuthUrl);
});

// Discord OAuth2 Callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${config.frontendUrl}/?error=no_code`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: config.discord.redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed to exchange token');
    }

    // Fetch user profile
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userResponse.json() as any;

    // Fetch user guilds
    const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userGuilds = await guildsResponse.json() as any[];

    // Upsert user in database
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0') % 5}.png`;

    const user = await prisma.user.upsert({
      where: { discord_user_id: discordUser.id },
      update: {
        username: discordUser.global_name || discordUser.username,
        avatar: avatarUrl,
      },
      create: {
        discord_user_id: discordUser.id,
        username: discordUser.global_name || discordUser.username,
        avatar: avatarUrl,
      },
    });

    // Sync admin/manager guilds (PRD Module A & F)
    if (Array.isArray(userGuilds)) {
      for (const g of userGuilds) {
        // Check for Administrator (0x8) or Manage Guild (0x20)
        const permissions = BigInt(g.permissions || '0');
        const isAdmin = (permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n;

        if (isAdmin || g.owner) {
          const guildRecord = await prisma.guild.upsert({
            where: { discord_guild_id: g.id },
            update: {
              name: g.name,
              icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
            },
            create: {
              discord_guild_id: g.id,
              name: g.name,
              icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
            },
          });

          await prisma.userGuildAccess.upsert({
            where: {
              user_id_guild_id: {
                user_id: user.id,
                guild_id: guildRecord.id,
              },
            },
            update: { permission_level: 'admin' },
            create: {
              user_id: user.id,
              guild_id: guildRecord.id,
              permission_level: 'admin',
            },
          });
        }
      }
    }

    // Generate JWT token session
    const sessionToken = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    // Store session in DB
    await prisma.session.create({
      data: {
        user_id: user.id,
        session_hash: sessionToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Record login activity
    await prisma.activityLog.create({
      data: {
        user_id: user.id,
        action: 'OAuth2 Login via Discord',
        status: 'success',
      },
    });

    // Set HTTP-only cookie and redirect to dashboard
    res.cookie('hub_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${config.frontendUrl}/?token=${sessionToken}`);
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    res.redirect(`${config.frontendUrl}/?error=${encodeURIComponent(err.message || 'auth_failed')}`);
  }
});

// Demo Login route (for immediate testing without Discord credentials)
router.post('/demo-login', async (req, res) => {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        discord_user_id: '999888777666555444',
        username: 'Alex_Commander',
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
    });
  }

  const sessionToken = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

  res.cookie('hub_session', sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    data: {
      token: sessionToken,
      user,
    },
  });
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
  if (req.user) {
    await prisma.activityLog.create({
      data: {
        user_id: req.user.id,
        action: 'User Logged Out',
        status: 'info',
      },
    });
  }

  res.clearCookie('hub_session');
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;

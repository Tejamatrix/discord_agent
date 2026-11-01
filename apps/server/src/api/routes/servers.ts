import { Router } from 'express';
import { authMiddleware, requireGuildAccess } from '../middleware/auth';
import { prisma } from '../../db/prisma';
import { botService } from '../../bot/client';

const router = Router();

// GET /api/v1/servers - List user authorized servers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const accessList = await prisma.userGuildAccess.findMany({
      where: { user_id: userId },
      include: {
        guild: {
          include: { installations: true },
        },
      },
    });

    const servers = accessList.map((a) => ({
      id: a.guild.id,
      discord_guild_id: a.guild.discord_guild_id,
      name: a.guild.name,
      icon: a.guild.icon,
      permission_level: a.permission_level,
      bot_installed: a.guild.installations.length > 0,
      bot_status: a.guild.installations[0]?.bot_status || 'offline',
      created_at: a.guild.created_at.toISOString(),
    }));

    res.json({ success: true, data: servers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/servers/invite-url - Get Discord OAuth2 Bot Invite Link
router.get('/invite-url', (req, res) => {
  res.json({
    success: true,
    data: {
      url: botService.getInviteUrl(),
    },
  });
});

// GET /api/v1/servers/:guild_id - Server Details & Accessible Channels
router.get('/:guild_id', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.params;
    const guild = await prisma.guild.findUnique({
      where: { id: guild_id },
      include: {
        installations: true,
        settings: true,
      },
    });

    if (!guild) {
      return res.status(404).json({ success: false, error: 'Guild not found' });
    }

    const channels = botService.getGuildChannels(guild.discord_guild_id);

    res.json({
      success: true,
      data: {
        ...guild,
        bot_installed: guild.installations.length > 0,
        channels,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/servers/:guild_id/install - Simulate/Record bot installation
router.post('/:guild_id/install', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.params;
    const installation = await prisma.installation.create({
      data: {
        guild_id,
        bot_status: 'online',
      },
    });

    await prisma.activityLog.create({
      data: {
        user_id: req.user!.id,
        guild_id,
        action: 'Bot Installed in Server',
        status: 'success',
      },
    });

    res.json({ success: true, data: installation });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/servers/:guild_id/installation - Remove bot from server
router.delete('/:guild_id/installation', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.params;
    await prisma.installation.deleteMany({
      where: { guild_id },
    });

    await prisma.activityLog.create({
      data: {
        user_id: req.user!.id,
        guild_id,
        action: 'Bot Removed from Server',
        status: 'info',
      },
    });

    res.json({ success: true, message: 'Bot uninstalled successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

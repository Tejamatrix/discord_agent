import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { botService } from '../../bot/client';
import { prisma } from '../../db/prisma';
import { musicManager } from '../../bot/music';

const router = Router();

// GET /api/v1/dashboard - Overview Data
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Fetch user's authorized guilds
    const accessList = await prisma.userGuildAccess.findMany({
      where: { user_id: userId },
      include: {
        guild: {
          include: {
            installations: true,
          },
        },
      },
    });

    const guilds = accessList.map((a) => ({
      id: a.guild.id,
      discord_guild_id: a.guild.discord_guild_id,
      name: a.guild.name,
      icon: a.guild.icon,
      bot_installed: a.guild.installations.length > 0,
      permission_level: a.permission_level,
      created_at: a.guild.created_at.toISOString(),
    }));

    // Active sessions for user guilds
    const guildIds = guilds.map((g) => g.id);
    const activeSessions = await Promise.all(
      guildIds.map((gid) => musicManager.getSession(gid))
    );

    // Recent activity logs
    const recentActivity = await prisma.activityLog.findMany({
      where: {
        OR: [{ user_id: userId }, { guild_id: { in: guildIds } }],
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const botStatus = botService.getBotStatus();

    res.json({
      success: true,
      data: {
        user: req.user,
        bot: botStatus,
        authorized_guilds: guilds,
        active_sessions: activeSessions.filter((s) => s.playback_status !== 'stopped'),
        recent_activity: recentActivity.map((log) => ({
          ...log,
          created_at: log.created_at.toISOString(),
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/dashboard/status - Quick heartbeat & status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: botService.getBotStatus(),
  });
});

export default router;

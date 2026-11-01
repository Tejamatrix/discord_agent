import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../../db/prisma';

const router = Router();

// GET /api/v1/activity
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { guild_id } = req.query;

    const whereClause: any = {
      OR: [
        { user_id: userId },
      ],
    };

    if (guild_id) {
      whereClause.OR.push({ guild_id: String(guild_id) });
    }

    const logs = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        guild: true,
        user: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        user_id: l.user_id,
        username: l.user?.username || 'User',
        guild_id: l.guild_id,
        guild_name: l.guild?.name || 'Global',
        action: l.action,
        status: l.status,
        created_at: l.created_at.toISOString(),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/activity/login-history
router.get('/login-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const logins = await prisma.activityLog.findMany({
      where: {
        user_id: userId,
        action: { contains: 'Login' },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      data: logins.map((l) => ({
        id: l.id,
        action: l.action,
        status: l.status,
        created_at: l.created_at.toISOString(),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

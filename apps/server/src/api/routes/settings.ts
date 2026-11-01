import { Router } from 'express';
import { authMiddleware, requireGuildAccess } from '../middleware/auth';
import { prisma } from '../../db/prisma';

const router = Router();

// GET /api/v1/settings?guild_id=...
router.get('/', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const guildId = String(req.query.guild_id);
    const settings = await prisma.setting.findMany({
      where: { guild_id: guildId },
    });

    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    res.json({ success: true, data: settingsMap });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/settings
router.patch('/', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id, settings } = req.body;

    if (!guild_id || !settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'guild_id and settings object required' });
    }

    const updates = Object.entries(settings).map(([key, val]) =>
      prisma.setting.upsert({
        where: {
          guild_id_setting_key: {
            guild_id,
            setting_key: key,
          },
        },
        update: { setting_value: String(val) },
        create: {
          guild_id,
          setting_key: key,
          setting_value: String(val),
        },
      })
    );

    await Promise.all(updates);

    await prisma.activityLog.create({
      data: {
        user_id: req.user!.id,
        guild_id,
        action: 'Updated Server Settings',
        status: 'success',
      },
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

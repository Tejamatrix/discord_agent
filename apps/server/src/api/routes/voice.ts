import { Router } from 'express';
import { authMiddleware, requireGuildAccess } from '../middleware/auth';
import { voiceManager } from '../../bot/voice';
import { prisma } from '../../db/prisma';

const router = Router();

// POST /api/v1/voice/connect
router.post('/connect', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id, channel_id, channel_name } = req.body;

    if (!channel_id) {
      return res.status(400).json({ success: false, error: 'channel_id is required' });
    }

    const connected = await voiceManager.connect(guild_id, channel_id, channel_name);

    if (connected) {
      await prisma.activityLog.create({
        data: {
          user_id: req.user!.id,
          guild_id,
          action: `Connected to Voice Channel: ${channel_name || channel_id}`,
          status: 'success',
        },
      });

      res.json({
        success: true,
        data: {
          guild_id,
          channel_id,
          channel_name,
          status: 'connected',
        },
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to join voice channel' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/voice/disconnect
router.post('/disconnect', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.body;
    await voiceManager.disconnect(guild_id);

    await prisma.activityLog.create({
      data: {
        user_id: req.user!.id,
        guild_id,
        action: 'Disconnected from Voice Channel',
        status: 'info',
      },
    });

    res.json({
      success: true,
      data: {
        guild_id,
        status: 'disconnected',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/voice/status?guild_id=...
router.get('/status', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const guildId = String(req.query.guild_id);
    const session = voiceManager.getSession(guildId);

    res.json({
      success: true,
      data: session || {
        guildId,
        channelId: null,
        status: 'disconnected',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

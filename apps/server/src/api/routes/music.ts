import { Router } from 'express';
import { authMiddleware, requireGuildAccess } from '../middleware/auth';
import { musicManager } from '../../bot/music';
import { prisma } from '../../db/prisma';

const router = Router();

// GET /api/v1/music/session?guild_id=...
router.get('/session', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const guildId = String(req.query.guild_id);
    const session = await musicManager.getSession(guildId);
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/play
router.post('/play', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id, track, voice_channel_id } = req.body;

    if (!track || !track.title) {
      return res.status(400).json({ success: false, error: 'Valid track required' });
    }

    const session = await musicManager.play(guild_id, track, voice_channel_id);

    await prisma.activityLog.create({
      data: {
        user_id: req.user!.id,
        guild_id,
        action: `Played Track: ${track.title}`,
        status: 'success',
      },
    });

    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/pause
router.post('/pause', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.body;
    const session = await musicManager.pause(guild_id);
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/resume
router.post('/resume', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.body;
    const session = await musicManager.resume(guild_id);
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/skip
router.post('/skip', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.body;
    const session = await musicManager.skip(guild_id);
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/stop
router.post('/stop', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id } = req.body;
    const session = await musicManager.stop(guild_id);
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/volume
router.post('/volume', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id, volume } = req.body;
    const session = await musicManager.setVolume(guild_id, Number(volume));
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/music/queue?guild_id=...
router.get('/queue', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const guildId = String(req.query.guild_id);
    const queue = await musicManager.getQueue(guildId);
    res.json({ success: true, data: queue });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/music/queue (Add track to queue)
router.post('/queue', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id, track } = req.body;
    const item = await musicManager.addToQueue(guild_id, track);
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/music/queue/:item_id?guild_id=...
router.delete('/queue/:item_id', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { item_id } = req.params;
    const guildId = String(req.query.guild_id);
    await musicManager.removeQueueItem(item_id, guildId);
    res.json({ success: true, message: 'Queue item removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

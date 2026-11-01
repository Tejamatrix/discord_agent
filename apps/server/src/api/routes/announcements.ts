import { Router } from 'express';
import { authMiddleware, requireGuildAccess } from '../middleware/auth';
import { announcementService } from '../../bot/announcements';

const router = Router();

// POST /api/v1/announcements
router.post('/', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const { guild_id, channel_id, message, tts } = req.body;

    if (!guild_id || !channel_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'guild_id, channel_id, and message are required',
      });
    }

    const announcement = await announcementService.sendAnnouncement(
      guild_id,
      channel_id,
      message,
      req.user!.id,
      Boolean(tts)
    );

    res.json({ success: true, data: announcement });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/announcements/history?guild_id=...
router.get('/history', authMiddleware, requireGuildAccess, async (req, res) => {
  try {
    const guildId = String(req.query.guild_id);
    const history = await announcementService.getHistory(guildId);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

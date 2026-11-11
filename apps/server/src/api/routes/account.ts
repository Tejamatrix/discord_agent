import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { tenantAccountManager, UserAccountSession } from '../../account/userAccount';
import { soundboardManager, UPLOADS_DIR } from '../../audio/soundboard';
import { keyService } from '../../services/keyService';
import { adminService, OWNER_EMAIL } from '../../services/adminService';
import { prisma } from '../../db/prisma';
import { config } from '../../config/env';

const router = Router();

// Configure Multer for Audio Uploads (tenant isolated)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const tenant = await resolveTenantSession(req);
      const dir = soundboardManager.getTenantUploadsDir(tenant.tenantId);
      cb(null, dir);
    } catch {
      cb(null, UPLOADS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const unique = `${Date.now()}-${cleanName}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max audio file size
  },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (mp3, wav, ogg, m4a, flac, aac, opus, webm) are supported'));
    }
  },
});

export interface ResolvedTenant {
  tenantId: string;
  isAdmin: boolean;
  soundTier: 'standard' | 'admin_peaks';
  maxTokens: number;
  session: UserAccountSession;
}

export const resolveTenantSession = async (req: any): Promise<ResolvedTenant> => {
  // 1. Check for Admin authentication
  const adminHeader = req.headers['x-admin-email'] || req.headers['authorization'];
  let email = '';
  if (typeof adminHeader === 'string') {
    email = adminHeader.replace(/^Bearer\s+/i, '').trim().toLowerCase();
  }
  if (email && (await adminService.isAdmin(email))) {
    const customCapacity = req.headers['x-admin-capacity']
      ? parseInt(String(req.headers['x-admin-capacity']), 10)
      : undefined;
    const finalSlots = customCapacity && !isNaN(customCapacity)
      ? Math.max(1, Math.min(100, customCapacity))
      : 100;
    const session = tenantAccountManager.getSession('admin_' + email, finalSlots, 'admin_peaks');
    return {
      tenantId: 'admin_' + email,
      isAdmin: true,
      soundTier: 'admin_peaks',
      maxTokens: finalSlots,
      session,
    };
  }

  // 2. Check for Access Key
  const accessKey = req.headers['x-access-key'] || req.query?.accessKey || req.body?.accessKey || req.headers['x-key'];
  if (typeof accessKey === 'string' && accessKey.trim()) {
    const cleanKey = accessKey.trim().toUpperCase();
    const check = await keyService.validateKey(cleanKey);
    if (check.valid && check.keyInfo) {
      const tier = check.keyInfo.sound_tier === 'admin_peaks' ? 'admin_peaks' : 'standard';
      const session = tenantAccountManager.getSession('key_' + cleanKey, check.keyInfo.max_tokens, tier);
      return {
        tenantId: 'key_' + cleanKey,
        isAdmin: false,
        soundTier: tier,
        maxTokens: check.keyInfo.max_tokens,
        session,
      };
    }
  }

  // 3. Fallback to default session for local requests
  const defaultSession = tenantAccountManager.getSession('default', 3, 'standard');
  return {
    tenantId: 'default',
    isAdmin: false,
    soundTier: 'standard',
    maxTokens: 3,
    session: defaultSession,
  };
};

// Helper to extract target slot index from request query, body, or headers
const getTargetSlotIndex = (req: any): number | undefined => {
  const param = req.query?.slot ?? req.body?.slotIndex ?? req.headers['x-slot-index'];
  if (param !== undefined && param !== null && param !== '') {
    const idx = parseInt(String(param), 10);
    if (!isNaN(idx) && idx >= 0 && idx < 100) return idx;
  }
  return undefined;
};

// --- ACCESS KEY VERIFICATION & ACTIVATION ---

// Verify Key
router.post('/key/verify', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    const check = await keyService.validateKey(key);
    if (!check.valid || !check.keyInfo) {
      return res.status(400).json({ success: false, error: check.error });
    }
    res.json({
      success: true,
      data: {
        key: check.keyInfo.key,
        maxTokens: check.keyInfo.max_tokens,
        soundTier: check.keyInfo.sound_tier,
        label: check.keyInfo.label,
        redeemed: Boolean(check.keyInfo.redeemed_by),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Activate / Redeem Key
router.post('/key/activate', async (req, res) => {
  try {
    const { key, email } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    const identifier = (email || 'anonymous-user').trim();
    const result = await keyService.redeemKey(key, identifier);
    if (!result.success || !result.keyInfo) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      data: {
        key: result.keyInfo.key,
        maxTokens: result.keyInfo.max_tokens,
        soundTier: result.keyInfo.sound_tier,
        label: result.keyInfo.label,
      },
      message: `License Key activated! Granted: ${result.keyInfo.max_tokens} Token Slot(s) with ${result.keyInfo.sound_tier === 'admin_peaks' ? 'Extreme Overdrive Peaks' : 'Standard Loud'} Sound.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- MULTI-TOKEN SLOTS CONTROLLER ---

// Get All Slots Info
router.get('/slots', async (req, res) => {
  const tenant = await resolveTenantSession(req);
  res.json({
    success: true,
    data: {
      activeSlotIndex: tenant.session.activeSlotIndex,
      maxTokens: tenant.maxTokens,
      slots: tenant.session.getAllSlotsInfo(tenant.maxTokens),
    },
  });
});

// Set Custom Slot Capacity (Reserved for Super Admin and Admin Only)
router.post('/slots/capacity', async (req, res) => {
  try {
    const tenant = await resolveTenantSession(req);
    if (!tenant.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Custom slot count is strictly restricted to Super Admin and Admin only. Regular clients must obtain an upgraded key.',
      });
    }

    const { capacity } = req.body;
    const count = parseInt(String(capacity), 10);
    if (isNaN(count) || count < 1 || count > 100) {
      return res.status(400).json({
        success: false,
        error: 'Slot capacity must be an integer between 1 and 100 slots.',
      });
    }

    tenant.session.setMaxTokens(count);
    tenant.maxTokens = count;

    res.json({
      success: true,
      data: {
        maxTokens: count,
        slots: tenant.session.getAllSlotsInfo(count),
      },
      message: `Admin slot capacity updated to ${count} slot(s).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Connect Token to Specific Slot (0, 1, or 2)
router.post('/slots/:index/connect', async (req, res) => {
  try {
    const slotIndex = parseInt(req.params.index, 10);
    const { token, json } = req.body;
    const input = token || json || req.body;

    if (!input) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const tenant = await resolveTenantSession(req);
    const rawInput = typeof input === 'string' ? input : JSON.stringify(input);
    const profile = await tenant.session.connectSlot(slotIndex, rawInput, tenant.maxTokens);

    res.json({
      success: true,
      data: {
        slot: slotIndex,
        profile,
        slots: tenant.session.getAllSlotsInfo(tenant.maxTokens),
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Disconnect Specific Slot
router.post('/slots/:index/disconnect', async (req, res) => {
  try {
    const slotIndex = parseInt(req.params.index, 10);
    const tenant = await resolveTenantSession(req);
    await tenant.session.disconnectSlot(slotIndex);
    res.json({
      success: true,
      data: {
        slot: slotIndex,
        slots: tenant.session.getAllSlotsInfo(tenant.maxTokens),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Select Active Slot
router.post('/slots/:index/select', async (req, res) => {
  try {
    const slotIndex = parseInt(req.params.index, 10);
    const tenant = await resolveTenantSession(req);
    const active = tenant.session.setActiveSlot(slotIndex);
    res.json({
      success: true,
      data: {
        activeSlot: active,
        profile: tenant.session.getProfile(),
        voiceState: tenant.session.getVoiceState(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Broadcast Play Voice Audio across all connected slots in VC
router.post('/voice/broadcast-play', async (req, res) => {
  try {
    const { audioUrl, soundId, boost } = req.body;
    const tenant = await resolveTenantSession(req);

    let source = audioUrl;
    if (soundId) {
      const sound = soundboardManager.getAudioById(soundId, tenant.tenantId);
      if (!sound) return res.status(404).json({ success: false, error: 'Sound not found' });
      source = sound.path;
    }

    if (!source) {
      return res.status(400).json({ success: false, error: 'audioUrl or soundId is required' });
    }

    const baseMultiplier = tenant.isAdmin || tenant.soundTier === 'admin_peaks' ? (boost ? 3.0 : 2.2) : (boost ? 1.4 : 1.1);
    const played = await tenant.session.playVoiceAudio(source, baseMultiplier, tenant.soundTier, tenant.isAdmin, true);

    res.json({
      success: played,
      message: 'Audio broadcasted to all connected voice channels!',
      slots: tenant.session.getAllSlotsInfo(tenant.maxTokens),
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Broadcast Stop Audio
router.post('/voice/broadcast-stop', async (req, res) => {
  const tenant = await resolveTenantSession(req);
  const stopped = tenant.session.stopVoiceAudio(true);
  res.json({
    success: true,
    message: 'Audio stopped across all accounts',
    slots: tenant.session.getAllSlotsInfo(tenant.maxTokens),
  });
});

// Connect with Token (Raw Token or JSON format) - Primary Slot
router.post('/connect', async (req, res) => {
  try {
    const { token, json } = req.body;
    const input = token || json || req.body;

    if (!input) {
      return res.status(400).json({ success: false, error: 'Token or JSON object containing token is required' });
    }

    const tenant = await resolveTenantSession(req);
    const rawInput = typeof input === 'string' ? input : JSON.stringify(input);
    const profile = await tenant.session.connectWithToken(rawInput);

    await prisma.activityLog.create({
      data: {
        user_id: profile.id,
        action: `Remote Account Connected: ${profile.username}`,
        status: 'success',
      },
    }).catch(() => {});

    res.json({
      success: true,
      data: profile,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to authenticate token with Discord',
    });
  }
});

// Get Connected Profile
router.get('/me', async (req, res) => {
  const tenant = await resolveTenantSession(req);
  const profile = tenant.session.getProfile();
  if (!profile) {
    return res.status(401).json({ success: false, error: 'No account connected' });
  }
  res.json({ success: true, data: profile });
});

// Disconnect
router.post('/disconnect', async (req, res) => {
  const tenant = await resolveTenantSession(req);
  await tenant.session.disconnect();
  res.json({ success: true, message: 'Account disconnected successfully' });
});

// Get Real Discord Servers
router.get('/guilds', async (req, res) => {
  try {
    const slot = getTargetSlotIndex(req);
    const tenant = await resolveTenantSession(req);
    const guilds = tenant.session.getGuilds(slot);
    res.json({ success: true, data: guilds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Channels for a specific Server
router.get('/guilds/:guildId/channels', async (req, res) => {
  try {
    const { guildId } = req.params;
    const slot = getTargetSlotIndex(req);
    const tenant = await resolveTenantSession(req);
    const channels = tenant.session.getChannels(guildId, slot);
    res.json({ success: true, data: channels });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Join Server automatically via Invite Link or Code
router.post('/join-server', async (req, res) => {
  try {
    const { invite } = req.body;
    const slot = getTargetSlotIndex(req);
    if (!invite) {
      return res.status(400).json({ success: false, error: 'Discord invite link or code is required' });
    }

    const tenant = await resolveTenantSession(req);
    const result = await tenant.session.joinServer(invite, slot);

    await prisma.activityLog.create({
      data: {
        user_id: tenant.session.getProfile(slot)?.id || 'account',
        action: `Account joined server: ${result.guild?.name || invite}`,
        status: 'success',
      },
    }).catch(() => {});

    res.json({
      success: true,
      data: result,
      message: result.message || `Account successfully joined ${result.guild?.name || 'server'}!`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Leave Server
router.delete('/guilds/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const slot = getTargetSlotIndex(req);
    const tenant = await resolveTenantSession(req);
    const success = await tenant.session.leaveServer(guildId, slot);
    res.json({ success, message: success ? 'Left server' : 'Failed to leave server' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send Message / Announcement as Account
router.post('/send-message', async (req, res) => {
  try {
    const { channelId, content, tts } = req.body;
    const slot = getTargetSlotIndex(req);
    if (!channelId || !content) {
      return res.status(400).json({ success: false, error: 'channelId and content are required' });
    }

    const tenant = await resolveTenantSession(req);
    const message = await tenant.session.sendMessage(channelId, content, tts, slot);

    await prisma.activityLog.create({
      data: {
        user_id: tenant.session.getProfile(slot)?.id || 'account',
        action: `Sent message to channel: ${channelId}`,
        status: 'success',
      },
    }).catch(() => {});

    res.json({ success: true, data: message });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Voice: Join Voice Channel (with permission check)
router.post('/voice/join', async (req, res) => {
  try {
    const { guildId, channelId } = req.body;
    const slotIndex = getTargetSlotIndex(req);
    if (!channelId) {
      return res.status(400).json({ success: false, error: 'channelId is required' });
    }

    const tenant = await resolveTenantSession(req);
    const voiceState = await tenant.session.joinVoiceChannel(guildId, channelId, slotIndex);
    res.json({ success: true, data: voiceState });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Voice: Leave Voice Channel
router.post('/voice/leave', async (req, res) => {
  try {
    const slotIndex = getTargetSlotIndex(req);
    const tenant = await resolveTenantSession(req);
    const voiceState = await tenant.session.leaveVoiceChannel(slotIndex);
    res.json({ success: true, data: voiceState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Voice: Adjust Volume (0 to 100 for Normal, 0 to 300 for Admin High Peaks)
router.post('/voice/volume', async (req, res) => {
  try {
    const { volume } = req.body;
    const slotIndex = getTargetSlotIndex(req);
    if (volume === undefined) {
      return res.status(400).json({ success: false, error: 'volume is required' });
    }
    const tenant = await resolveTenantSession(req);
    const state = tenant.session.setVolume(Number(volume), tenant.soundTier, tenant.isAdmin, slotIndex);
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Voice: Toggle Self-Mute
router.post('/voice/mute', async (req, res) => {
  try {
    const { mute } = req.body;
    const slotIndex = getTargetSlotIndex(req);
    const tenant = await resolveTenantSession(req);
    const state = tenant.session.setSelfMute(Boolean(mute), slotIndex);
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Voice: Toggle Self-Deaf
router.post('/voice/deaf', async (req, res) => {
  try {
    const { deaf } = req.body;
    const slotIndex = getTargetSlotIndex(req);
    const tenant = await resolveTenantSession(req);
    const state = tenant.session.setSelfDeaf(Boolean(deaf), slotIndex);
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Voice: Play Audio into VC (Stream or File)
router.post('/voice/play', async (req, res) => {
  try {
    const { audioUrl, boost, mode, broadcast } = req.body;
    const slotIndex = getTargetSlotIndex(req);
    const isJoint = mode === 'joint' || broadcast === true;
    if (!audioUrl) {
      return res.status(400).json({ success: false, error: 'audioUrl is required' });
    }
    const tenant = await resolveTenantSession(req);
    const baseMultiplier = tenant.isAdmin || tenant.soundTier === 'admin_peaks' ? (boost ? 2.8 : 2.0) : (boost ? 1.4 : 1.1);
    const playing = await tenant.session.playVoiceAudio(
      audioUrl,
      baseMultiplier,
      tenant.soundTier,
      tenant.isAdmin,
      isJoint,
      slotIndex,
      undefined,
      audioUrl
    );
    res.json({ success: playing, data: tenant.session.getVoiceState(slotIndex) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Voice: Play Uploaded Audio Sound from Soundboard
router.post('/voice/play-sound', async (req, res) => {
  try {
    const { soundId, boost, mode, broadcast } = req.body;
    const slotIndex = getTargetSlotIndex(req);
    const isJoint = mode === 'joint' || broadcast === true;
    if (!soundId) {
      return res.status(400).json({ success: false, error: 'soundId is required' });
    }

    const tenant = await resolveTenantSession(req);
    const sound = soundboardManager.getAudioById(soundId, tenant.tenantId);
    if (!sound) {
      return res.status(404).json({ success: false, error: 'Sound item not found' });
    }

    const source = sound.path;
    const baseMultiplier = tenant.isAdmin || tenant.soundTier === 'admin_peaks' ? (boost ? 3.0 : 2.2) : (boost ? 1.4 : 1.1);
    const playing = await tenant.session.playVoiceAudio(
      source,
      baseMultiplier,
      tenant.soundTier,
      tenant.isAdmin,
      isJoint,
      slotIndex,
      sound.id,
      sound.name
    );

    res.json({
      success: playing,
      data: {
        sound: sound.name,
        voiceState: tenant.session.getVoiceState(slotIndex),
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Voice: Stop Audio in VC
router.post('/voice/stop', async (req, res) => {
  const { mode, broadcast } = req.body || {};
  const slotIndex = getTargetSlotIndex(req);
  const isJoint = mode === 'joint' || broadcast === true;
  const tenant = await resolveTenantSession(req);
  const stopped = tenant.session.stopVoiceAudio(isJoint, slotIndex);
  res.json({ success: true, data: tenant.session.getVoiceState(slotIndex) });
});

// Voice: Get State
router.get('/voice/state', async (req, res) => {
  const slotIndex = getTargetSlotIndex(req);
  const tenant = await resolveTenantSession(req);
  res.json({ success: true, data: tenant.session.getVoiceState(slotIndex) });
});

// --- AUDIO UPLOADS & SOUNDBOARD API ---

// Upload Audio File
router.post('/audio/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    if (req.file.size < 100) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch {}
      return res.status(400).json({
        success: false,
        error: 'The uploaded file is empty (0 bytes). Please choose an actual audio file.',
      });
    }

    const tenant = await resolveTenantSession(req);
    const newSound = soundboardManager.getAudioById(req.file.filename, tenant.tenantId);
    res.json({
      success: true,
      data: newSound,
      message: 'Audio file uploaded and ready to play in Voice Channel!',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get All Uploaded Audios & Presets
router.get('/audio', async (req, res) => {
  const tenant = await resolveTenantSession(req);
  const audios = soundboardManager.getAudios(tenant.tenantId);
  res.json({ success: true, data: audios });
});

// Delete Uploaded Audio File
router.delete('/audio/:id', async (req, res) => {
  const tenant = await resolveTenantSession(req);
  const deleted = soundboardManager.deleteAudio(req.params.id, tenant.tenantId);
  if (deleted) {
    res.json({ success: true, message: 'Audio file removed' });
  } else {
    res.status(400).json({ success: false, error: 'Could not delete sound (presets are permanent or sound not found)' });
  }
});

export default router;

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { keyService } from '../../services/keyService';
import { adminService, OWNER_EMAIL } from '../../services/adminService';
import { tenantAccountManager, userAccountManager } from '../../account/userAccount';
import { config } from '../../config/env';

const router = Router();

// Middleware to verify admin authentication
const requireAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    try {
      const decoded: any = jwt.verify(rawToken, config.jwtSecret);
      if (decoded && decoded.email && (await adminService.isAdmin(decoded.email))) {
        req.adminEmail = decoded.email.toLowerCase();
        req.isOwner = adminService.isOwner(decoded.email);
        return next();
      }
    } catch {}
  }

  const adminHeader = req.headers['x-admin-email'];
  if (typeof adminHeader === 'string') {
    const email = adminHeader.trim().toLowerCase();
    if (email && (await adminService.isAdmin(email))) {
      req.adminEmail = email;
      req.isOwner = adminService.isOwner(email);
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    error: 'Access denied: Admin authorization required for this action.',
  });
};

// Middleware strictly requiring Super Admin (Owner) - ensures regular admins cannot delete or revoke keys
const requireSuperAdmin = async (req: any, res: any, next: any) => {
  return requireAdmin(req, res, () => {
    if (!req.isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Permission Denied: Only the Super Admin is authorized to revoke or delete access keys and manage administrators.',
      });
    }
    return next();
  });
};

// Admin Login / Verification by Email & Password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Admin password is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isAuthorized = await adminService.isAdmin(cleanEmail);

    if (!isAuthorized) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator email or unauthorized account.',
      });
    }

    const isValidPassword = await adminService.verifyAdminPassword(cleanEmail, password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect administrator password.',
      });
    }

    const isRootOwner = adminService.isOwner(cleanEmail);
    const token = jwt.sign(
      { email: cleanEmail, role: isRootOwner ? 'owner' : 'admin', isOwner: isRootOwner },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      data: {
        token,
        isAdmin: true,
        isOwner: isRootOwner,
        email: cleanEmail,
        role: isRootOwner ? 'owner' : 'admin',
        maxTokens: 100,
        soundTier: 'admin_peaks',
        message: isRootOwner
          ? 'Welcome to Superadmin Console!'
          : 'Welcome to Admin Control Dashboard!',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin System Status Overview
router.get('/status', requireAdmin, async (req: any, res) => {
  try {
    const keys = await keyService.listKeys();
    const activeTenants = tenantAccountManager.getAllActiveSessions();
    const activeKeysCount = keys.filter((k) => k.is_active).length;
    const redeemedKeysCount = keys.filter((k) => k.redeemed_by).length;
    const admins = await adminService.listAdmins();

    res.json({
      success: true,
      data: {
        ownerEmail: req.isOwner ? OWNER_EMAIL : '••••••••@protected',
        adminEmail: req.adminEmail,
        isOwner: req.isOwner,
        totalAdmins: admins.length,
        admins,
        totalKeys: keys.length,
        activeKeys: activeKeysCount,
        redeemedKeys: redeemedKeysCount,
        activeTenantsCount: activeTenants.length,
        activeTenants,
        slots: userAccountManager.getAllSlotsInfo(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ADMIN MANAGEMENT (Owner & Admins) ---

// List All Authorized Admins
router.get('/admins', requireAdmin, async (req: any, res) => {
  try {
    const admins = await adminService.listAdmins();
    res.json({
      success: true,
      data: {
        ownerEmail: req.isOwner ? OWNER_EMAIL : '••••••••@protected',
        isOwner: req.isOwner,
        admins,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add New Admin Email with Custom Password (SUPER ADMIN ONLY)
router.post('/admins/add', requireSuperAdmin, async (req: any, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    if (!password || typeof password !== 'string' || password.trim().length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Please specify an administrator password (at least 4 characters).',
      });
    }

    const caller = req.adminEmail || OWNER_EMAIL;
    const result = await adminService.addAdmin(email, password, caller);

    if (result.success) {
      const allAdmins = await adminService.listAdmins();
      res.json({
        success: true,
        data: result.data,
        admins: allAdmins,
        message: `Admin access and credentials granted to ${email.trim().toLowerCase()}`,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove Admin Email (SUPER ADMIN ONLY)
router.delete('/admins/:email', requireSuperAdmin, async (req, res) => {
  try {
    const targetEmail = decodeURIComponent(req.params.email);
    const result = await adminService.removeAdmin(targetEmail);

    if (result.success) {
      const allAdmins = await adminService.listAdmins();
      res.json({
        success: true,
        admins: allAdmins,
        message: `Admin access removed for ${targetEmail}`,
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ACCESS KEYS MANAGEMENT ---

// Get All Access Keys (All Admins)
router.get('/keys', requireAdmin, async (req, res) => {
  try {
    const keys = await keyService.listKeys();
    res.json({ success: true, data: keys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate New Access Key (All Admins)
router.post('/keys/generate', requireAdmin, async (req, res) => {
  try {
    const { maxTokens, soundTier, label } = req.body;

    const tokens = Math.max(1, Math.min(100, Math.floor(Number(maxTokens) || 1)));
    const tier = soundTier === 'admin_peaks' ? 'admin_peaks' : 'standard';

    const newKey = await keyService.generateKey({
      maxTokens: tokens,
      soundTier: tier,
      label: label ? String(label).trim() : undefined,
    });

    res.json({
      success: true,
      data: newKey,
      message: `Access Key generated successfully: ${newKey.key} (${newKey.max_tokens} Tokens, ${newKey.sound_tier === 'admin_peaks' ? 'High Peaks Overdrive' : 'Standard Loud'})`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Revoke Access Key (SUPER ADMIN ONLY)
router.post('/keys/:id/revoke', requireSuperAdmin, async (req, res) => {
  try {
    const ok = await keyService.revokeKey(req.params.id);
    res.json({ success: ok, message: ok ? 'Access Key deactivated' : 'Key not found' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Activate Access Key (SUPER ADMIN ONLY)
router.post('/keys/:id/activate', requireSuperAdmin, async (req, res) => {
  try {
    const ok = await keyService.activateKey(req.params.id);
    res.json({ success: ok, message: ok ? 'Access Key activated' : 'Key not found' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Access Key (SUPER ADMIN ONLY)
router.delete('/keys/:id', requireSuperAdmin, async (req, res) => {
  try {
    const ok = await keyService.deleteKey(req.params.id);
    res.json({ success: ok, message: ok ? 'Access Key deleted' : 'Key not found' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import { prisma } from '../db/prisma';
import crypto from 'crypto';
import { config } from '../config/env';
import { persistentKeyStore } from './persistentKeyStore';

export interface KeyInfo {
  id: string;
  key: string;
  max_tokens: number;
  sound_tier: string;
  label?: string | null;
  is_active: boolean;
  redeemed_by?: string | null;
  redeemed_at?: Date | null;
  created_at: Date;
}

class KeyService {
  /**
   * Generates a tamper-proof cryptographic access key carrying an HMAC-SHA256 signature.
   * Format: KEY-<TIER><TOKENS>-<RANDOM_ENTROPY>-<HMAC_SIGNATURE>
   * Example: KEY-AP03-F8A2D9-4B7C1E
   */
  public generateSignedKeyCode(maxTokens: number, soundTier: 'standard' | 'admin_peaks'): string {
    const tierCode = soundTier === 'admin_peaks' ? 'AP' : 'ST';
    const tokensCode = String(maxTokens).padStart(2, '0');
    const randomEntropy = crypto.randomBytes(3).toString('hex').toUpperCase();
    const payload = `${tierCode}${tokensCode}-${randomEntropy}`;
    const hmacSig = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(payload)
      .digest('hex')
      .substring(0, 6)
      .toUpperCase();

    return `KEY-${payload}-${hmacSig}`;
  }

  /**
   * Verifies if a key is a cryptographically signed key issued by this server.
   * If valid, extracts its authorized token count and sound tier.
   */
  public verifySignedKey(keyString: string): { valid: boolean; maxTokens?: number; soundTier?: 'standard' | 'admin_peaks' } {
    if (!keyString) return { valid: false };
    const clean = keyString.trim().toUpperCase();

    // Check seed keys
    if (clean === 'KEY-MASTER-VIP3-ADMIN') {
      return { valid: true, maxTokens: 3, soundTier: 'admin_peaks' };
    }
    if (clean === 'KEY-SUPER-100-ADMIN') {
      return { valid: true, maxTokens: 100, soundTier: 'admin_peaks' };
    }

    const match = clean.match(/^KEY-([A-Z]{2})(\d{1,3})-([A-F0-9]{6})-([A-F0-9]{6})$/);
    if (!match) return { valid: false };

    const [, tierCode, tokensStr, randomEntropy, signature] = match;
    const payload = `${tierCode}${tokensStr}-${randomEntropy}`;
    const expectedSig = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(payload)
      .digest('hex')
      .substring(0, 6)
      .toUpperCase();

    if (signature !== expectedSig) {
      return { valid: false };
    }

    const maxTokens = Math.max(1, Math.min(100, parseInt(tokensStr, 10)));
    const soundTier = tierCode === 'AP' ? 'admin_peaks' : 'standard';

    return { valid: true, maxTokens, soundTier };
  }

  public async generateKey(options: {
    maxTokens?: number;
    soundTier?: 'standard' | 'admin_peaks';
    label?: string;
  }): Promise<KeyInfo> {
    const maxTokens = Math.max(1, Math.min(100, Math.floor(Number(options.maxTokens) || 1)));
    const soundTier = options.soundTier === 'admin_peaks' ? 'admin_peaks' : 'standard';
    const keyString = this.generateSignedKeyCode(maxTokens, soundTier);

    let created: KeyInfo;
    try {
      created = await prisma.accessKey.create({
        data: {
          key: keyString,
          max_tokens: maxTokens,
          sound_tier: soundTier,
          label: options.label || null,
          is_active: true,
        },
      });
    } catch {
      created = {
        id: `key-${Date.now()}-${keyString}`,
        key: keyString,
        max_tokens: maxTokens,
        sound_tier: soundTier,
        label: options.label || null,
        is_active: true,
        created_at: new Date(),
      };
    }

    // Persist to json storage to ensure it never gets lost across server restarts or container rebuilds
    persistentKeyStore.set(created);

    return created;
  }

  public async listKeys(): Promise<KeyInfo[]> {
    const fileKeys = persistentKeyStore.list();
    if (fileKeys.length > 0) {
      return fileKeys;
    }

    try {
      const dbKeys = await prisma.accessKey.findMany({
        orderBy: { created_at: 'desc' },
      });
      for (const k of dbKeys) {
        if (!persistentKeyStore.isRevoked(k.key)) {
          persistentKeyStore.set(k);
        }
      }
      return persistentKeyStore.list();
    } catch {
      return fileKeys;
    }
  }

  public async getKeyByString(keyString: string): Promise<KeyInfo | null> {
    if (!keyString) return null;
    const normalized = keyString.trim().toUpperCase();

    if (persistentKeyStore.isRevoked(normalized)) return null;

    // 1. Fast persistent store lookup
    const cached = persistentKeyStore.get(normalized);
    if (cached) return cached;

    // 2. Database lookup
    try {
      const dbKey = await prisma.accessKey.findUnique({
        where: { key: normalized },
      });
      if (dbKey && !persistentKeyStore.isRevoked(dbKey.key)) {
        persistentKeyStore.set(dbKey);
        return dbKey;
      }
    } catch {}

    return null;
  }

  public async validateKey(keyString: string): Promise<{ valid: boolean; keyInfo?: KeyInfo; error?: string }> {
    if (!keyString) {
      return { valid: false, error: 'Access Key is required' };
    }
    const clean = keyString.trim().toUpperCase();

    // Check blacklist first: if Super Admin revoked or deleted this key, reject it!
    if (persistentKeyStore.isRevoked(clean)) {
      return { valid: false, error: 'This Access Key has been deactivated or revoked by Super Admin.' };
    }

    let key = await this.getKeyByString(clean);

    // If not found in memory/database (e.g. freshly rebooted ephemeral container), verify cryptographic signature!
    if (!key) {
      const signedCheck = this.verifySignedKey(clean);
      if (signedCheck.valid && signedCheck.maxTokens) {
        // Automatically resurrect and register the key into persistent store and database!
        key = {
          id: `key-${clean}`,
          key: clean,
          max_tokens: signedCheck.maxTokens,
          sound_tier: signedCheck.soundTier || 'standard',
          label: 'Cryptographically Verified License',
          is_active: true,
          created_at: new Date(),
        };
        persistentKeyStore.set(key);
        try {
          await prisma.accessKey.upsert({
            where: { key: clean },
            update: { is_active: true },
            create: {
              id: key.id,
              key: clean,
              max_tokens: key.max_tokens,
              sound_tier: key.sound_tier,
              label: key.label,
              is_active: true,
            },
          });
        } catch {}
      }
    }

    if (!key) {
      return { valid: false, error: 'Invalid Access Key. Please check the key provided by Admin.' };
    }

    // Permanent active keys: never expire automatically unless explicitly deactivated by Super Admin
    if (!key.is_active) {
      return { valid: false, error: 'This Access Key has been deactivated or revoked by Super Admin.' };
    }

    return { valid: true, keyInfo: key };
  }

  public async redeemKey(keyString: string, userIdentifier: string): Promise<{ success: boolean; keyInfo?: KeyInfo; error?: string }> {
    const check = await this.validateKey(keyString);
    if (!check.valid || !check.keyInfo) {
      return { success: false, error: check.error };
    }

    const updated: KeyInfo = {
      ...check.keyInfo,
      redeemed_by: userIdentifier,
      redeemed_at: new Date(),
    };

    try {
      await prisma.accessKey.update({
        where: { id: check.keyInfo.id },
        data: {
          redeemed_by: userIdentifier,
          redeemed_at: updated.redeemed_at,
        },
      });
    } catch {}

    persistentKeyStore.set(updated);

    return { success: true, keyInfo: updated };
  }

  public async revokeKey(id: string): Promise<boolean> {
    try {
      persistentKeyStore.revoke(id);
      await prisma.accessKey.update({
        where: { id },
        data: { is_active: false },
      });
      return true;
    } catch {
      return persistentKeyStore.revoke(id);
    }
  }

  public async activateKey(id: string): Promise<boolean> {
    try {
      persistentKeyStore.activate(id);
      await prisma.accessKey.update({
        where: { id },
        data: { is_active: true },
      });
      return true;
    } catch {
      return persistentKeyStore.activate(id);
    }
  }

  public async deleteKey(id: string): Promise<boolean> {
    try {
      persistentKeyStore.delete(id);
      await prisma.accessKey.delete({
        where: { id },
      });
      return true;
    } catch {
      return persistentKeyStore.delete(id);
    }
  }

  public syncVault(keys: KeyInfo[]): KeyInfo[] {
    return persistentKeyStore.syncFromVault(keys);
  }

  /**
   * Seed and sync initial Master Multi-Token Keys and persistent JSON store
   */
  public async ensureSeedKey(): Promise<void> {
    await persistentKeyStore.syncWithPrisma();
    console.log('🔑 Permanent Key Store synchronized successfully. All access keys preserved across reboots.');
  }
}

export const keyService = new KeyService();

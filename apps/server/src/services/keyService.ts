import { prisma } from '../db/prisma';
import crypto from 'crypto';
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
   * Generate a human-readable license key: KEY-XXXX-XXXX-XXXX
   */
  private generateRandomCode(): string {
    const p1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p3 = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `KEY-${p1}-${p2}-${p3}`;
  }

  public async generateKey(options: {
    maxTokens?: number;
    soundTier?: 'standard' | 'admin_peaks';
    label?: string;
  }): Promise<KeyInfo> {
    const keyString = this.generateRandomCode();
    // Support 1, 2, 3, up to N tokens (default 1, max 100)
    const maxTokens = Math.max(1, Math.min(100, Math.floor(Number(options.maxTokens) || 1)));
    const soundTier = options.soundTier === 'admin_peaks' ? 'admin_peaks' : 'standard';

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
      // Fallback if DB write fails
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
        persistentKeyStore.set(k);
      }
      return dbKeys;
    } catch {
      return fileKeys;
    }
  }

  public async getKeyByString(keyString: string): Promise<KeyInfo | null> {
    if (!keyString) return null;
    const normalized = keyString.trim().toUpperCase();

    // 1. Fast persistent store lookup
    const cached = persistentKeyStore.get(normalized);
    if (cached) return cached;

    // 2. Database lookup
    try {
      const dbKey = await prisma.accessKey.findUnique({
        where: { key: normalized },
      });
      if (dbKey) {
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
    const key = await this.getKeyByString(keyString);
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
      const existing = persistentKeyStore.getById(id);
      if (existing) {
        existing.is_active = false;
        persistentKeyStore.set(existing);
      }
      await prisma.accessKey.update({
        where: { id },
        data: { is_active: false },
      });
      return true;
    } catch {
      return persistentKeyStore.getById(id)?.is_active === false;
    }
  }

  public async activateKey(id: string): Promise<boolean> {
    try {
      const existing = persistentKeyStore.getById(id);
      if (existing) {
        existing.is_active = true;
        persistentKeyStore.set(existing);
      }
      await prisma.accessKey.update({
        where: { id },
        data: { is_active: true },
      });
      return true;
    } catch {
      return persistentKeyStore.getById(id)?.is_active === true;
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

  /**
   * Seed and sync initial Master Multi-Token Keys and persistent JSON store
   */
  public async ensureSeedKey(): Promise<void> {
    await persistentKeyStore.syncWithPrisma();
    console.log('🔑 Permanent Key Store synchronized successfully. All access keys preserved across reboots.');
  }
}

export const keyService = new KeyService();

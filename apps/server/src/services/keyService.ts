import { prisma } from '../db/prisma';
import crypto from 'crypto';

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

    const created = await prisma.accessKey.create({
      data: {
        key: keyString,
        max_tokens: maxTokens,
        sound_tier: soundTier,
        label: options.label || null,
        is_active: true,
      },
    });

    return created;
  }

  public async listKeys(): Promise<KeyInfo[]> {
    return prisma.accessKey.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  public async getKeyByString(keyString: string): Promise<KeyInfo | null> {
    if (!keyString) return null;
    const normalized = keyString.trim().toUpperCase();
    return prisma.accessKey.findUnique({
      where: { key: normalized },
    });
  }

  public async validateKey(keyString: string): Promise<{ valid: boolean; keyInfo?: KeyInfo; error?: string }> {
    if (!keyString) {
      return { valid: false, error: 'Access Key is required' };
    }
    const key = await this.getKeyByString(keyString);
    if (!key) {
      return { valid: false, error: 'Invalid Access Key. Please check the key provided by Admin.' };
    }
    if (!key.is_active) {
      return { valid: false, error: 'This Access Key has been deactivated or revoked by Admin.' };
    }
    return { valid: true, keyInfo: key };
  }

  public async redeemKey(keyString: string, userIdentifier: string): Promise<{ success: boolean; keyInfo?: KeyInfo; error?: string }> {
    const check = await this.validateKey(keyString);
    if (!check.valid || !check.keyInfo) {
      return { success: false, error: check.error };
    }

    const updated = await prisma.accessKey.update({
      where: { id: check.keyInfo.id },
      data: {
        redeemed_by: userIdentifier,
        redeemed_at: new Date(),
      },
    });

    return { success: true, keyInfo: updated };
  }

  public async revokeKey(id: string): Promise<boolean> {
    try {
      await prisma.accessKey.update({
        where: { id },
        data: { is_active: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  public async activateKey(id: string): Promise<boolean> {
    try {
      await prisma.accessKey.update({
        where: { id },
        data: { is_active: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  public async deleteKey(id: string): Promise<boolean> {
    try {
      await prisma.accessKey.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Seed an initial Master Multi-Token Key if database has zero keys
   */
  public async ensureSeedKey(): Promise<void> {
    const count = await prisma.accessKey.count();
    if (count === 0) {
      await prisma.accessKey.create({
        data: {
          key: 'KEY-MASTER-VIP3-ADMIN',
          max_tokens: 3,
          sound_tier: 'admin_peaks',
          label: 'Master Admin 3-Token Key',
          is_active: true,
        },
      });
      console.log('🔑 Master initial Access Key created: KEY-MASTER-VIP3-ADMIN (3 Tokens, High Peaks Overdrive)');
    }
  }
}

export const keyService = new KeyService();

import fs from 'fs';
import path from 'path';
import { KeyInfo } from './keyService';
import { prisma } from '../db/prisma';

const DATA_DIR = path.resolve(__dirname, '../../data');
const KEYS_FILE = path.join(DATA_DIR, 'keys_store.json');

class PersistentKeyStore {
  private keysMap: Map<string, KeyInfo> = new Map();
  private isLoaded: boolean = false;

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err: any) {
      console.warn('PersistentKeyStore: Failed to ensure data dir:', err.message);
    }
  }

  public load(): KeyInfo[] {
    this.ensureDataDir();
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.keysMap.clear();
          for (const item of parsed) {
            if (item && item.key) {
              const keyInfo: KeyInfo = {
                id: item.id || `key-${item.key}`,
                key: item.key.toUpperCase(),
                max_tokens: Number(item.max_tokens) || 1,
                sound_tier: item.sound_tier || 'standard',
                label: item.label || null,
                is_active: item.is_active !== false, // Default active, never expire automatically
                redeemed_by: item.redeemed_by || null,
                redeemed_at: item.redeemed_at ? new Date(item.redeemed_at) : null,
                created_at: item.created_at ? new Date(item.created_at) : new Date(),
              };
              this.keysMap.set(keyInfo.key, keyInfo);
            }
          }
          this.isLoaded = true;
          return Array.from(this.keysMap.values());
        }
      }
    } catch (err: any) {
      console.error('PersistentKeyStore: Failed to read keys_store.json:', err.message);
    }

    this.isLoaded = true;
    return Array.from(this.keysMap.values());
  }

  public saveAll(): void {
    this.ensureDataDir();
    try {
      const keysArray = Array.from(this.keysMap.values());
      fs.writeFileSync(KEYS_FILE, JSON.stringify(keysArray, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('PersistentKeyStore: Failed to write keys_store.json:', err.message);
    }
  }

  public get(keyString: string): KeyInfo | null {
    if (!this.isLoaded) this.load();
    const normalized = (keyString || '').trim().toUpperCase();
    return this.keysMap.get(normalized) || null;
  }

  public getById(id: string): KeyInfo | null {
    if (!this.isLoaded) this.load();
    for (const key of this.keysMap.values()) {
      if (key.id === id) return key;
    }
    return null;
  }

  public list(): KeyInfo[] {
    if (!this.isLoaded) this.load();
    return Array.from(this.keysMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public set(key: KeyInfo): void {
    if (!this.isLoaded) this.load();
    this.keysMap.set(key.key.toUpperCase(), {
      ...key,
      key: key.key.toUpperCase(),
      is_active: key.is_active !== false,
    });
    this.saveAll();
  }

  public delete(id: string): boolean {
    if (!this.isLoaded) this.load();
    let foundKey: string | null = null;
    for (const [k, v] of this.keysMap.entries()) {
      if (v.id === id || v.key === id.toUpperCase()) {
        foundKey = k;
        break;
      }
    }
    if (foundKey) {
      this.keysMap.delete(foundKey);
      this.saveAll();
      return true;
    }
    return false;
  }

  /**
   * Sync persistent file with Prisma SQLite to ensure dual persistence
   */
  public async syncWithPrisma(): Promise<void> {
    this.load();

    // Default Seed Keys if store is completely empty
    if (this.keysMap.size === 0) {
      const defaultSeeds: KeyInfo[] = [
        {
          id: 'seed-master-3',
          key: 'KEY-MASTER-VIP3-ADMIN',
          max_tokens: 3,
          sound_tier: 'admin_peaks',
          label: 'Master 3-Token Key (Permanent)',
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 'seed-super-100',
          key: 'KEY-SUPER-100-ADMIN',
          max_tokens: 100,
          sound_tier: 'admin_peaks',
          label: 'Super Admin 100-Token Key (Permanent)',
          is_active: true,
          created_at: new Date(),
        },
      ];

      for (const k of defaultSeeds) {
        this.keysMap.set(k.key, k);
      }
      this.saveAll();
    }

    // Sync all keys from persistent file to SQLite
    try {
      for (const item of this.keysMap.values()) {
        await prisma.accessKey.upsert({
          where: { key: item.key },
          update: {
            max_tokens: item.max_tokens,
            sound_tier: item.sound_tier,
            label: item.label,
            is_active: item.is_active,
            redeemed_by: item.redeemed_by,
            redeemed_at: item.redeemed_at,
          },
          create: {
            id: item.id,
            key: item.key,
            max_tokens: item.max_tokens,
            sound_tier: item.sound_tier,
            label: item.label,
            is_active: item.is_active,
            redeemed_by: item.redeemed_by,
            redeemed_at: item.redeemed_at,
            created_at: item.created_at,
          },
        });
      }

      // Also read any keys from SQLite that might not be in file yet
      const dbKeys = await prisma.accessKey.findMany();
      let updated = false;
      for (const dbKey of dbKeys) {
        if (!this.keysMap.has(dbKey.key.toUpperCase())) {
          this.keysMap.set(dbKey.key.toUpperCase(), {
            id: dbKey.id,
            key: dbKey.key.toUpperCase(),
            max_tokens: dbKey.max_tokens,
            sound_tier: dbKey.sound_tier,
            label: dbKey.label,
            is_active: dbKey.is_active,
            redeemed_by: dbKey.redeemed_by,
            redeemed_at: dbKey.redeemed_at,
            created_at: dbKey.created_at,
          });
          updated = true;
        }
      }
      if (updated) {
        this.saveAll();
      }
    } catch (err: any) {
      console.warn('PersistentKeyStore: SQLite sync notice:', err.message);
    }
  }
}

export const persistentKeyStore = new PersistentKeyStore();

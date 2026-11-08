import fs from 'fs';
import path from 'path';
import { KeyInfo } from './keyService';
import { prisma } from '../db/prisma';

const DATA_DIR = path.resolve(__dirname, '../../data');
const KEYS_FILE = path.join(DATA_DIR, 'keys_store.json');
const REVOKED_FILE = path.join(DATA_DIR, 'revoked_keys.json');

class PersistentKeyStore {
  private keysMap: Map<string, KeyInfo> = new Map();
  private revokedKeys: Set<string> = new Set();
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
    // 1. Load Revoked Blacklist (Keys deleted/revoked by Super Admin)
    try {
      if (fs.existsSync(REVOKED_FILE)) {
        const rawRev = fs.readFileSync(REVOKED_FILE, 'utf-8');
        const parsedRev = JSON.parse(rawRev);
        if (Array.isArray(parsedRev)) {
          this.revokedKeys = new Set(parsedRev.map((k: string) => String(k).trim().toUpperCase()));
        }
      }
    } catch (e: any) {
      console.warn('PersistentKeyStore: Failed to load revoked_keys.json:', e.message);
    }

    // 2. Load Keys Store
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.keysMap.clear();
          for (const item of parsed) {
            if (item && item.key) {
              const normKey = item.key.toUpperCase().trim();
              const isRevoked = this.revokedKeys.has(normKey) || item.is_active === false;
              const keyInfo: KeyInfo = {
                id: item.id || `key-${normKey}`,
                key: normKey,
                max_tokens: Number(item.max_tokens) || 1,
                sound_tier: item.sound_tier || 'standard',
                label: item.label || null,
                is_active: !isRevoked, // Only Super Admin can revoke; never auto-expire
                redeemed_by: item.redeemed_by || null,
                redeemed_at: item.redeemed_at ? new Date(item.redeemed_at) : null,
                created_at: item.created_at ? new Date(item.created_at) : new Date(),
              };
              this.keysMap.set(normKey, keyInfo);
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

    try {
      const revokedArray = Array.from(this.revokedKeys.values());
      fs.writeFileSync(REVOKED_FILE, JSON.stringify(revokedArray, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('PersistentKeyStore: Failed to write revoked_keys.json:', err.message);
    }
  }

  public isRevoked(keyString: string): boolean {
    if (!this.isLoaded) this.load();
    const normalized = (keyString || '').trim().toUpperCase();
    return this.revokedKeys.has(normalized);
  }

  public get(keyString: string): KeyInfo | null {
    if (!this.isLoaded) this.load();
    const normalized = (keyString || '').trim().toUpperCase();
    if (this.revokedKeys.has(normalized)) return null;
    return this.keysMap.get(normalized) || null;
  }

  public getById(id: string): KeyInfo | null {
    if (!this.isLoaded) this.load();
    for (const key of this.keysMap.values()) {
      if (key.id === id || key.key === id.toUpperCase()) {
        if (this.revokedKeys.has(key.key)) return null;
        return key;
      }
    }
    return null;
  }

  public list(): KeyInfo[] {
    if (!this.isLoaded) this.load();
    return Array.from(this.keysMap.values())
      .filter((k) => !this.revokedKeys.has(k.key))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public set(key: KeyInfo): void {
    if (!this.isLoaded) this.load();
    const normKey = key.key.toUpperCase().trim();
    if (this.revokedKeys.has(normKey)) return;

    this.keysMap.set(normKey, {
      ...key,
      key: normKey,
      is_active: key.is_active !== false,
    });
    this.saveAll();
  }

  /**
   * Only Super Admin can revoke a key
   */
  public revoke(idOrKey: string): boolean {
    if (!this.isLoaded) this.load();
    let targetKey: string | null = null;
    for (const [k, v] of this.keysMap.entries()) {
      if (v.id === idOrKey || v.key === idOrKey.toUpperCase()) {
        targetKey = k;
        v.is_active = false;
        break;
      }
    }
    if (!targetKey && idOrKey.startsWith('KEY-')) {
      targetKey = idOrKey.toUpperCase().trim();
    }

    if (targetKey) {
      this.revokedKeys.add(targetKey);
      this.saveAll();
      return true;
    }
    return false;
  }

  /**
   * Only Super Admin can reactivate a key
   */
  public activate(idOrKey: string): boolean {
    if (!this.isLoaded) this.load();
    let targetKey: string | null = null;
    for (const [k, v] of this.keysMap.entries()) {
      if (v.id === idOrKey || v.key === idOrKey.toUpperCase()) {
        targetKey = k;
        v.is_active = true;
        break;
      }
    }
    if (!targetKey && idOrKey.startsWith('KEY-')) {
      targetKey = idOrKey.toUpperCase().trim();
    }

    if (targetKey) {
      this.revokedKeys.delete(targetKey);
      this.saveAll();
      return true;
    }
    return false;
  }

  /**
   * Only Super Admin can permanently delete a key
   */
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
      this.revokedKeys.add(foundKey); // Add to permanent blacklist so self-signed duplicate cannot resurrect
      this.saveAll();
      return true;
    }
    return false;
  }

  /**
   * Sync keys from Admin browser vault to restore all created keys seamlessly
   */
  public syncFromVault(vaultKeys: KeyInfo[]): KeyInfo[] {
    if (!this.isLoaded) this.load();
    if (Array.isArray(vaultKeys)) {
      let updated = false;
      for (const item of vaultKeys) {
        if (item && item.key) {
          const normKey = item.key.toUpperCase().trim();
          if (!this.revokedKeys.has(normKey) && !this.keysMap.has(normKey)) {
            this.keysMap.set(normKey, {
              id: item.id || `key-${normKey}`,
              key: normKey,
              max_tokens: Number(item.max_tokens) || 1,
              sound_tier: item.sound_tier || 'standard',
              label: item.label || null,
              is_active: item.is_active !== false,
              created_at: item.created_at ? new Date(item.created_at) : new Date(),
            });
            updated = true;
          }
        }
      }
      if (updated) {
        this.saveAll();
      }
    }
    return this.list();
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
        if (!this.revokedKeys.has(k.key)) {
          this.keysMap.set(k.key, k);
        }
      }
      this.saveAll();
    }

    // Sync all keys from persistent file to SQLite
    try {
      for (const item of this.keysMap.values()) {
        if (this.revokedKeys.has(item.key)) continue;
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
        const normKey = dbKey.key.toUpperCase();
        if (!this.revokedKeys.has(normKey) && !this.keysMap.has(normKey)) {
          this.keysMap.set(normKey, {
            id: dbKey.id,
            key: normKey,
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

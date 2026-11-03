import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens_store.json');

export interface StoredTokenEntry {
  slotIndex: number;
  token: string;
  savedAt: number;
}

class PersistentTokenStore {
  // tenantId -> (slotIndex -> StoredTokenEntry)
  private store: Map<string, Map<number, StoredTokenEntry>> = new Map();
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
      console.warn('PersistentTokenStore: Failed to ensure data dir:', err.message);
    }
  }

  public load(): void {
    this.ensureDataDir();
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.store.clear();
          for (const [tenantId, slotsObj] of Object.entries(parsed)) {
            if (slotsObj && typeof slotsObj === 'object') {
              const slotMap = new Map<number, StoredTokenEntry>();
              for (const [slotStr, entry] of Object.entries(slotsObj as any)) {
                const slotIndex = parseInt(slotStr, 10);
                if (!isNaN(slotIndex) && entry && (entry as any).token) {
                  slotMap.set(slotIndex, {
                    slotIndex,
                    token: (entry as any).token,
                    savedAt: (entry as any).savedAt || Date.now(),
                  });
                }
              }
              this.store.set(tenantId, slotMap);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('PersistentTokenStore: Error loading tokens_store.json:', err.message);
    }
    this.isLoaded = true;
  }

  public saveAll(): void {
    this.ensureDataDir();
    try {
      const exportObj: Record<string, Record<string, StoredTokenEntry>> = {};
      for (const [tenantId, slotMap] of this.store.entries()) {
        exportObj[tenantId] = {};
        for (const [slotIndex, entry] of slotMap.entries()) {
          exportObj[tenantId][String(slotIndex)] = entry;
        }
      }
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(exportObj, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('PersistentTokenStore: Error saving tokens_store.json:', err.message);
    }
  }

  public saveToken(tenantId: string, slotIndex: number, token: string): void {
    if (!this.isLoaded) this.load();
    const cleanTenant = (tenantId || 'default').trim();
    if (!this.store.has(cleanTenant)) {
      this.store.set(cleanTenant, new Map());
    }

    const slotMap = this.store.get(cleanTenant)!;
    slotMap.set(slotIndex, {
      slotIndex,
      token,
      savedAt: Date.now(),
    });

    this.saveAll();
    console.log(`💾 [Tenant ${cleanTenant}][Slot ${slotIndex + 1}] Token persisted to permanent storage.`);
  }

  public removeToken(tenantId: string, slotIndex: number): void {
    if (!this.isLoaded) this.load();
    const cleanTenant = (tenantId || 'default').trim();
    const slotMap = this.store.get(cleanTenant);
    if (slotMap && slotMap.has(slotIndex)) {
      slotMap.delete(slotIndex);
      this.saveAll();
      console.log(`🗑️ [Tenant ${cleanTenant}][Slot ${slotIndex + 1}] Token removed from permanent storage.`);
    }
  }

  public getTokensForTenant(tenantId: string): Map<number, StoredTokenEntry> {
    if (!this.isLoaded) this.load();
    const cleanTenant = (tenantId || 'default').trim();
    return this.store.get(cleanTenant) || new Map();
  }
}

export const persistentTokenStore = new PersistentTokenStore();

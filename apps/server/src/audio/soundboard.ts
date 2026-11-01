import fs from 'fs';
import path from 'path';

export interface SoundItem {
  id: string;
  name: string;
  filename: string;
  size: number;
  url: string;
  path: string;
  created_at: string;
  isPreset?: boolean;
}

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/audio');
const PRESETS_DIR = path.resolve(__dirname, '../../uploads/audio/presets');
const TENANTS_DIR = path.resolve(__dirname, '../../uploads/audio/tenants');

// Pre-packaged high sound optimization presets stored directly on disk
const PRESETS: SoundItem[] = [
  {
    id: 'snd_airhorn',
    name: 'Airhorn Alert (Max Loud Boost)',
    filename: 'airhorn.mp3',
    size: 10240,
    url: '/uploads/audio/presets/airhorn.mp3',
    path: path.join(PRESETS_DIR, 'airhorn.mp3'),
    created_at: new Date().toISOString(),
    isPreset: true,
  },
  {
    id: 'snd_bass_drop',
    name: 'Bass Impact Overdrive (Loud 808)',
    filename: 'bass-drop.mp3',
    size: 20480,
    url: '/uploads/audio/presets/bass-drop.mp3',
    path: path.join(PRESETS_DIR, 'bass-drop.mp3'),
    created_at: new Date().toISOString(),
    isPreset: true,
  },
  {
    id: 'snd_victory',
    name: 'Level Up Victory Sound',
    filename: 'victory.mp3',
    size: 10240,
    url: '/uploads/audio/presets/victory.mp3',
    path: path.join(PRESETS_DIR, 'victory.mp3'),
    created_at: new Date().toISOString(),
    isPreset: true,
  },
  {
    id: 'snd_alert',
    name: 'Tactical Alert Chime (!)',
    filename: 'alert.mp3',
    size: 5120,
    url: '/uploads/audio/presets/alert.mp3',
    path: path.join(PRESETS_DIR, 'alert.mp3'),
    created_at: new Date().toISOString(),
    isPreset: true,
  },
];

class SoundboardManager {
  constructor() {
    this.ensureDir();
  }

  private ensureDir() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(PRESETS_DIR)) {
      fs.mkdirSync(PRESETS_DIR, { recursive: true });
    }
    if (!fs.existsSync(TENANTS_DIR)) {
      fs.mkdirSync(TENANTS_DIR, { recursive: true });
    }
  }

  public sanitizeTenantId(tenantId?: string): string {
    if (!tenantId) return 'default';
    return tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  public getTenantUploadsDir(tenantId?: string): string {
    this.ensureDir();
    const cleanId = this.sanitizeTenantId(tenantId);
    const tenantDir = path.join(TENANTS_DIR, cleanId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    return tenantDir;
  }

  public getAudios(tenantId?: string): SoundItem[] {
    this.ensureDir();
    const userAudios: SoundItem[] = [];

    if (tenantId) {
      const cleanId = this.sanitizeTenantId(tenantId);
      const tenantDir = path.join(TENANTS_DIR, cleanId);
      if (fs.existsSync(tenantDir)) {
        const files = fs.readdirSync(tenantDir);
        for (const file of files) {
          const filePath = path.join(tenantDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              if (stat.size < 100) {
                try { fs.unlinkSync(filePath); } catch {}
                continue;
              }
              userAudios.push({
                id: file,
                name: file.replace(/^[0-9]+-/, '').replace(/\.[^/.]+$/, ''),
                filename: file,
                size: stat.size,
                url: `/uploads/audio/tenants/${cleanId}/${file}`,
                path: filePath,
                created_at: stat.birthtime.toISOString(),
                isPreset: false,
              });
            }
          } catch {}
        }
      }
    }

    // Return tenant's custom uploaded audios first, followed by global presets
    return [...userAudios, ...PRESETS];
  }

  public getAudioById(id: string, tenantId?: string): SoundItem | undefined {
    // Check presets first
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) return preset;

    // Check tenant custom uploads
    if (tenantId) {
      const cleanId = this.sanitizeTenantId(tenantId);
      const tenantDir = path.join(TENANTS_DIR, cleanId);
      const filePath = path.join(tenantDir, id);
      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          return {
            id,
            name: id.replace(/^[0-9]+-/, '').replace(/\.[^/.]+$/, ''),
            filename: id,
            size: stat.size,
            url: `/uploads/audio/tenants/${cleanId}/${id}`,
            path: filePath,
            created_at: stat.birthtime.toISOString(),
            isPreset: false,
          };
        } catch {}
      }
    }

    // Fallback: check all audios for this tenant
    const list = this.getAudios(tenantId);
    return list.find((item) => item.id === id);
  }

  public deleteAudio(id: string, tenantId?: string): boolean {
    if (PRESETS.some((p) => p.id === id)) return false;

    if (tenantId) {
      const cleanId = this.sanitizeTenantId(tenantId);
      const tenantDir = path.join(TENANTS_DIR, cleanId);
      const filePath = path.join(tenantDir, id);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          return true;
        } catch {}
      }
    }

    return false;
  }
}

export const soundboardManager = new SoundboardManager();
export { UPLOADS_DIR, PRESETS_DIR, TENANTS_DIR };

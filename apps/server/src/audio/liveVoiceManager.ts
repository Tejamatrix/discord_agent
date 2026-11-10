import { PassThrough } from 'stream';
import { UserAccountSession } from '../account/userAccount';

interface LiveSession {
  stream: PassThrough;
  tenantId: string;
  startedAt: number;
}

class LiveVoiceManager {
  private activeSessions: Map<string, LiveSession> = new Map();

  public async startLiveStream(
    session: UserAccountSession,
    tenantId: string,
    options: {
      gainMultiplier?: number;
      soundTier?: 'standard' | 'admin_peaks';
      isAdmin?: boolean;
      broadcastAll?: boolean;
      slotIndex?: number;
    } = {}
  ): Promise<boolean> {
    const cleanTenant = (tenantId || 'default').trim();

    // End existing session if any
    this.stopLiveStream(cleanTenant);

    const masterStream = new PassThrough();
    this.activeSessions.set(cleanTenant, {
      stream: masterStream,
      tenantId: cleanTenant,
      startedAt: Date.now(),
    });

    const gain = options.gainMultiplier || (options.isAdmin || options.soundTier === 'admin_peaks' ? 3.5 : 2.5);
    const broadcast = options.broadcastAll !== false;

    console.log(`🎙️ [Live Voice] Starting live microphone broadcast for tenant: ${cleanTenant} (Gain: ${gain}x, BroadcastAll: ${broadcast})`);

    try {
      await session.playVoiceAudio(
        masterStream,
        gain,
        options.soundTier || 'standard',
        options.isAdmin || false,
        broadcast,
        options.slotIndex,
        'live-voice',
        '🎤 Live Voice (Speak Out)'
      );
      return true;
    } catch (err: any) {
      console.error(`[Live Voice] Failed to start live voice playback for ${cleanTenant}:`, err.message);
      this.stopLiveStream(cleanTenant);
      throw err;
    }
  }

  public writeChunk(tenantId: string, chunk: Buffer | ArrayBuffer | Uint8Array): void {
    const cleanTenant = (tenantId || 'default').trim();
    const active = this.activeSessions.get(cleanTenant);
    if (active && active.stream && !active.stream.destroyed) {
      try {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any);
        active.stream.write(buffer);
      } catch (err: any) {
        console.warn(`[Live Voice] Error writing chunk for ${cleanTenant}:`, err.message);
      }
    }
  }

  public stopLiveStream(tenantId: string): void {
    const cleanTenant = (tenantId || 'default').trim();
    const active = this.activeSessions.get(cleanTenant);
    if (active) {
      try {
        if (!active.stream.destroyed) {
          active.stream.end();
        }
      } catch {}
      this.activeSessions.delete(cleanTenant);
      console.log(`⏹️ [Live Voice] Live microphone broadcast stopped for tenant: ${cleanTenant}`);
    }
  }

  public isLive(tenantId: string): boolean {
    const cleanTenant = (tenantId || 'default').trim();
    return this.activeSessions.has(cleanTenant);
  }
}

export const liveVoiceManager = new LiveVoiceManager();

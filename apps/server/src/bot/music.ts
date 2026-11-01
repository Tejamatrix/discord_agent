import { MusicSession, MusicTrack, WS_EVENTS } from '@hub/shared';
import { prisma } from '../db/prisma';
import { socketService } from '../socket';
import { voiceManager } from './voice';

interface InternalSessionState {
  guildId: string;
  voiceChannelId: string | null;
  voiceChannelName?: string | null;
  currentTrack: MusicTrack | null;
  playbackStatus: 'playing' | 'paused' | 'stopped' | 'idle';
  volume: number;
  positionSeconds: number;
  durationSeconds: number;
  repeatMode: 'off' | 'track' | 'queue';
  shuffle: boolean;
  timerInterval?: NodeJS.Timeout;
}

class MusicManager {
  private sessions: Map<string, InternalSessionState> = new Map();

  constructor() {
    // Start playback ticker for advancing playback position
    setInterval(() => {
      this.sessions.forEach((session, guildId) => {
        if (session.playbackStatus === 'playing' && session.currentTrack) {
          session.positionSeconds += 1;
          if (session.positionSeconds >= session.durationSeconds) {
            // Track completed -> skip to next track in queue
            this.skip(guildId);
          } else if (session.positionSeconds % 2 === 0) {
            // Broadcast live time updates every 2 seconds
            this.broadcastState(guildId);
          }
        }
      });
    }, 1000);
  }

  public async getSession(guildId: string): Promise<MusicSession> {
    let session = this.sessions.get(guildId);
    if (!session) {
      // Fetch or init from DB
      const dbSession = await prisma.musicSession.findUnique({
        where: { guild_id: guildId },
      });

      let track: MusicTrack | null = null;
      if (dbSession?.current_track) {
        try {
          track = JSON.parse(dbSession.current_track);
        } catch {
          track = null;
        }
      }

      session = {
        guildId,
        voiceChannelId: dbSession?.voice_channel_id || null,
        voiceChannelName: dbSession?.voice_channel_id ? 'General Voice' : null,
        currentTrack: track,
        playbackStatus: (dbSession?.playback_status as any) || 'idle',
        volume: dbSession?.volume || 80,
        positionSeconds: 0,
        durationSeconds: track?.duration || 180,
        repeatMode: 'off',
        shuffle: false,
      };

      this.sessions.set(guildId, session);
    }

    return this.serializeSession(session);
  }

  public async play(guildId: string, track: MusicTrack, voiceChannelId?: string): Promise<MusicSession> {
    const session = await this.ensureSession(guildId);

    if (voiceChannelId) {
      await voiceManager.connect(guildId, voiceChannelId);
      session.voiceChannelId = voiceChannelId;
    }

    session.currentTrack = track;
    session.playbackStatus = 'playing';
    session.positionSeconds = 0;
    session.durationSeconds = track.duration || 180;

    // Update DB
    await prisma.musicSession.upsert({
      where: { guild_id: guildId },
      update: {
        current_track: JSON.stringify(track),
        playback_status: 'playing',
        voice_channel_id: session.voiceChannelId,
      },
      create: {
        guild_id: guildId,
        current_track: JSON.stringify(track),
        playback_status: 'playing',
        voice_channel_id: session.voiceChannelId,
        volume: session.volume,
      },
    });

    this.broadcastState(guildId);
    return this.serializeSession(session);
  }

  public async pause(guildId: string): Promise<MusicSession> {
    const session = await this.ensureSession(guildId);
    if (session.playbackStatus === 'playing') {
      session.playbackStatus = 'paused';
      await prisma.musicSession.updateMany({
        where: { guild_id: guildId },
        data: { playback_status: 'paused' },
      });
      this.broadcastState(guildId);
    }
    return this.serializeSession(session);
  }

  public async resume(guildId: string): Promise<MusicSession> {
    const session = await this.ensureSession(guildId);
    if (session.playbackStatus === 'paused') {
      session.playbackStatus = 'playing';
      await prisma.musicSession.updateMany({
        where: { guild_id: guildId },
        data: { playback_status: 'playing' },
      });
      this.broadcastState(guildId);
    }
    return this.serializeSession(session);
  }

  public async stop(guildId: string): Promise<MusicSession> {
    const session = await this.ensureSession(guildId);
    session.playbackStatus = 'stopped';
    session.currentTrack = null;
    session.positionSeconds = 0;

    await prisma.musicSession.updateMany({
      where: { guild_id: guildId },
      data: {
        playback_status: 'stopped',
        current_track: null,
      },
    });

    this.broadcastState(guildId);
    return this.serializeSession(session);
  }

  public async skip(guildId: string): Promise<MusicSession> {
    const session = await this.ensureSession(guildId);

    // Get next item in queue from DB
    const dbSession = await prisma.musicSession.findUnique({
      where: { guild_id: guildId },
      include: {
        queue: {
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    if (dbSession && dbSession.queue.length > 0) {
      const nextItem = dbSession.queue[0];
      // Remove popped item from queue
      await prisma.musicQueue.delete({ where: { id: nextItem.id } });

      const newTrack: MusicTrack = {
        id: nextItem.id,
        title: nextItem.track_title,
        source_reference: nextItem.source_reference,
        duration: 210,
        artist: 'Queued Stream',
      };

      return this.play(guildId, newTrack);
    } else {
      return this.stop(guildId);
    }
  }

  public async setVolume(guildId: string, volume: number): Promise<MusicSession> {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    const session = await this.ensureSession(guildId);
    session.volume = clamped;

    await prisma.musicSession.updateMany({
      where: { guild_id: guildId },
      data: { volume: clamped },
    });

    this.broadcastState(guildId);
    return this.serializeSession(session);
  }

  public async addToQueue(guildId: string, track: MusicTrack): Promise<any> {
    const sessionRecord = await prisma.musicSession.upsert({
      where: { guild_id: guildId },
      update: {},
      create: { guild_id: guildId, playback_status: 'idle', volume: 80 },
    });

    const queueCount = await prisma.musicQueue.count({
      where: { session_id: sessionRecord.id },
    });

    const queueItem = await prisma.musicQueue.create({
      data: {
        session_id: sessionRecord.id,
        track_title: track.title,
        source_reference: track.source_reference,
        position: queueCount + 1,
      },
    });

    // If nothing currently playing, start playing immediately!
    const currentSession = await this.getSession(guildId);
    if (currentSession.playback_status === 'idle' || currentSession.playback_status === 'stopped') {
      await this.play(guildId, track);
    }

    socketService.emitToGuild(guildId, WS_EVENTS.QUEUE_UPDATED, { guildId });
    return queueItem;
  }

  public async getQueue(guildId: string): Promise<any[]> {
    const session = await prisma.musicSession.findUnique({
      where: { guild_id: guildId },
      include: {
        queue: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return session?.queue || [];
  }

  public async removeQueueItem(itemId: string, guildId: string): Promise<boolean> {
    await prisma.musicQueue.delete({ where: { id: itemId } });
    socketService.emitToGuild(guildId, WS_EVENTS.QUEUE_UPDATED, { guildId });
    return true;
  }

  private async ensureSession(guildId: string): Promise<InternalSessionState> {
    let session = this.sessions.get(guildId);
    if (!session) {
      await this.getSession(guildId);
      session = this.sessions.get(guildId)!;
    }
    return session;
  }

  private serializeSession(internal: InternalSessionState): MusicSession {
    return {
      id: `ms_${internal.guildId}`,
      guild_id: internal.guildId,
      voice_channel_id: internal.voiceChannelId,
      voice_channel_name: internal.voiceChannelName,
      current_track: internal.currentTrack,
      playback_status: internal.playbackStatus,
      volume: internal.volume,
      repeat_mode: internal.repeatMode,
      shuffle: internal.shuffle,
      position_seconds: internal.positionSeconds,
      duration_seconds: internal.durationSeconds,
    };
  }

  private broadcastState(guildId: string) {
    const internal = this.sessions.get(guildId);
    if (internal) {
      socketService.emitToGuild(guildId, WS_EVENTS.MUSIC_STATE_CHANGED, this.serializeSession(internal));
    }
  }
}

export const musicManager = new MusicManager();

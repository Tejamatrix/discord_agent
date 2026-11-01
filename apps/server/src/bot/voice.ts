import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnection,
  VoiceConnectionStatus,
  AudioPlayer,
  createAudioPlayer,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { botService } from './client';
import { prisma } from '../db/prisma';

export interface VoiceSessionState {
  guildId: string;
  channelId: string | null;
  channelName?: string | null;
  status: 'connected' | 'connecting' | 'disconnected';
  connection?: VoiceConnection;
  player?: AudioPlayer;
}

class VoiceManager {
  private sessions: Map<string, VoiceSessionState> = new Map();

  public async connect(guildId: string, channelId: string, channelName?: string): Promise<boolean> {
    try {
      if (botService.client && botService.isConnected) {
        const guild = botService.client.guilds.cache.get(guildId);
        if (guild) {
          const connection = joinVoiceChannel({
            channelId,
            guildId,
            adapterCreator: guild.voiceAdapterCreator as any,
          });

          const player = createAudioPlayer({
            behaviors: {
              noSubscriber: NoSubscriberBehavior.Pause,
            },
          });

          connection.subscribe(player);

          this.sessions.set(guildId, {
            guildId,
            channelId,
            channelName: channelName || channelId,
            status: 'connected',
            connection,
            player,
          });

          return true;
        }
      }

      // Standalone / Simulation mode
      this.sessions.set(guildId, {
        guildId,
        channelId,
        channelName: channelName || 'General Voice',
        status: 'connected',
      });

      // Update in DB
      await prisma.musicSession.upsert({
        where: { guild_id: guildId },
        update: { voice_channel_id: channelId },
        create: {
          guild_id: guildId,
          voice_channel_id: channelId,
          playback_status: 'idle',
          volume: 80,
        },
      });

      return true;
    } catch (err) {
      console.error('Error connecting to voice channel:', err);
      return false;
    }
  }

  public async disconnect(guildId: string): Promise<boolean> {
    try {
      const existing = this.sessions.get(guildId);
      if (existing?.connection) {
        existing.connection.destroy();
      } else {
        const conn = getVoiceConnection(guildId);
        if (conn) conn.destroy();
      }

      this.sessions.set(guildId, {
        guildId,
        channelId: null,
        status: 'disconnected',
      });

      await prisma.musicSession.updateMany({
        where: { guild_id: guildId },
        data: {
          voice_channel_id: null,
          playback_status: 'stopped',
        },
      });

      return true;
    } catch (err) {
      console.error('Error disconnecting voice:', err);
      return false;
    }
  }

  public getSession(guildId: string): VoiceSessionState | undefined {
    return this.sessions.get(guildId);
  }

  public getOrCreatePlayer(guildId: string): AudioPlayer | undefined {
    const session = this.sessions.get(guildId);
    if (!session) return undefined;
    if (!session.player) {
      session.player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });
      if (session.connection) {
        session.connection.subscribe(session.player);
      }
    }
    return session.player;
  }
}

export const voiceManager = new VoiceManager();

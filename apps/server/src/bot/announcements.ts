import { botService } from './client';
import { prisma } from '../db/prisma';
import { Announcement } from '@hub/shared';
import { TextChannel } from 'discord.js';

class AnnouncementService {
  public async sendAnnouncement(
    guildId: string,
    channelId: string,
    message: string,
    userId: string,
    tts: boolean = false
  ): Promise<Announcement> {
    // If bot client is live and has access to channel
    if (botService.client && botService.isConnected) {
      try {
        const channel = await botService.client.channels.fetch(channelId);
        if (channel && channel.isTextBased() && 'send' in channel) {
          await (channel as TextChannel).send({
            content: message,
            tts: tts,
          });
        }
      } catch (err) {
        console.warn(`Failed to dispatch message to Discord channel ${channelId}:`, err);
      }
    }

    // Persist to database
    const saved = await prisma.announcement.create({
      data: {
        guild_id: guildId,
        channel_id: channelId,
        message,
        created_by: userId,
      },
      include: {
        user: true,
      },
    });

    // Record in activity log
    await prisma.activityLog.create({
      data: {
        user_id: userId,
        guild_id: guildId,
        action: `Sent announcement${tts ? ' (TTS)' : ''} to channel`,
        status: 'success',
      },
    });

    return {
      id: saved.id,
      guild_id: saved.guild_id,
      channel_id: saved.channel_id,
      channel_name: 'announcements',
      message: saved.message,
      created_by: saved.created_by,
      created_by_name: saved.user?.username || 'Admin',
      created_at: saved.created_at.toISOString(),
      tts,
    };
  }

  public async getHistory(guildId: string): Promise<Announcement[]> {
    const list = await prisma.announcement.findMany({
      where: { guild_id: guildId },
      include: { user: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return list.map((a) => ({
      id: a.id,
      guild_id: a.guild_id,
      channel_id: a.channel_id,
      channel_name: 'announcements',
      message: a.message,
      created_by: a.created_by,
      created_by_name: a.user?.username || 'Admin',
      created_at: a.created_at.toISOString(),
    }));
  }
}

export const announcementService = new AnnouncementService();

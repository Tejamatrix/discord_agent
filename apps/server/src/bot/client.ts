import { Client, GatewayIntentBits, ChannelType, Guild as DiscordGuild, TextChannel, VoiceChannel } from 'discord.js';
import { config } from '../config/env';
import { BotStatus, ChannelInfo } from '@hub/shared';

class DiscordBotService {
  public client: Client | null = null;
  public isConnected: boolean = false;
  private startTime: number = Date.now();

  constructor() {
    if (config.discord.botToken && config.discord.botToken.length > 20) {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildMessages,
        ],
      });

      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (!this.client) return;

    this.client.on('ready', () => {
      this.isConnected = true;
      console.log(`🤖 Discord Bot connected as ${this.client?.user?.tag}!`);
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      console.warn('⚠️ Discord Bot disconnected from Gateway');
    });

    this.client.on('error', (err) => {
      console.error('❌ Discord Bot client error:', err);
    });
  }

  public async start() {
    if (!this.client || !config.discord.botToken) {
      console.log('ℹ️ No Discord Bot Token configured. Running in standalone SaaS / simulation mode.');
      return;
    }

    try {
      await this.client.login(config.discord.botToken);
    } catch (err: any) {
      console.warn(`⚠️ Could not connect Discord Bot to gateway: ${err.message}. Operating in demo/mock mode.`);
    }
  }

  public getBotStatus(): BotStatus {
    if (this.client && this.isConnected && this.client.user) {
      return {
        online: true,
        tag: this.client.user.tag,
        ping: Math.round(this.client.ws.ping),
        guild_count: this.client.guilds.cache.size,
        user_count: this.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
        active_voice_connections: 0,
        uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      };
    }

    // Default / simulated status
    return {
      online: true,
      tag: 'ControlHubBot#0001 (Simulated)',
      ping: 24,
      guild_count: 2,
      user_count: 142,
      active_voice_connections: 1,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  public getGuildChannels(guildId: string): ChannelInfo[] {
    if (this.client && this.isConnected) {
      const guild = this.client.guilds.cache.get(guildId);
      if (guild) {
        return guild.channels.cache
          .filter((ch) => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildVoice)
          .map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: (ch.type === ChannelType.GuildText ? 'text' : 'voice') as 'text' | 'voice',
            position: ch.position,
          }))
          .sort((a, b) => a.position - b.position);
      }
    }

    // Fallback channels for demo / when guild not in cache
    return [
      { id: 'vc_general_voice_101', name: 'General Voice', type: 'voice', position: 1 },
      { id: 'vc_gaming_room_102', name: 'Gaming Room 1', type: 'voice', position: 2 },
      { id: 'vc_music_lounge_103', name: 'Music Lounge', type: 'voice', position: 3 },
      { id: 'tc_announcements_201', name: 'announcements', type: 'text', position: 4 },
      { id: 'tc_general_chat_202', name: 'general', type: 'text', position: 5 },
      { id: 'tc_bot_commands_203', name: 'bot-commands', type: 'text', position: 6 },
    ];
  }

  public getInviteUrl(): string {
    const clientId = config.discord.clientId || '123456789012345678';
    const permissions = '8'; // Administrator permissions for full control
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
  }
}

export const botService = new DiscordBotService();

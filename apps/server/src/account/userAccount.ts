import { Client, WebSocketShard } from 'discord.js-selfbot-v13';
import {
  joinVoiceChannel as djsJoinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
  StreamType,
} from '@discordjs/voice';
import fs from 'fs';
import { PassThrough, Readable } from 'stream';
import { socketService } from '../socket';
import { persistentTokenStore } from '../services/persistentTokenStore';

export interface UserAccountProfile {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar: string | null;
  avatar_url: string;
  banner?: string | null;
  accent_color?: number | null;
  email?: string | null;
  phone?: string | null;
  mfa_enabled?: boolean;
  premium_type?: number;
  token: string;
}

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  icon_url: string;
  owner: boolean;
  permissions: string;
  approximate_member_count?: number;
}

export interface UserChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement' | 'category' | 'other';
  position: number;
  canJoin?: boolean;
  userLimit?: number;
}

export interface VoiceStateInfo {
  connected: boolean;
  guildId: string | null;
  channelId: string | null;
  channelName?: string | null;
  volume: number;
  selfMute: boolean;
  selfDeaf: boolean;
  isPlayingAudio?: boolean;
  currentSoundId?: string | null;
  currentSoundName?: string | null;
}

export interface SlotSummary {
  slot: number;
  connected: boolean;
  profile: UserAccountProfile | null;
  voiceState: VoiceStateInfo;
}

/**
 * Isolated Account Slot representing a single Discord user connection
 */
export class AccountSlot {
  public slotIndex: number;
  public tenantId: string;
  public getSessionSlots?: () => SlotSummary[];

  public isConnected: boolean = false;
  public profile: UserAccountProfile | null = null;
  public client: Client | null = null;
  public currentToken: string | null = null;

  // Real-time Voice Session & Audio Engine
  public djsVoiceConnection: any = null;
  public audioPlayer: any = null;
  public currentResource: any = null;
  public currentVoiceConnection: any = null;
  public currentDispatcher: any = null;
  public currentVoiceChannelId: string | null = null;
  public currentVoiceGuildId: string | null = null;
  public currentVoiceChannelName: string | null = null;
  public currentVolume: number = 100;
  public selfMute: boolean = false;
  public selfDeaf: boolean = false;
  public isPlayingAudio: boolean = false;
  public currentPlayingSoundId: string | null = null;
  public currentPlayingSoundName: string | null = null;

  constructor(slotIndex: number, tenantId: string = 'default', getSessionSlots?: () => SlotSummary[]) {
    this.slotIndex = slotIndex;
    this.tenantId = tenantId;
    this.getSessionSlots = getSessionSlots;
  }

  public notifyState() {
    const slots = this.getSessionSlots ? this.getSessionSlots() : [this.getSummary()];
    socketService.emitToTenant(this.tenantId, 'account:voice_state', { slot: this.slotIndex, ...this.getVoiceState() });
    socketService.emitToTenant(this.tenantId, 'account:slots_update', slots);
  }

  public getSummary(): SlotSummary {
    return {
      slot: this.slotIndex,
      connected: this.isConnected,
      profile: this.profile,
      voiceState: this.getVoiceState(),
    };
  }

  public findActiveVoiceChannel(): { guildId: string; channelId: string; channelName: string; channel: any } | null {
    if (!this.client || !this.client.user) return null;
    const userId = this.client.user.id;
    for (const guild of this.client.guilds.cache.values()) {
      const vs = guild.voiceStates?.cache.get(userId);
      if (vs && vs.channelId) {
        const ch = (vs.channel || guild.channels.cache.get(vs.channelId)) as any;
        return {
          guildId: guild.id,
          channelId: vs.channelId,
          channelName: ch?.name || 'Voice Channel',
          channel: ch,
        };
      }
    }
    return null;
  }

  public ensureAudioPlayer() {
    if (!this.audioPlayer) {
      this.audioPlayer = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      this.audioPlayer.on('stateChange', (oldState: any, newState: any) => {
        console.log(`🎵 [Player State Slot ${this.slotIndex + 1}] ${oldState.status} -> ${newState.status}`);
      });

      this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
        console.log(`🔊 [Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Audio stream playing in VC`);
        this.isPlayingAudio = true;
        this.notifyState();
      });

      this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log(`⏹️ [Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Audio playback completed`);
        this.isPlayingAudio = false;
        this.currentPlayingSoundId = null;
        this.currentPlayingSoundName = null;
        this.notifyState();
      });

      this.audioPlayer.on('error', (err: any) => {
        console.error(`Audio player error on slot ${this.slotIndex + 1}:`, err.message);
        this.isPlayingAudio = false;
        this.currentPlayingSoundId = null;
        this.currentPlayingSoundName = null;
        this.notifyState();
      });
    }
  }

  public async connectWithToken(token: string): Promise<UserAccountProfile> {
    console.log(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Authenticating token via Discord Gateway...`);

    const sanitizedToken = token
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/^(Bot|Bearer)\s*/i, '')
      .trim();

    if (!sanitizedToken || sanitizedToken.length < 30) {
      throw new Error('Invalid token: Discord tokens are typically 60-90 characters long. Make sure you pasted the full token.');
    }

    // 1. Tear down existing connection if any
    await this.disconnect();
    this.currentToken = sanitizedToken;

    // 2. Initialize discord.js-selfbot-v13 Client with instant ready handling
    const client = new Client({
      checkUpdate: false,
      autoRedeemNitro: false,
      waitGuildTimeout: 0, // Do not wait for 100+ guilds to finish streaming before emitting ready
      retryLimit: 1,
      restRequestTimeout: 15000,
    } as any);

    // Direct WebSocket Gateway connection (bypasses REST /gateway endpoint that Cloudflare rate limits on datacenters)
    (client.ws as any).connect = async function () {
      const gatewayURL = 'wss://gateway.discord.gg';
      this.gateway = `${gatewayURL}/`;
      this.totalShards = 1;
      this.shardQueue = new Set([0].map((id: number) => new (WebSocketShard as any)(this, id)));
      return this.createShards();
    };

    client.on('debug', (info: string) => {
      if (info.includes('Heartbeat') || info.includes('ping') || info.includes('Latency')) return;
      console.log(`[Slot ${this.slotIndex + 1} Debug]`, info);
    });

    this.client = client;

    // Attach Voice & Guild event listeners
    client.on('voiceStateUpdate', (oldState: any, newState: any) => {
      if (newState.id === client.user?.id) {
        if (newState.channelId) {
          this.currentVoiceGuildId = newState.guild?.id || this.currentVoiceGuildId;
          this.currentVoiceChannelId = newState.channelId;
          this.currentVoiceChannelName = newState.channel?.name || this.currentVoiceChannelName;
          this.selfMute = Boolean(newState.selfMute);
          this.selfDeaf = Boolean(newState.selfDeaf);
        } else {
          this.currentVoiceGuildId = null;
          this.currentVoiceChannelId = null;
          this.currentVoiceChannelName = null;
          this.isPlayingAudio = false;
        }
        this.notifyState();
      }
    });

    // 3. Connect via Gateway with instant RAW packet recognition and fast error events
    await new Promise<void>((resolve, reject) => {
      let isSettled = false;

      const finishAuth = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          this.isConnected = true;
          console.log(`✅ [Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Gateway authenticated as ${client.user?.tag || 'User'} (${client.user?.id || 'id'})`);

          // Check if user is already in a VC
          const active = this.findActiveVoiceChannel();
          if (active) {
            this.currentVoiceGuildId = active.guildId;
            this.currentVoiceChannelId = active.channelId;
            this.currentVoiceChannelName = active.channelName;
          }
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          if (client.user) {
            resolve();
          } else {
            try { client.destroy(); } catch {}
            reject(new Error('Connection timed out. Discord did not respond in time. Please verify your token.'));
          }
        }
      }, 30000);

      client.once('ready', finishAuth);

      // Instant gateway RAW packet listener - fires within ~500ms of Gateway handshake
      (client as any).on('raw', (packet: any) => {
        if (packet?.t === 'READY' && packet?.d?.user) {
          finishAuth();
        }
      });

      // Catch Gateway disconnection or authentication failure immediately
      client.on('shardDisconnect', (event: any) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          try { client.destroy(); } catch {}
          console.error(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Gateway disconnect code ${event?.code}: ${event?.reason}`);
          if (event?.code === 4004) {
            reject(new Error('Invalid Discord Account Token (Error 4004: Authentication Failed). Please grab a fresh token from Discord Web/App.'));
          } else if (event?.code === 4008) {
            reject(new Error('Discord rate limited this connection (Error 4008). Please wait 1-2 minutes and try again.'));
          } else {
            reject(new Error(`Discord Gateway disconnected (Code ${event?.code || 'unknown'}: ${event?.reason || 'Authentication closed'}).`));
          }
        }
      });

      client.on('invalidated', () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          try { client.destroy(); } catch {}
          reject(new Error('Discord session invalidated. Please provide a fresh token.'));
        }
      });

      client.on('error', (err: any) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          try { client.destroy(); } catch {}
          console.error(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Gateway client error:`, err?.message);
          reject(new Error(err?.message || 'Discord Gateway error encountered.'));
        }
      });

      client.login(token).catch((err: any) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          try { client.destroy(); } catch {}
          console.error(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Gateway login rejected:`, err?.message);
          const msg = (err?.message || '').toLowerCase();
          if (msg.includes('token_invalid') || msg.includes('invalid token') || msg.includes('an invalid token was provided')) {
            reject(new Error('Invalid Discord Account Token. Please copy a fresh token from Discord Web/App.'));
          } else if (msg.includes('rate limit') || msg.includes('429')) {
            reject(new Error('Discord rate limit on gateway. Please wait a moment and try again.'));
          } else {
            reject(new Error(err?.message || 'Failed to authenticate token with Discord Gateway.'));
          }
        }
      });
    });

    const user = client.user;
    const avatarUrl = user?.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user?.discriminator || '0', 10) % 5}.png`;

    this.profile = {
      id: user?.id || 'unknown',
      username: user?.username || 'Discord User',
      discriminator: user?.discriminator || '0',
      global_name: (user as any)?.globalName || user?.username || 'User',
      avatar: user?.avatar || null,
      avatar_url: avatarUrl,
      banner: user?.banner || null,
      accent_color: (user as any)?.accentColor || null,
      email: (user as any)?.email || null,
      phone: (user as any)?.phone || null,
      mfa_enabled: Boolean((user as any)?.mfaEnabled),
      premium_type: (user as any)?.premiumType || 0,
      token: token,
    };

    this.isConnected = true;
    this.notifyState();
    return this.profile;
  }

  public async disconnect(): Promise<void> {
    try {
      await this.leaveVoiceChannel();
    } catch {}

    if (this.client) {
      try {
        this.client.destroy();
      } catch {}
      this.client = null;
    }

    this.currentToken = null;
    this.profile = null;
    this.isConnected = false;
    this.currentVoiceGuildId = null;
    this.currentVoiceChannelId = null;
    this.currentVoiceChannelName = null;
    this.isPlayingAudio = false;
    this.currentPlayingSoundId = null;
    this.currentPlayingSoundName = null;

    this.notifyState();
  }

  public getVoiceState(): VoiceStateInfo {
    if (!this.currentVoiceChannelId && this.client?.user) {
      const active = this.findActiveVoiceChannel();
      if (active) {
        this.currentVoiceGuildId = active.guildId;
        this.currentVoiceChannelId = active.channelId;
        this.currentVoiceChannelName = active.channelName;
      }
    }

    return {
      connected: Boolean(this.currentVoiceChannelId),
      guildId: this.currentVoiceGuildId,
      channelId: this.currentVoiceChannelId,
      channelName: this.currentVoiceChannelName,
      volume: this.currentVolume,
      selfMute: this.selfMute,
      selfDeaf: this.selfDeaf,
      isPlayingAudio: this.isPlayingAudio,
      currentSoundId: this.currentPlayingSoundId,
      currentSoundName: this.currentPlayingSoundName,
    };
  }

  public async joinVoiceChannel(guildId: string, channelId: string): Promise<VoiceStateInfo> {
    if (!this.client) throw new Error(`Slot ${this.slotIndex + 1}: Client not connected`);

    let guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      try {
        guild = await this.client.guilds.fetch(guildId);
      } catch {}
    }
    if (!guild) throw new Error(`Guild ${guildId} not found in account cache`);

    let channel = guild.channels.cache.get(channelId);
    if (!channel) {
      try {
        const fetched = await guild.channels.fetch(channelId);
        if (fetched) channel = fetched;
      } catch {}
    }
    if (!channel || (channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE')) {
      throw new Error(`Voice channel ${channelId} not found or is not a voice channel`);
    }

    const channelName = channel.name || 'Voice Channel';

    this.currentVoiceGuildId = guildId;
    this.currentVoiceChannelId = channelId;
    this.currentVoiceChannelName = channelName;

    this.ensureAudioPlayer();

    // 1. Establish Native Selfbot Voice Connection (designed specifically for user token voice protocol & encryption)
    try {
      if (this.client && (this.client as any).voice) {
        console.log(`[Slot ${this.slotIndex + 1}] Connecting to #${channelName} via native selfbot voice connection...`);
        this.currentVoiceConnection = await (this.client as any).voice.joinChannel(channel, {
          selfMute: false,
          selfDeaf: this.selfDeaf,
        });
        console.log(`🔊 [Slot ${this.slotIndex + 1}] Native selfbot voice connection established to #${channelName}!`);
      }
    } catch (selfbotErr: any) {
      console.warn(`[Slot ${this.slotIndex + 1}] Native voice join notice:`, selfbotErr.message);
    }

    // 2. Also prepare standard @discordjs/voice connection as fallback
    const uniqueVoiceGroup = `${this.tenantId}-slot-${this.slotIndex}`;
    console.log(`[Slot ${this.slotIndex + 1}] Preparing voice adapter for #${channelName} (group: ${uniqueVoiceGroup})...`);

    try {
      const connection = djsJoinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        group: uniqueVoiceGroup,
        selfMute: false,
        selfDeaf: this.selfDeaf,
        debug: true,
        daveEncryption: false,
      });

      this.selfMute = false;

      connection.on('stateChange', (oldState, newState) => {
        console.log(`🔊 [Voice State Slot ${this.slotIndex + 1}] ${oldState.status} -> ${newState.status}`);
      });

      connection.on('error', (err: any) => {
        console.error(`❌ [Voice Connection Error Slot ${this.slotIndex + 1}]:`, err.message);
      });

      if (this.audioPlayer) {
        connection.subscribe(this.audioPlayer);
      }
      this.djsVoiceConnection = connection;

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 6_000);
        console.log(`🔊 [Slot ${this.slotIndex + 1}] Voice connected successfully to #${channelName}!`);
      } catch (err: any) {
        console.log(`entersState note: ${err.message} (connection active)`);
      }
    } catch (err: any) {
      console.warn(`Voice connection setup error:`, err.message);
    }

    this.notifyState();
    return this.getVoiceState();
  }

  public async leaveVoiceChannel(): Promise<VoiceStateInfo> {
    if (this.currentDispatcher) {
      try { this.currentDispatcher.destroy(); } catch {}
      this.currentDispatcher = null;
    }
    if (this.audioPlayer) {
      try { this.audioPlayer.stop(); } catch {}
    }
    if (this.djsVoiceConnection) {
      try { this.djsVoiceConnection.destroy(); } catch {}
      this.djsVoiceConnection = null;
    }
    if (this.currentVoiceConnection) {
      try { this.currentVoiceConnection.disconnect(false); } catch {}
      this.currentVoiceConnection = null;
    }

    try {
      if (this.client && this.client.ws && typeof this.client.ws.broadcast === 'function') {
        this.client.ws.broadcast({
          op: 4,
          d: {
            guild_id: this.currentVoiceGuildId,
            channel_id: null,
            self_mute: false,
            self_deaf: false,
            flags: 2,
          },
        });
      }
    } catch {}

    this.currentVoiceGuildId = null;
    this.currentVoiceChannelId = null;
    this.currentVoiceChannelName = null;
    this.isPlayingAudio = false;
    this.currentPlayingSoundId = null;
    this.currentPlayingSoundName = null;

    this.notifyState();
    return this.getVoiceState();
  }

  public setVolume(volume: number, maxAllowedVolume: number = 300): VoiceStateInfo {
    const clamped = Math.max(0, Math.min(maxAllowedVolume, Math.round(volume)));
    this.currentVolume = clamped;
    const gain = (clamped / 100) * 1.35;

    if (this.currentResource && this.currentResource.volume) {
      try {
        this.currentResource.volume.setVolume(gain);
      } catch {}
    }

    if (this.currentDispatcher && typeof this.currentDispatcher.setVolume === 'function') {
      try {
        this.currentDispatcher.setVolume(gain);
      } catch {}
    }

    this.notifyState();
    return this.getVoiceState();
  }

  public setSelfMute(mute: boolean): VoiceStateInfo {
    this.selfMute = mute;
    if (this.client && this.client.ws && this.currentVoiceGuildId) {
      try {
        this.client.ws.broadcast({
          op: 4,
          d: {
            guild_id: this.currentVoiceGuildId,
            channel_id: this.currentVoiceChannelId,
            self_mute: this.selfMute,
            self_deaf: this.selfDeaf,
            flags: 2,
          },
        });
      } catch {}
    }
    this.notifyState();
    return this.getVoiceState();
  }

  public setSelfDeaf(deaf: boolean): VoiceStateInfo {
    this.selfDeaf = deaf;
    if (this.client && this.client.ws && this.currentVoiceGuildId) {
      try {
        this.client.ws.broadcast({
          op: 4,
          d: {
            guild_id: this.currentVoiceGuildId,
            channel_id: this.currentVoiceChannelId,
            self_mute: this.selfMute,
            self_deaf: this.selfDeaf,
            flags: 2,
          },
        });
      } catch {}
    }
    this.notifyState();
    return this.getVoiceState();
  }

  public async playVoiceAudio(
    audioSource: string | Readable,
    gainMultiplier: number = 1.3,
    soundId?: string,
    soundName?: string
  ): Promise<boolean> {
    if (!this.currentVoiceChannelId && this.client?.user) {
      const active = this.findActiveVoiceChannel();
      if (active) {
        this.currentVoiceGuildId = active.guildId;
        this.currentVoiceChannelId = active.channelId;
        this.currentVoiceChannelName = active.channelName;
      }
    }

    if (!this.currentVoiceChannelId) {
      throw new Error(`Slot ${this.slotIndex + 1}: Not connected to a voice channel.`);
    }

    if (typeof audioSource === 'string' && !audioSource.startsWith('http')) {
      if (!fs.existsSync(audioSource)) {
        throw new Error(`Audio file not found: ${audioSource}`);
      }
      const stat = fs.statSync(audioSource);
      if (stat.size < 100) {
        throw new Error('Audio file appears empty (0 bytes).');
      }
    }

    this.ensureAudioPlayer();

    // Ensure account is actively unmuted so Discord broadcasts the audio
    if (this.selfMute) {
      this.setSelfMute(false);
    }

    let connection = this.djsVoiceConnection;
    const guild = this.client?.guilds.cache.get(this.currentVoiceGuildId!);

    if (!connection || connection.state?.status === VoiceConnectionStatus.Destroyed || connection.state?.status === VoiceConnectionStatus.Disconnected) {
      if (guild) {
        const uniqueVoiceGroup = `${this.tenantId}-slot-${this.slotIndex}`;
        connection = djsJoinVoiceChannel({
          channelId: this.currentVoiceChannelId!,
          guildId: this.currentVoiceGuildId!,
          adapterCreator: guild.voiceAdapterCreator,
          group: uniqueVoiceGroup,
          selfMute: false,
          selfDeaf: this.selfDeaf,
          debug: true,
          daveEncryption: false,
        });
        this.djsVoiceConnection = connection;
      }
    }

    if (connection && this.audioPlayer) {
      connection.subscribe(this.audioPlayer);
    }

    if (connection && connection.state?.status !== VoiceConnectionStatus.Ready) {
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 6_000);
      } catch (err: any) {}
    }

    const calculatedVolume = Math.min(4.0, ((this.currentVolume || 100) / 100) * gainMultiplier);

    // 1. Try Native Selfbot Voice Connection (guarantees user RTP packet encryption & timing)
    if (this.currentVoiceConnection && typeof this.currentVoiceConnection.playAudio === 'function') {
      try {
        console.log(`🔊 [Slot ${this.slotIndex + 1}] Playing audio via native selfbot voice connection...`);
        const dispatcher = this.currentVoiceConnection.playAudio(audioSource, {
          volume: calculatedVolume,
        });
        this.currentDispatcher = dispatcher;
        this.isPlayingAudio = true;
        this.currentPlayingSoundId = soundId || null;
        this.currentPlayingSoundName = soundName || (typeof audioSource === 'string' ? audioSource.split(/[\\/]/).pop() : 'Live Voice (Speak Out)') || 'Custom Audio';

        dispatcher.on('start', () => {
          console.log(`🔊 [Slot ${this.slotIndex + 1}] Native dispatcher audio started transmitting`);
          this.isPlayingAudio = true;
          this.notifyState();
        });

        dispatcher.on('finish', () => {
          console.log(`⏹️ [Slot ${this.slotIndex + 1}] Native dispatcher audio finished`);
          this.isPlayingAudio = false;
          this.currentPlayingSoundId = null;
          this.currentPlayingSoundName = null;
          this.notifyState();
        });

        dispatcher.on('error', (err: any) => {
          console.error(`❌ [Slot ${this.slotIndex + 1}] Native dispatcher error:`, err.message);
          this.isPlayingAudio = false;
          this.notifyState();
        });

        this.notifyState();
        return true;
      } catch (nativeErr: any) {
        console.warn(`[Slot ${this.slotIndex + 1}] Native playAudio error, falling back to @discordjs/voice:`, nativeErr.message);
      }
    }

    const resource = createAudioResource(audioSource, {
      inlineVolume: true,
      inputType: StreamType.Arbitrary,
    });
    if (resource.volume) {
      resource.volume.setVolume(calculatedVolume);
    }

    resource.playStream.on('error', (err: any) => {
      console.error(`❌ [Slot ${this.slotIndex + 1} Audio Resource Stream Error]:`, err.message);
    });
    this.currentResource = resource;
    this.audioPlayer!.play(resource);
    this.isPlayingAudio = true;
    this.currentPlayingSoundId = soundId || null;
    this.currentPlayingSoundName = soundName || (typeof audioSource === 'string' ? audioSource.split(/[\\/]/).pop() : 'Live Voice (Speak Out)') || 'Custom Audio';

    this.notifyState();
    return true;
  }

  public stopVoiceAudio(): boolean {
    let stopped = false;
    if (this.currentDispatcher) {
      try {
        this.currentDispatcher.destroy();
        this.currentDispatcher = null;
        stopped = true;
      } catch {}
    }
    if (this.audioPlayer) {
      try {
        this.audioPlayer.stop();
        stopped = true;
      } catch {}
    }
    this.isPlayingAudio = false;
    this.currentPlayingSoundId = null;
    this.currentPlayingSoundName = null;
    this.notifyState();
    return stopped;
  }

  public getGuilds(): UserGuild[] {
    if (!this.client || !this.client.guilds) return [];
    const clientUser = this.client.user;
    return this.client.guilds.cache.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      icon_url: guild.iconURL({ size: 128, dynamic: true }) || '',
      owner: Boolean(clientUser && guild.ownerId === clientUser.id),
      permissions: guild.me ? guild.me.permissions.bitfield.toString() : '0',
      approximate_member_count: guild.memberCount || 0,
    }));
  }

  public getChannels(guildId: string): UserChannel[] {
    if (!this.client) return [];
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return [];
    const clientUser = this.client.user;

    return guild.channels.cache
      .filter((ch: any) => ch.type === 'GUILD_TEXT' || ch.type === 'GUILD_VOICE' || ch.type === 'GUILD_NEWS')
      .map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        type: (ch.type === 'GUILD_VOICE' ? 'voice' : ch.type === 'GUILD_NEWS' ? 'announcement' : 'text') as 'voice' | 'announcement' | 'text',
        position: ch.position,
        canJoin: ch.type === 'GUILD_VOICE' ? (clientUser ? (ch.permissionsFor(clientUser)?.has('CONNECT') ?? true) : true) : false,
        userLimit: ch.userLimit || 0,
      }))
      .sort((a: any, b: any) => a.position - b.position);
  }

  public async sendMessage(channelId: string, content: string, tts: boolean = false): Promise<any> {
    if (!this.client) throw new Error('Client not connected');
    const channel = this.client.channels.cache.get(channelId) as any;
    if (!channel || typeof channel.send !== 'function') {
      throw new Error(`Channel ${channelId} not found or does not support sending messages.`);
    }
    return channel.send({ content, tts });
  }

  public async joinGuild(inviteCodeOrUrl: string): Promise<any> {
    if (!this.client) throw new Error(`Slot ${this.slotIndex + 1}: Account is not connected`);
    const clean = inviteCodeOrUrl.trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
    const codeMatch = clean.match(/(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)?([a-zA-Z0-9-_]+)$/i);
    const code = codeMatch ? codeMatch[1] : clean;
    if (!code) throw new Error('Invalid Discord invite code or link');

    const res: any = await this.client.acceptInvite(code, { bypassOnboarding: true, bypassVerify: true });
    const guildId = res?.id || res?.guild?.id || '';
    const guildName = res?.name || res?.guild?.name || 'Discord Server';
    const icon = res?.icon || res?.guild?.icon || null;

    return {
      success: true,
      guild: {
        id: guildId,
        name: guildName,
        icon,
      },
      message: `Account (Slot 0${this.slotIndex + 1}) successfully joined ${guildName}!`,
    };
  }

  public async leaveGuild(guildId: string): Promise<boolean> {
    if (!this.client) throw new Error('Client not connected');
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild not found in account cache');
    await guild.leave();
    return true;
  }
}

/**
 * Isolated User Session managing a tenant's token slots and audio playback
 */
export class UserAccountSession {
  public tenantId: string;
  public maxTokens: number;
  public soundTier: 'standard' | 'admin_peaks';
  public slots: AccountSlot[] = [];
  public activeSlotIndex: number = 0;

  constructor(tenantId: string, maxTokens: number = 1, soundTier: 'standard' | 'admin_peaks' = 'standard') {
    this.tenantId = tenantId;
    this.maxTokens = Math.max(1, maxTokens);
    this.soundTier = soundTier;
    this.ensureSlots();
  }

  public setMaxTokens(count: number) {
    this.maxTokens = Math.max(1, count);
    this.ensureSlots();
  }

  public setSoundTier(tier: 'standard' | 'admin_peaks') {
    this.soundTier = tier;
  }

  private ensureSlots() {
    while (this.slots.length < this.maxTokens) {
      const idx = this.slots.length;
      this.slots.push(new AccountSlot(idx, this.tenantId, () => this.getAllSlotsInfo()));
    }
  }

  public extractToken(input: string): string {
    let clean = input.trim();
    if (!clean) throw new Error('Token input cannot be empty');

    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        const possibleKeys = ['token', 'authorization', 'auth', 'userToken', 'user_token', 'account_token', 'access_token'];
        for (const key of possibleKeys) {
          if (parsed[key] && typeof parsed[key] === 'string') {
            clean = parsed[key].trim();
            break;
          }
        }
        if (clean.startsWith('{')) {
          const values = Object.values(parsed);
          for (const v of values) {
            if (typeof v === 'string' && v.length > 20) {
              clean = v.trim();
              break;
            }
          }
        }
      } catch (e) {}
    }

    return clean
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/^authorization:\s*/i, '')
      .replace(/^bearer\s*/i, '')
      .replace(/^bot\s*/i, '')
      .trim();
  }

  public getActiveSlot(): AccountSlot {
    return this.slots[this.activeSlotIndex] || this.slots[0];
  }

  public getSlot(index: number): AccountSlot {
    while (this.slots.length <= index) {
      const idx = this.slots.length;
      this.slots.push(new AccountSlot(idx, this.tenantId, () => this.getAllSlotsInfo()));
    }
    return this.slots[index];
  }

  public setActiveSlot(index: number): number {
    const slot = this.getSlot(index);
    this.activeSlotIndex = index;
    socketService.emitToTenant(this.tenantId, 'account:voice_state', slot.getVoiceState());
    socketService.emitToTenant(this.tenantId, 'account:active_slot', { activeSlot: this.activeSlotIndex });
    return this.activeSlotIndex;
  }

  public getAllSlotsInfo(minSlots?: number): SlotSummary[] {
    const count = minSlots ? Math.max(minSlots, this.maxTokens) : this.maxTokens;
    this.ensureSlots();
    return this.slots.slice(0, count).map((s) => s.getSummary());
  }

  public getConnectedSlotsCount(): number {
    return this.slots.filter((s) => s.isConnected).length;
  }

  public async connectSlot(slotIndex: number, rawInput: string, maxTokensAllowed?: number): Promise<UserAccountProfile> {
    const allowed = maxTokensAllowed ?? this.maxTokens;
    if (slotIndex < 0 || slotIndex >= 100) {
      throw new Error('Slot index out of range (max 100)');
    }

    if (slotIndex >= allowed) {
      throw new Error(`Your Access Key permits up to ${allowed} token(s). Ask Admin for an upgrade to unlock Slot ${slotIndex + 1}.`);
    }

    while (this.slots.length <= slotIndex) {
      const idx = this.slots.length;
      this.slots.push(new AccountSlot(idx, this.tenantId, () => this.getAllSlotsInfo()));
    }

    const token = this.extractToken(rawInput);
    const slot = this.slots[slotIndex];
    const profile = await slot.connectWithToken(token);
    this.activeSlotIndex = slotIndex;

    // Permanently persist token so it survives server restarts and crashes
    persistentTokenStore.saveToken(this.tenantId, slotIndex, token);

    return profile;
  }

  public async disconnectSlot(slotIndex: number): Promise<void> {
    if (slotIndex >= 0 && slotIndex < this.slots.length) {
      await this.slots[slotIndex].disconnect();
    }
    // Remove from permanent store
    persistentTokenStore.removeToken(this.tenantId, slotIndex);
  }

  public async restoreSavedTokens(): Promise<void> {
    const saved = persistentTokenStore.getTokensForTenant(this.tenantId);
    if (!saved || saved.size === 0) return;

    for (const [slotIndex, entry] of saved.entries()) {
      if (slotIndex >= this.maxTokens) continue;
      const slot = this.getSlot(slotIndex);
      if (!slot.isConnected && entry.token) {
        console.log(`🔄 [Tenant ${this.tenantId}][Slot ${slotIndex + 1}] Restoring saved token across restart...`);
        slot.connectWithToken(entry.token).catch((err) => {
          console.warn(`[Tenant ${this.tenantId}][Slot ${slotIndex + 1}] Saved token restore note:`, err.message);
        });
      }
    }
  }

  public getVolumeLimits(soundTier: 'standard' | 'admin_peaks' = 'standard', isAdmin: boolean = false): { maxVolume: number; maxGainMultiplier: number } {
    if (isAdmin || soundTier === 'admin_peaks' || this.soundTier === 'admin_peaks') {
      return { maxVolume: 300, maxGainMultiplier: 3.5 };
    }
    return { maxVolume: 100, maxGainMultiplier: 1.3 };
  }

  public async playVoiceAudio(
    audioSource: string | Readable,
    gainMultiplier: number = 1.3,
    soundTier: 'standard' | 'admin_peaks' = 'standard',
    isAdmin: boolean = false,
    broadcastAll: boolean = false,
    slotIndex?: number,
    soundId?: string,
    soundName?: string
  ): Promise<boolean> {
    const limits = this.getVolumeLimits(soundTier, isAdmin);
    const cappedGain = Math.min(limits.maxGainMultiplier, gainMultiplier);

    if (broadcastAll) {
      const activeVoiceSlots = this.slots.filter((s) => s.isConnected && s.currentVoiceChannelId);
      if (activeVoiceSlots.length === 0) {
        throw new Error('None of your connected accounts are currently in a voice channel. Connect to a voice channel first!');
      }
      let anyPlayed = false;
      const isStream = typeof audioSource === 'object' && typeof (audioSource as any).pipe === 'function';

      for (const slot of activeVoiceSlots) {
        try {
          if (isStream) {
            const slotStream = new PassThrough();
            (audioSource as any).pipe(slotStream);
            await slot.playVoiceAudio(slotStream, cappedGain, soundId, soundName);
          } else {
            await slot.playVoiceAudio(audioSource, cappedGain, soundId, soundName);
          }
          anyPlayed = true;
        } catch (e: any) {
          console.warn(`[Joint Broadcast] Slot ${slot.slotIndex + 1} play note:`, e.message);
        }
      }
      return anyPlayed;
    }

    const targetSlot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return targetSlot.playVoiceAudio(audioSource, cappedGain, soundId, soundName);
  }

  public stopVoiceAudio(broadcastAll: boolean = false, slotIndex?: number): boolean {
    if (broadcastAll) {
      let anyStopped = false;
      for (const slot of this.slots) {
        if (slot.stopVoiceAudio()) anyStopped = true;
      }
      return anyStopped;
    }
    const targetSlot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return targetSlot.stopVoiceAudio();
  }

  public async connectWithToken(rawInput: string): Promise<UserAccountProfile> {
    return this.connectSlot(this.activeSlotIndex, rawInput, this.maxTokens);
  }

  public async disconnect(slotIndex?: number): Promise<void> {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    await slot.disconnect();
  }

  public getProfile(slotIndex?: number): UserAccountProfile | null {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.profile;
  }

  public getVoiceState(slotIndex?: number): VoiceStateInfo {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.getVoiceState();
  }

  public async joinVoiceChannel(guildId: string, channelId: string, slotIndex?: number): Promise<VoiceStateInfo> {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.joinVoiceChannel(guildId, channelId);
  }

  public async leaveVoiceChannel(slotIndex?: number): Promise<VoiceStateInfo> {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.leaveVoiceChannel();
  }

  public setVolume(volume: number, soundTier: 'standard' | 'admin_peaks' = 'standard', isAdmin: boolean = false, slotIndex?: number): VoiceStateInfo {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    const limits = this.getVolumeLimits(soundTier, isAdmin);
    return slot.setVolume(volume, limits.maxVolume);
  }

  public setSelfMute(mute: boolean, slotIndex?: number): VoiceStateInfo {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.setSelfMute(mute);
  }

  public setSelfDeaf(deaf: boolean, slotIndex?: number): VoiceStateInfo {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.setSelfDeaf(deaf);
  }

  public getGuilds(slotIndex?: number): UserGuild[] {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.getGuilds();
  }

  public getChannels(guildId: string, slotIndex?: number): UserChannel[] {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.getChannels(guildId);
  }

  public async sendMessage(channelId: string, content: string, tts: boolean = false, slotIndex?: number): Promise<any> {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.sendMessage(channelId, content, tts);
  }

  public async joinServer(invite: string, slotIndex?: number): Promise<any> {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.joinGuild(invite);
  }

  public async leaveServer(guildId: string, slotIndex?: number): Promise<boolean> {
    const slot = slotIndex !== undefined && slotIndex >= 0 ? this.getSlot(slotIndex) : this.getActiveSlot();
    return slot.leaveGuild(guildId);
  }
}

/**
 * Multi-Tenant Account Manager
 */
export class TenantAccountManager {
  private sessions = new Map<string, UserAccountSession>();

  public getSession(
    tenantId: string,
    maxTokens: number = 1,
    soundTier: 'standard' | 'admin_peaks' = 'standard'
  ): UserAccountSession {
    const cleanId = tenantId?.trim() || 'default';
    const isNew = !this.sessions.has(cleanId);
    if (isNew) {
      const session = new UserAccountSession(cleanId, maxTokens, soundTier);
      this.sessions.set(cleanId, session);
      // Automatically restore saved slot tokens in background across server restarts
      setTimeout(() => session.restoreSavedTokens().catch(() => {}), 150);
    }
    const session = this.sessions.get(cleanId)!;
    if (maxTokens > session.maxTokens) {
      session.setMaxTokens(maxTokens);
    }
    if (soundTier) {
      session.setSoundTier(soundTier);
    }
    return session;
  }

  public removeSession(tenantId: string) {
    const session = this.sessions.get(tenantId);
    if (session) {
      for (const slot of session.slots) {
        slot.disconnect().catch(() => {});
      }
      this.sessions.delete(tenantId);
    }
  }

  public getAllActiveSessions(): Array<{ tenantId: string; maxTokens: number; connectedSlots: number }> {
    const res: Array<{ tenantId: string; maxTokens: number; connectedSlots: number }> = [];
    for (const [id, session] of this.sessions.entries()) {
      res.push({
        tenantId: id,
        maxTokens: session.maxTokens,
        connectedSlots: session.getConnectedSlotsCount(),
      });
    }
    return res;
  }
}

export const tenantAccountManager = new TenantAccountManager();
export const userAccountManager = tenantAccountManager.getSession('default', 3, 'standard');

import { Client } from 'discord.js-selfbot-v13';
import {
  joinVoiceChannel as djsJoinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
} from '@discordjs/voice';
import fs from 'fs';
import { socketService } from '../socket';

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
    // 1. Direct REST validation
    console.log(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Validating token against Discord API...`);
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      // Check if it's a Bot token instead of a User account token
      try {
        const botCheck = await fetch('https://discord.com/api/v10/users/@me', {
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (botCheck.ok) {
          const botUser = (await botCheck.json()) as any;
          throw new Error(`This token belongs to a Discord Bot (@${botUser.username}), not a User account. Slots require a Discord User token or Bluecord JSON.`);
        }
      } catch (checkErr: any) {
        if (checkErr.message.includes('Discord Bot')) throw checkErr;
      }

      const errText = await res.text();
      let errData: any = {};
      try {
        errData = JSON.parse(errText);
      } catch {}

      console.error(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Discord REST rejection (${res.status}):`, errText);
      if (res.status === 401) {
        throw new Error('401 Unauthorized: Invalid or expired Discord account token. If you changed your password or logged out, Discord generated a new token.');
      } else if (res.status === 429) {
        throw new Error('429 Rate Limit: Discord is temporarily rate limiting requests. Please wait a minute and try again.');
      }
      throw new Error(errData.message || `Discord rejected token (HTTP ${res.status}): ${errText.slice(0, 100)}`);
    }

    const userData = (await res.json()) as any;
    const avatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0', 10) % 5}.png`;

    // 2. Tear down existing connection if any
    await this.disconnect();

    this.currentToken = token;
    this.profile = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      global_name: userData.global_name,
      avatar: userData.avatar,
      avatar_url: avatarUrl,
      banner: userData.banner,
      accent_color: userData.accent_color,
      email: userData.email,
      phone: userData.phone,
      mfa_enabled: userData.mfa_enabled,
      premium_type: userData.premium_type,
      token: token,
    };

    // 3. Initialize discord.js-selfbot-v13 Client
    const client = new Client({
      checkUpdate: false,
      autoRedeemNitro: false,
    } as any);

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

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(); // Profile already validated, gateway can complete in background
      }, 10000);

      client.once('ready', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log(`✅ [Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Logged in as ${client.user?.tag} (${client.user?.id})`);

        // Check if user is already in a VC
        const active = this.findActiveVoiceChannel();
        if (active) {
          this.currentVoiceGuildId = active.guildId;
          this.currentVoiceChannelId = active.channelId;
          this.currentVoiceChannelName = active.channelName;
        }

        resolve();
      });

      client.login(token).catch((err: any) => {
        clearTimeout(timeout);
        console.warn(`[Tenant ${this.tenantId}][Slot ${this.slotIndex + 1}] Gateway login warning:`, err.message);
        resolve();
      });
    });

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

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} not found in account cache`);

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== 'GUILD_VOICE') {
      throw new Error(`Voice channel ${channelId} not found or is not a voice channel`);
    }

    const channelName = channel.name || 'Voice Channel';

    this.currentVoiceGuildId = guildId;
    this.currentVoiceChannelId = channelId;
    this.currentVoiceChannelName = channelName;

    this.ensureAudioPlayer();

    const uniqueVoiceGroup = `${this.tenantId}-slot-${this.slotIndex}`;
    console.log(`[Slot ${this.slotIndex + 1}] Connecting to #${channelName} with DAVE E2EE (group: ${uniqueVoiceGroup})...`);

    try {
      const connection = djsJoinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        group: uniqueVoiceGroup,
        selfMute: this.selfMute,
        selfDeaf: this.selfDeaf,
        debug: true,
        daveEncryption: true,
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
    audioSource: string,
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
          selfMute: this.selfMute,
          selfDeaf: this.selfDeaf,
          debug: true,
          daveEncryption: true,
        });
        this.djsVoiceConnection = connection;
        if (this.audioPlayer) {
          connection.subscribe(this.audioPlayer);
        }
      }
    }

    if (connection && connection.state?.status !== VoiceConnectionStatus.Ready) {
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 6_000);
      } catch (err: any) {}
    }

    const calculatedVolume = Math.min(4.0, ((this.currentVolume || 100) / 100) * gainMultiplier);

    const resource = createAudioResource(audioSource, {
      inlineVolume: true,
    });
    if (resource.volume) {
      resource.volume.setVolume(calculatedVolume);
    }
    this.currentResource = resource;
    this.audioPlayer!.play(resource);
    this.isPlayingAudio = true;
    this.currentPlayingSoundId = soundId || null;
    this.currentPlayingSoundName = soundName || audioSource.split(/[\\/]/).pop() || 'Custom Audio';

    this.notifyState();
    return true;
  }

  public stopVoiceAudio(): boolean {
    if (this.audioPlayer) {
      try {
        this.audioPlayer.stop();
        this.isPlayingAudio = false;
        this.currentPlayingSoundId = null;
        this.currentPlayingSoundName = null;
        this.notifyState();
        return true;
      } catch {}
    }
    return false;
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
    if (!this.client) throw new Error('Client not connected');
    const code = inviteCodeOrUrl.replace(/^(https?:\/\/)?(discord\.gg\/|discord\.com\/invite\/)/, '').trim();
    if (!code) throw new Error('Invalid Discord invite code');
    return this.client.acceptInvite(code);
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
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Token input cannot be empty');

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const possibleKeys = ['token', 'authorization', 'auth', 'userToken', 'user_token', 'account_token', 'access_token'];
        for (const key of possibleKeys) {
          if (parsed[key] && typeof parsed[key] === 'string') {
            return parsed[key].trim().replace(/^Bot\s+/i, '');
          }
        }
        const values = Object.values(parsed);
        for (const v of values) {
          if (typeof v === 'string' && v.length > 20) {
            return v.trim().replace(/^Bot\s+/i, '');
          }
        }
      } catch (e) {}
    }

    return trimmed.replace(/^["']|["']$/g, '').replace(/^Bot\s+/i, '');
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
    if (slotIndex < 0 || slotIndex >= 20) {
      throw new Error('Slot index out of range (max 20)');
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
    return profile;
  }

  public async disconnectSlot(slotIndex: number): Promise<void> {
    if (slotIndex >= 0 && slotIndex < this.slots.length) {
      await this.slots[slotIndex].disconnect();
    }
  }

  public getVolumeLimits(soundTier: 'standard' | 'admin_peaks' = 'standard', isAdmin: boolean = false): { maxVolume: number; maxGainMultiplier: number } {
    if (isAdmin || soundTier === 'admin_peaks' || this.soundTier === 'admin_peaks') {
      return { maxVolume: 300, maxGainMultiplier: 3.5 };
    }
    return { maxVolume: 100, maxGainMultiplier: 1.3 };
  }

  public async playVoiceAudio(
    audioSource: string,
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
      for (const slot of activeVoiceSlots) {
        try {
          await slot.playVoiceAudio(audioSource, cappedGain, soundId, soundName);
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
    if (!this.sessions.has(cleanId)) {
      this.sessions.set(cleanId, new UserAccountSession(cleanId, maxTokens, soundTier));
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

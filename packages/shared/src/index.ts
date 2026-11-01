// PRD Section 6 Entities and API types

export interface User {
  id: string;
  discord_user_id: string;
  username: string;
  avatar: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  session_hash: string;
  expires_at: string;
  created_at: string;
}

export interface Guild {
  id: string;
  discord_guild_id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
  bot_installed?: boolean;
  created_at: string;
}

export interface Installation {
  id: string;
  guild_id: string;
  bot_status: 'online' | 'offline' | 'idle' | 'dnd';
  installed_at: string;
}

export interface UserGuildAccess {
  id: string;
  user_id: string;
  guild_id: string;
  permission_level: 'admin' | 'manager' | 'member';
}

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: number; // in seconds
  source_reference: string;
  thumbnail?: string;
  requested_by?: string;
  position?: number;
}

export interface MusicSession {
  id: string;
  guild_id: string;
  voice_channel_id: string | null;
  voice_channel_name?: string | null;
  current_track: MusicTrack | null;
  playback_status: 'playing' | 'paused' | 'stopped' | 'idle';
  volume: number; // 0 to 100
  repeat_mode: 'off' | 'track' | 'queue';
  shuffle: boolean;
  position_seconds: number;
  duration_seconds: number;
}

export interface Announcement {
  id: string;
  guild_id: string;
  channel_id: string;
  channel_name?: string;
  message: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  tts?: boolean;
}

export interface GuildSetting {
  id: string;
  guild_id: string;
  setting_key: string;
  setting_value: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  username?: string;
  guild_id?: string;
  guild_name?: string;
  action: string;
  status: 'success' | 'failed' | 'info';
  details?: string;
  created_at: string;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'stage';
  position: number;
}

export interface BotStatus {
  online: boolean;
  tag: string;
  ping: number;
  guild_count: number;
  user_count: number;
  active_voice_connections: number;
  uptime_seconds: number;
}

export interface DashboardOverview {
  user: User;
  bot: BotStatus;
  authorized_guilds: Guild[];
  active_sessions: MusicSession[];
  recent_activity: ActivityLog[];
}

// WebSocket Event Names
export const WS_EVENTS = {
  BOT_STATUS_CHANGED: 'bot:status_changed',
  MUSIC_STATE_CHANGED: 'music:state_changed',
  QUEUE_UPDATED: 'music:queue_updated',
  VOICE_STATE_CHANGED: 'voice:state_changed',
  ACTIVITY_LOGGED: 'activity:logged',
  GUILD_UPDATED: 'guild:updated',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// API Response envelope
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

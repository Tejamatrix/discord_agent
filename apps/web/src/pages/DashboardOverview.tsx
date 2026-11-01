import React from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Headphones,
  Music,
  Play,
  Pause,
  Radio,
  Server,
  Users,
  Zap,
} from 'lucide-react';
import { BotStatus, Guild, MusicSession, ActivityLog, User } from '@hub/shared';

interface DashboardOverviewProps {
  user: User | null;
  botStatus: BotStatus | null;
  guilds: Guild[];
  activeGuild: Guild | null;
  activeSession: MusicSession | null;
  recentActivity: ActivityLog[];
  onPlayPause: () => void;
  onNavigateToMusic: () => void;
  onNavigateToAnnouncements: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  botStatus,
  guilds,
  activeGuild,
  activeSession,
  recentActivity,
  onPlayPause,
  onNavigateToMusic,
  onNavigateToAnnouncements,
}) => {
  const isPlaying = activeSession?.playback_status === 'playing';

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-discord-brand/20 via-indigo-900/30 to-slate-900 border border-discord-brand/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-discord-brand/20 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-discord-brand/30 border border-discord-brand/50 px-2.5 py-1 rounded-full text-xs font-semibold text-indigo-300 mb-2">
              <SparkleIcon className="w-3.5 h-3.5" />
              <span>Multi-Tenant Architecture Active</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">
              Welcome back, {user?.username || 'Commander'}!
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Currently managing <strong className="text-white">{activeGuild?.name || 'All Servers'}</strong>. Control
              music playback, voice channels, and broadcast announcements without typing Discord bot commands.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onNavigateToMusic}
              className="bg-discord-brand hover:bg-discord-brand/90 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-discord-brand/30 flex items-center space-x-2 text-sm transition-all"
            >
              <Music className="w-4 h-4" />
              <span>Open Music Player</span>
            </button>
            <button
              onClick={onNavigateToAnnouncements}
              className="bg-discord-card hover:bg-discord-hover text-slate-200 border border-slate-700 font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 text-sm transition-all"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Broadcast Announcement</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Bot Status */}
        <div className="bg-discord-card border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Bot Gateway Status</p>
            <p className="text-lg font-bold text-white flex items-center gap-2">
              <span>{botStatus?.online ? 'Online' : 'Offline'}</span>
              <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {botStatus?.ping || 24}ms
              </span>
            </p>
          </div>
        </div>

        {/* Metric 2: Authorized Guilds */}
        <div className="bg-discord-card border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Authorized Servers</p>
            <p className="text-lg font-bold text-white">{guilds.length} Active</p>
          </div>
        </div>

        {/* Metric 3: Voice Connections */}
        <div className="bg-discord-card border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Voice Connections</p>
            <p className="text-lg font-bold text-white">
              {activeSession?.voice_channel_id ? '1 Channel' : 'Idle'}
            </p>
          </div>
        </div>

        {/* Metric 4: Total Reached Users */}
        <div className="bg-discord-card border border-slate-800 p-4 rounded-xl flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Community Reach</p>
            <p className="text-lg font-bold text-white">{botStatus?.user_count || 142} Members</p>
          </div>
        </div>
      </div>

      {/* Main Row: Live Playback Card & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Playback Card (2 Cols) */}
        <div className="lg:col-span-2 bg-discord-card border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Music className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Active Playback Session</h3>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                isPlaying
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-400'
              }`}
            >
              {isPlaying ? '● Streaming Now' : 'Idle / Paused'}
            </span>
          </div>

          {activeSession?.current_track ? (
            <div className="bg-discord-dark/60 border border-slate-700/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <img
                  src={
                    activeSession.current_track.thumbnail ||
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&h=160&fit=crop'
                  }
                  alt={activeSession.current_track.title}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700 shadow-md"
                />
                <div>
                  <h4 className="text-base font-bold text-white leading-tight">
                    {activeSession.current_track.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Artist: {activeSession.current_track.artist || 'Stream Source'}
                  </p>
                  <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1 font-mono">
                    <Radio className="w-3.5 h-3.5" />
                    Channel: #{activeSession.voice_channel_name || 'General Voice'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={onPlayPause}
                  className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-600/30"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={onNavigateToMusic}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  View Queue
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-discord-dark/40 rounded-xl border border-dashed border-slate-800">
              <Headphones className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">No active music session in this server</p>
              <button
                onClick={onNavigateToMusic}
                className="mt-3 text-xs bg-discord-brand/20 hover:bg-discord-brand/30 text-indigo-300 font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Start Playback
              </button>
            </div>
          )}

          {/* Connected Voice Info */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Voice Status: {activeSession?.voice_channel_id ? 'Connected' : 'Disconnected'}</span>
            <span>Volume: {activeSession?.volume ?? 80}%</span>
          </div>
        </div>

        {/* Activity Feed (1 Col) */}
        <div className="bg-discord-card border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Recent Activity</h3>
          </div>

          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-discord-dark/40 border border-slate-800/60 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{log.action}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[11px]">{log.guild_name || 'System'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  );
}

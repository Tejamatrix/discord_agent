import React, { useState } from 'react';
import {
  Check,
  ExternalLink,
  Plus,
  Radio,
  Server,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { ChannelInfo, Guild } from '@hub/shared';

interface ServersViewProps {
  guilds: Guild[];
  activeGuild: Guild | null;
  channels: ChannelInfo[];
  inviteUrl: string;
  onSelectGuild: (guild: Guild) => void;
  onInstallBot: (guildId: string) => void;
  onUninstallBot: (guildId: string) => void;
}

export const ServersView: React.FC<ServersViewProps> = ({
  guilds,
  activeGuild,
  channels,
  inviteUrl,
  onSelectGuild,
  onInstallBot,
  onUninstallBot,
}) => {
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Server className="w-7 h-7 text-indigo-400" />
            Server Fleet Management
          </h2>
          <p className="text-sm text-slate-400">
            Manage bot installations, channel mappings, and tenant isolation across your Discord servers.
          </p>
        </div>

        <a
          href={inviteUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="bg-discord-brand hover:bg-discord-brand/90 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-discord-brand/30 flex items-center space-x-2 text-xs transition-all self-start sm:self-auto"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Invite Bot to New Server</span>
        </a>
      </div>

      {/* Grid of Servers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {guilds.map((g) => {
          const isSelected = activeGuild?.id === g.id;
          return (
            <div
              key={g.id}
              className={`bg-discord-card border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3">
                    {g.icon ? (
                      <img
                        src={g.icon}
                        alt={g.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-300 text-lg">
                        {g.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="text-base font-bold text-white leading-tight">{g.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                        ID: {g.discord_guild_id.substring(0, 10)}...
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      g.bot_installed
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-700/40 text-slate-400 border-slate-700'
                    }`}
                  >
                    {g.bot_installed ? 'Active' : 'Uninstalled'}
                  </span>
                </div>

                <div className="p-3 bg-discord-dark/50 rounded-xl space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Permission:</span>
                    <span className="font-semibold text-white">Administrator</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tenant Isolation:</span>
                    <span className="font-semibold text-emerald-400">Enforced</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectGuild(g)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isSelected ? 'Currently Selected' : 'Switch to Server'}
                </button>

                {g.bot_installed ? (
                  <button
                    onClick={() => setConfirmUninstallId(g.id)}
                    title="Remove Bot"
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors border border-rose-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onInstallBot(g.id)}
                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors border border-emerald-500/20 text-xs font-semibold"
                  >
                    Install
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Server Accessible Channels */}
      {activeGuild && (
        <div className="bg-discord-card border border-slate-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-2">
            Accessible Channels in {activeGuild.name}
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Channels automatically discovered via Discord Gateway and permissions check.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="p-3 bg-discord-dark/50 border border-slate-800/80 rounded-xl flex items-center space-x-3 text-xs"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono ${
                    ch.type === 'voice'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-slate-700/30 text-slate-300'
                  }`}
                >
                  {ch.type === 'voice' ? '🔊' : '#'}
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{ch.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{ch.type} channel</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Uninstall Modal */}
      {confirmUninstallId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-discord-card border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-white">Remove Bot from Server?</h4>
            <p className="text-xs text-slate-300">
              This will revoke the bot's ability to perform voice streaming, announcements, and management
              operations on this server.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setConfirmUninstallId(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUninstallBot(confirmUninstallId);
                  setConfirmUninstallId(null);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-xl text-xs font-bold"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

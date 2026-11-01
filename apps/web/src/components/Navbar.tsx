import React from 'react';
import { Bot, ChevronDown, LogOut, Radio, Server, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { BotStatus, Guild, User } from '@hub/shared';

interface NavbarProps {
  user: User | null;
  guilds: Guild[];
  activeGuild: Guild | null;
  onSelectGuild: (guild: Guild) => void;
  botStatus: BotStatus | null;
  onLogout: () => void;
  onOpenInvite: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  guilds,
  activeGuild,
  onSelectGuild,
  botStatus,
  onLogout,
  onOpenInvite,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <header className="h-16 border-b border-discord-card bg-discord-dark/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Server Switcher */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-discord-brand to-indigo-600 flex items-center justify-center shadow-lg shadow-discord-brand/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5">
              Discord Control Hub
              <span className="text-[10px] bg-discord-brand/20 text-discord-brand font-semibold px-2 py-0.5 rounded-full border border-discord-brand/30">
                PRO SaaS
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Multi-tenant Command Center</p>
          </div>
        </div>

        {/* Server Selector */}
        {guilds.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2.5 bg-discord-sidebar hover:bg-discord-hover px-3.5 py-1.5 rounded-lg border border-slate-700/60 transition-all text-sm font-semibold text-slate-200"
            >
              <Server className="w-4 h-4 text-indigo-400" />
              <span>{activeGuild ? activeGuild.name : 'Select a Server'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-discord-card border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Authorized Guilds
                </div>
                {guilds.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      onSelectGuild(g);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-discord-hover transition-colors ${
                      activeGuild?.id === g.id ? 'bg-discord-brand/10 text-white font-medium' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{g.name}</span>
                    {g.bot_installed && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                        Active
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Bot Status, Invite Button, User Profile */}
      <div className="flex items-center space-x-4">
        {/* Bot status indicator */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                botStatus?.online ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                botStatus?.online ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </span>
          <span className="font-semibold text-slate-300">
            {botStatus?.online ? 'Bot Online' : 'Bot Offline'}
          </span>
          {botStatus && (
            <span className="text-slate-500 font-mono">({botStatus.ping}ms)</span>
          )}
        </div>

        {/* Invite link button */}
        <button
          onClick={onOpenInvite}
          className="hidden sm:flex items-center space-x-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Add Bot to Discord</span>
        </button>

        {/* User profile */}
        {user ? (
          <div className="flex items-center space-x-3 bg-discord-sidebar px-3 py-1.5 rounded-lg border border-slate-700/50">
            <img
              src={user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt={user.username}
              className="w-7 h-7 rounded-full border border-discord-brand"
            />
            <div className="hidden lg:block text-left">
              <p className="text-xs font-bold text-white leading-tight">{user.username}</p>
              <p className="text-[10px] text-emerald-400 font-medium">Administrator</p>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="text-slate-400 hover:text-rose-400 transition-colors p-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Guest</span>
          </div>
        )}
      </div>
    </header>
  );
};

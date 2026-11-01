import React from 'react';
import {
  LayoutDashboard,
  Music2,
  Mic2,
  Megaphone,
  Server,
  Sliders,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'music'
  | 'announcements'
  | 'servers'
  | 'settings'
  | 'activity';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeGuildName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, activeGuildName }) => {
  const navItems = [
    { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'music', label: 'Music & Voice Player', icon: Music2 },
    { id: 'announcements', label: 'Announcements & TTS', icon: Megaphone },
    { id: 'servers', label: 'Server Management', icon: Server },
    { id: 'settings', label: 'All Control / Settings', icon: Sliders },
    { id: 'activity', label: 'Activity & Security', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 bg-discord-dark border-r border-discord-card flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        {/* Active server context pill */}
        <div className="bg-discord-card/70 border border-slate-700/50 p-3 rounded-xl">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">
            Current Scope
          </p>
          <p className="text-sm font-bold text-white truncate flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            {activeGuildName || 'No Server Selected'}
          </p>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as NavTab)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-discord-brand text-white shadow-md shadow-discord-brand/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-discord-card'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Documentation link */}
      <div className="pt-4 border-t border-slate-800">
        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/80">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Zero-Token Architecture</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Strict PRD compliance: Discord OAuth2 protected. Personal account tokens are never collected.
          </p>
        </div>
      </div>
    </aside>
  );
};

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Save, Sliders, Volume2, Bell, Clock } from 'lucide-react';

interface SettingsViewProps {
  settings: Record<string, string>;
  onSave: (settings: Record<string, string>) => Promise<boolean>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
  const [defaultVolume, setDefaultVolume] = useState('75');
  const [prefix, setPrefix] = useState('[HUB ANNOUNCEMENT]');
  const [autoDisconnect, setAutoDisconnect] = useState('10');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (settings['default_volume']) setDefaultVolume(settings['default_volume']);
    if (settings['announcement_prefix']) setPrefix(settings['announcement_prefix']);
    if (settings['auto_disconnect_minutes']) setAutoDisconnect(settings['auto_disconnect_minutes']);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const success = await onSave({
      default_volume: defaultVolume,
      announcement_prefix: prefix,
      auto_disconnect_minutes: autoDisconnect,
    });
    setSaving(false);
    if (success) {
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
          <Sliders className="w-7 h-7 text-indigo-400" />
          Server Preferences & Global Settings
        </h2>
        <p className="text-sm text-slate-400">
          Configure default volume behavior, announcement formatting, and tenant-level options.
        </p>
      </div>

      {savedBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center space-x-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Server settings successfully persisted to PostgreSQL/Database!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Module C & G: Music Settings */}
        <div className="bg-discord-card border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <span>Audio & Voice Channel Preferences</span>
          </h3>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Default Starting Volume ({defaultVolume}%)
                </label>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={defaultVolume}
                onChange={(e) => setDefaultVolume(e.target.value)}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The volume level applied whenever the bot joins a voice channel.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Auto-Disconnect Inactivity Timeout (Minutes)
              </label>
              <select
                value={autoDisconnect}
                onChange={(e) => setAutoDisconnect(e.target.value)}
                className="w-full bg-discord-dark border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="5">5 Minutes</option>
                <option value="10">10 Minutes (Recommended)</option>
                <option value="30">30 Minutes</option>
                <option value="0">Never Disconnect (Stay in voice)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Module E & G: Announcement Settings */}
        <div className="bg-discord-card border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <span>Announcement Formatting</span>
          </h3>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Broadcast Prefix Tag
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-full bg-discord-dark border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Prepended to all text announcements broadcast through the dashboard.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-discord-brand hover:bg-discord-brand/90 text-white font-bold px-6 py-3 rounded-xl text-xs transition-colors flex items-center space-x-2 shadow-lg shadow-discord-brand/20"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </form>
    </div>
  );
};

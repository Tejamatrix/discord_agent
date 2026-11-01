import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Megaphone,
  Radio,
  Send,
  Volume2,
} from 'lucide-react';
import { Announcement, ChannelInfo } from '@hub/shared';

interface AnnouncementsViewProps {
  channels: ChannelInfo[];
  history: Announcement[];
  onSend: (channelId: string, message: string, tts: boolean) => Promise<boolean>;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  channels,
  history,
  onSend,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [tts, setTts] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<boolean>(false);

  const textChannels = channels.filter((c) => c.type === 'text');

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsConfirming(true);
  };

  const handleConfirmSend = async () => {
    const targetChannel = selectedChannelId || textChannels[0]?.id;
    if (!targetChannel) return;

    setSending(true);
    const success = await onSend(targetChannel, message, tts);
    setSending(false);
    setIsConfirming(false);

    if (success) {
      setMessage('');
      setSuccessBanner(true);
      setTimeout(() => setSuccessBanner(false), 4000);
    }
  };

  const selectedChannel = textChannels.find((c) => c.id === (selectedChannelId || textChannels[0]?.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
          <Megaphone className="w-7 h-7 text-indigo-400" />
          Server Announcements & TTS
        </h2>
        <p className="text-sm text-slate-400">
          Broadcast formatted announcements to text channels or vocalize messages via Text-to-Speech in voice.
        </p>
      </div>

      {successBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center space-x-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Announcement successfully broadcasted to Discord!</span>
        </div>
      )}

      {/* Main Composer & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composer Form */}
        <div className="bg-discord-card border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Compose Announcement</span>
          </h3>

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Target Discord Channel
              </label>
              <select
                value={selectedChannelId || textChannels[0]?.id || ''}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full bg-discord-dark border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Announcement Message (Supports Discord Markdown)
              </label>
              <textarea
                rows={5}
                placeholder="Write your announcement here... e.g. **Update v1.2** is live! Join tonight's community gaming tournament."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-discord-dark border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-mono"
              />
            </div>

            {/* TTS Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-discord-dark/50 border border-slate-800">
              <div className="flex items-center space-x-2.5">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xs font-bold text-slate-200">Text-to-Speech (TTS)</p>
                  <p className="text-[11px] text-slate-400">Audibly vocalize message in the voice channel</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={tts}
                onChange={(e) => setTts(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={!message.trim()}
              className="w-full bg-discord-brand hover:bg-discord-brand/90 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-discord-brand/20"
            >
              <Send className="w-4 h-4" />
              <span>Review & Broadcast Announcement</span>
            </button>
          </form>
        </div>

        {/* Live Discord Message Preview */}
        <div className="bg-discord-card border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Discord Message Preview</span>
          </h3>

          <div className="p-4 rounded-xl bg-discord-dark border border-slate-700/80 space-y-3 font-sans">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                BOT
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-xs">Discord Control Hub</span>
                  <span className="text-[10px] bg-discord-brand text-white font-bold px-1.5 py-0.2 rounded">
                    BOT
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Today at 8:30 PM</span>
                  {tts && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.2 rounded border border-amber-500/30">
                      TTS Enabled
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-mono pt-1">
                  {message || 'Your announcement text preview will appear here formatted as Discord users will see it...'}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            Target Destination: <strong className="text-white">#{selectedChannel?.name || 'announcements'}</strong>
          </div>
        </div>
      </div>

      {/* Historical Announcements */}
      <div className="bg-discord-card border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Broadcast History</span>
        </h3>

        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-discord-dark/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-mono text-slate-200 font-medium">{item.message}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sent to <strong className="text-indigo-400">#{item.channel_name || 'channel'}</strong> by{' '}
                    {item.created_by_name || 'Admin'}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs">
            No previous announcements recorded in this server.
          </div>
        )}
      </div>

      {/* PRD Mandated Confirmation Modal */}
      {isConfirming && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-discord-card border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h4 className="text-lg font-bold text-white">Confirm Announcement Broadcast</h4>
              <p className="text-xs text-slate-300 mt-1">
                Are you sure you want to broadcast this message to{' '}
                <strong className="text-indigo-400">#{selectedChannel?.name || 'announcements'}</strong>?
              </p>
            </div>

            <div className="p-3 bg-discord-dark rounded-xl text-xs text-slate-300 font-mono max-h-32 overflow-y-auto">
              {message}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setIsConfirming(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSend}
                disabled={sending}
                className="flex-1 bg-discord-brand hover:bg-discord-brand/90 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-discord-brand/20"
              >
                {sending ? 'Broadcasting...' : 'Yes, Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

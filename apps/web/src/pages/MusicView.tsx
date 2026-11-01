import React, { useState } from 'react';
import {
  Disc3,
  Headphones,
  ListMusic,
  Mic,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  Shuffle,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChannelInfo, MusicSession, MusicTrack } from '@hub/shared';

interface MusicViewProps {
  session: MusicSession | null;
  channels: ChannelInfo[];
  queue: any[];
  onPlay: (track: MusicTrack, voiceChannelId?: string) => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onVolume: (vol: number) => void;
  onConnectVoice: (channelId: string, channelName: string) => void;
  onDisconnectVoice: () => void;
  onAddToQueue: (track: MusicTrack) => void;
  onRemoveQueue: (itemId: string) => void;
}

const PRESET_TRACKS: MusicTrack[] = [
  {
    id: 'trk_synth',
    title: 'Synthwave Odyssey (Neon Pulse)',
    artist: 'CyberDreamer',
    duration: 215,
    source_reference: 'https://stream.example.com/synthwave.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
  },
  {
    id: 'trk_lofi',
    title: 'Midnight Lo-Fi Chill Hop (Coding Groove)',
    artist: 'ChillHop Station',
    duration: 180,
    source_reference: 'https://stream.example.com/lofi-midnight.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&h=200&fit=crop',
  },
  {
    id: 'trk_cyber',
    title: 'Cyberpunk 2099 - Industrial Bass Overdrive',
    artist: 'Night City Synth',
    duration: 240,
    source_reference: 'https://stream.example.com/cyberpunk-bass.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop',
  },
  {
    id: 'trk_acoustic',
    title: 'Starlight Acoustic Chill & Campfire',
    artist: 'Acoustic Waves',
    duration: 195,
    source_reference: 'https://stream.example.com/starlight.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop',
  },
];

export const MusicView: React.FC<MusicViewProps> = ({
  session,
  channels,
  queue,
  onPlay,
  onPause,
  onResume,
  onSkip,
  onStop,
  onVolume,
  onConnectVoice,
  onDisconnectVoice,
  onAddToQueue,
  onRemoveQueue,
}) => {
  const [customTitle, setCustomTitle] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');

  const voiceChannels = channels.filter((c) => c.type === 'voice');
  const isPlaying = session?.playback_status === 'playing';
  const currentTrack = session?.current_track;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    const newTrack: MusicTrack = {
      id: `trk_${Date.now()}`,
      title: customTitle,
      artist: 'Custom Input',
      source_reference: customSource || 'https://audio.example.com/stream.mp3',
      duration: 210,
    };

    onAddToQueue(newTrack);
    setCustomTitle('');
    setCustomSource('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Music className="w-7 h-7 text-indigo-400" />
            Music & Voice Manager
          </h2>
          <p className="text-sm text-slate-400">
            Stream high-fidelity audio directly into authorized Discord voice channels.
          </p>
        </div>

        {/* Voice Channel Join / Disconnect Header Pill */}
        <div className="flex items-center space-x-2 bg-discord-card border border-slate-700 p-1.5 rounded-xl">
          <select
            value={selectedVoiceId || session?.voice_channel_id || ''}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-200 px-2 py-1.5 focus:outline-none"
          >
            <option value="" disabled className="bg-discord-card text-slate-400">
              Select Voice Channel
            </option>
            {voiceChannels.map((vc) => (
              <option key={vc.id} value={vc.id} className="bg-discord-card text-slate-200">
                🔊 #{vc.name}
              </option>
            ))}
          </select>

          {session?.voice_channel_id ? (
            <button
              onClick={onDisconnectVoice}
              className="text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg border border-rose-500/30 transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => {
                const target = selectedVoiceId || voiceChannels[0]?.id;
                const ch = voiceChannels.find((c) => c.id === target);
                if (target) onConnectVoice(target, ch?.name || 'Voice');
              }}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-md shadow-indigo-600/30"
            >
              Connect Bot
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Player Studio & Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Hero Player & Presets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Player Studio */}
          <div className="bg-gradient-to-br from-discord-card via-discord-dark to-slate-900 border border-slate-700/70 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Artwork with Rotating Pulse */}
              <div className="relative group shrink-0">
                <img
                  src={
                    currentTrack?.thumbnail ||
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop'
                  }
                  alt={currentTrack?.title || 'No Track'}
                  className="w-36 h-36 rounded-2xl object-cover border-2 border-slate-700 shadow-2xl group-hover:scale-105 transition-transform"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center">
                    <Disc3 className="w-10 h-10 text-white/90 animate-spin" />
                  </div>
                )}
              </div>

              {/* Track Details & Visualizer Bars */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                  {isPlaying ? '● Playing in Voice' : 'Paused / Idle'}
                </span>
                <h3 className="text-xl font-extrabold text-white leading-tight">
                  {currentTrack?.title || 'No Audio Playing'}
                </h3>
                <p className="text-sm text-slate-400">
                  {currentTrack?.artist || 'Select a track below or paste a source URL'}
                </p>

                {/* Animated Equalizer Waveform */}
                <div className="flex items-center justify-center sm:justify-start gap-1 h-6 pt-2">
                  {[40, 70, 95, 60, 85, 45, 100, 65, 80, 50, 90, 75].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full bg-indigo-500 transition-all duration-300 ${
                        isPlaying ? 'animate-pulse' : 'opacity-30'
                      }`}
                      style={{
                        height: isPlaying ? `${Math.max(20, (h * (i % 3 + 1)) % 100)}%` : '20%',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Interactive Controls */}
            <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={isPlaying ? onPause : onResume}
                  disabled={!currentTrack}
                  className="bg-white hover:bg-slate-200 text-slate-900 font-bold px-6 py-2.5 rounded-xl flex items-center space-x-2 text-sm transition-all disabled:opacity-40"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlaying ? 'Pause Stream' : 'Resume Play'}</span>
                </button>

                <button
                  onClick={onSkip}
                  disabled={!currentTrack}
                  className="bg-discord-card hover:bg-discord-hover text-slate-300 px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold flex items-center space-x-2 transition-colors disabled:opacity-40"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>Skip</span>
                </button>

                <button
                  onClick={onStop}
                  disabled={!currentTrack}
                  className="bg-discord-card hover:bg-discord-hover text-slate-300 px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Stop
                </button>
              </div>

              {/* Volume Slider */}
              <div className="hidden sm:flex items-center space-x-3 bg-discord-dark/50 px-3.5 py-2 rounded-xl border border-slate-800">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={session?.volume ?? 80}
                  onChange={(e) => onVolume(Number(e.target.value))}
                  className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-xs font-mono text-slate-300">{session?.volume ?? 80}%</span>
              </div>
            </div>
          </div>

          {/* Quick Play Presets */}
          <div className="bg-discord-card border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Quick Play Preset Audio Streams
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRESET_TRACKS.map((t) => (
                <div
                  key={t.id}
                  className="bg-discord-dark/50 hover:bg-discord-dark border border-slate-800/80 hover:border-slate-700 p-3 rounded-xl flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <img
                      src={t.thumbnail}
                      alt={t.title}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-700"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{t.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => onPlay(t, selectedVoiceId || voiceChannels[0]?.id)}
                      title="Play Now"
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => onAddToQueue(t)}
                      title="Add to Queue"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Add Custom Audio & Queue List */}
        <div className="space-y-6">
          {/* Custom Stream Input Form */}
          <div className="bg-discord-card border border-slate-800 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              Add Audio to Queue
            </h4>
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Track Title / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Community Gaming Anthem"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-discord-dark border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Stream URL / Audio Link
                </label>
                <input
                  type="text"
                  placeholder="https://... audio stream URL"
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="w-full bg-discord-dark border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-discord-brand hover:bg-discord-brand/90 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-discord-brand/20"
              >
                Enqueue Track
              </button>
            </form>
          </div>

          {/* Up Next Queue */}
          <div className="bg-discord-card border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ListMusic className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Upcoming Queue ({queue.length})</h4>
              </div>
            </div>

            {queue.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-discord-dark/50 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <span className="text-[11px] font-mono text-slate-500 w-4">{idx + 1}.</span>
                      <span className="font-semibold text-slate-200 truncate">{item.track_title}</span>
                    </div>
                    <button
                      onClick={() => onRemoveQueue(item.id)}
                      title="Remove from queue"
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">
                Queue is empty. Select a track or add one above!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Disc3,
  Radio,
} from 'lucide-react';
import { MusicSession } from '@hub/shared';

interface MusicPlayerBarProps {
  session: MusicSession | null;
  onPlayPause: () => void;
  onSkip: () => void;
  onStop: () => void;
  onVolumeChange: (vol: number) => void;
}

export const MusicPlayerBar: React.FC<MusicPlayerBarProps> = ({
  session,
  onPlayPause,
  onSkip,
  onStop,
  onVolumeChange,
}) => {
  const isPlaying = session?.playback_status === 'playing';
  const track = session?.current_track;
  const position = session?.position_seconds || 0;
  const duration = session?.duration_seconds || 180;
  const volume = session?.volume ?? 80;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = Math.min(100, Math.max(0, (position / (duration || 1)) * 100));

  return (
    <div className="h-20 bg-discord-card/95 backdrop-blur-lg border-t border-slate-700/60 px-6 flex items-center justify-between sticky bottom-0 z-40">
      {/* Left: Track Information */}
      <div className="flex items-center space-x-3.5 w-1/4 min-w-[200px]">
        {track ? (
          <>
            <div className="relative group">
              <img
                src={
                  track.thumbnail ||
                  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'
                }
                alt={track.title}
                className="w-12 h-12 rounded-lg object-cover border border-slate-700 shadow-md"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <Disc3 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                <span>{track.artist || 'Stream Source'}</span>
                {session?.voice_channel_name && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">#{session.voice_channel_name}</span>
                  </>
                )}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-2 text-slate-400">
            <Radio className="w-5 h-5 text-slate-500" />
            <span className="text-xs font-medium">No track currently active</span>
          </div>
        )}
      </div>

      {/* Middle: Controls & Progress Bar */}
      <div className="flex flex-col items-center w-2/4 max-w-xl space-y-1.5">
        <div className="flex items-center space-x-4">
          <button
            onClick={onStop}
            disabled={!track}
            title="Stop Playback"
            className="p-2 text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={onPlayPause}
            disabled={!track}
            title={isPlaying ? 'Pause' : 'Play'}
            className="w-10 h-10 rounded-full bg-white text-slate-900 hover:scale-105 active:scale-95 flex items-center justify-center transition-all disabled:opacity-40 shadow-lg shadow-white/10"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={onSkip}
            disabled={!track}
            title="Skip Track"
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span>{formatTime(position)}</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume Control */}
      <div className="flex items-center justify-end space-x-3 w-1/4 min-w-[160px]">
        <button
          onClick={() => onVolumeChange(volume === 0 ? 80 : 0)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <span className="text-xs text-slate-400 font-mono w-7 text-right">{volume}%</span>
      </div>
    </div>
  );
};

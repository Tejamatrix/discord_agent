import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Disc,
  FileAudio,
  Flame,
  FolderUp,
  Headphones,
  Link,
  Lock,
  LogOut,
  Mic,
  MicOff,
  Music,
  Play,
  Plus,
  Radio,
  Send,
  Server,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
  Activity,
  Sliders,
  Menu,
  ChevronRight,
  User,
  Users,
} from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar_url: string;
  email?: string | null;
  phone?: string | null;
  premium_type?: number;
}

interface Guild {
  id: string;
  name: string;
  icon_url: string;
  owner: boolean;
  approximate_member_count?: number;
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement' | 'category' | 'other';
  position: number;
  canJoin?: boolean;
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

export interface SoundItem {
  id: string;
  name: string;
  filename: string;
  size: number;
  url: string;
  isPreset?: boolean;
}

export interface SlotSummary {
  slot: number;
  connected: boolean;
  profile: UserProfile | null;
  voiceState: VoiceStateInfo;
}

interface AccountDashboardProps {
  profile: UserProfile | null;
  guilds: Guild[];
  activeGuild: Guild | null;
  channels: Channel[];
  voiceState: VoiceStateInfo;
  sounds: SoundItem[];
  isAdmin: boolean;
  adminEmail?: string | null;
  activeKey?: string | null;
  maxTokensAllowed: number;
  soundTier: 'standard' | 'admin_peaks';
  slots: SlotSummary[];
  activeSlotIndex: number;
  onSelectSlot: (slotIndex: number) => void;
  onConnectSlotToken: (slotIndex: number, token: string) => Promise<{ success: boolean; error?: string } | boolean>;
  onDisconnectSlot: (slotIndex: number) => Promise<boolean>;
  onOpenAdminModal: () => void;
  onBroadcastPlay?: (soundId?: string, audioUrl?: string, boost?: boolean) => Promise<boolean>;
  onBroadcastStop?: () => void;
  onSelectGuild: (guild: Guild) => void;
  onJoinServer: (invite: string) => Promise<{ success: boolean; message?: string }>;
  onLeaveServer: (guildId: string) => Promise<boolean>;
  onSendMessage: (channelId: string, content: string, tts: boolean) => Promise<boolean>;
  onJoinVoice: (guildId: string, channelId: string) => Promise<boolean>;
  onLeaveVoice: () => Promise<boolean>;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: (mute: boolean) => void;
  onDeafToggle: (deaf: boolean) => void;
  onUploadAudio: (file: File) => Promise<{ success: boolean; error?: string; soundId?: string } | boolean>;
  onPlaySound: (soundId: string, boost: boolean, mode?: 'individual' | 'joint') => Promise<boolean>;
  onPlayUrl?: (audioUrl: string, boost: boolean, mode?: 'individual' | 'joint') => Promise<boolean>;
  onDeleteSound: (soundId: string) => Promise<boolean>;
  onStopAudio: (mode?: 'individual' | 'joint') => void;
  onDisconnect: () => void;
  onLogoutSession?: () => void;
}

export const AccountDashboard: React.FC<AccountDashboardProps> = ({
  profile,
  guilds,
  activeGuild,
  channels,
  voiceState,
  sounds,
  isAdmin,
  adminEmail,
  activeKey,
  maxTokensAllowed,
  soundTier,
  slots,
  activeSlotIndex,
  onSelectSlot,
  onConnectSlotToken,
  onDisconnectSlot,
  onOpenAdminModal,
  onBroadcastPlay,
  onBroadcastStop,
  onSelectGuild,
  onJoinServer,
  onLeaveServer,
  onSendMessage,
  onJoinVoice,
  onLeaveVoice,
  onVolumeChange,
  onMuteToggle,
  onDeafToggle,
  onUploadAudio,
  onPlaySound,
  onPlayUrl,
  onDeleteSound,
  onStopAudio,
  onDisconnect,
  onLogoutSession,
}) => {
  const [inviteInput, setInviteInput] = useState('');
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [tts, setTts] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [boostActive, setBoostActive] = useState(true);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'individual' | 'joint'>('individual');
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [activeAudioTab, setActiveAudioTab] = useState<'my-audios' | 'presets'>('my-audios');
  const [urlInput, setUrlInput] = useState('');
  const [streamingUrl, setStreamingUrl] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [connectSlotModal, setConnectSlotModal] = useState<number | null>(null);
  const [slotTokenInput, setSlotTokenInput] = useState('');
  const [connectingSlot, setConnectingSlot] = useState(false);

  // Mobile View Navigation Tab: 'servers' | 'studio' | 'channels'
  const [mobileTab, setMobileTab] = useState<'studio' | 'servers' | 'channels'>('studio');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const instantPlayInputRef = useRef<HTMLInputElement | null>(null);

  const isHighPeaks = isAdmin || soundTier === 'admin_peaks';
  const maxVolume = isHighPeaks ? 300 : 100;

  const userAudios = sounds.filter((s) => !s.isPreset);
  const presetSounds = sounds.filter((s) => s.isPreset);

  // Reset playing sound ID when audio playback ends
  useEffect(() => {
    if (!voiceState.isPlayingAudio) {
      setPlayingSoundId(null);
    }
  }, [voiceState.isPlayingAudio]);

  const textChannels = channels.filter((c) => c.type === 'text' || c.type === 'announcement');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  const handleJoinServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setJoiningInvite(true);
    const res = await onJoinServer(inviteInput.trim());
    setJoiningInvite(false);
    if (res.success) {
      setInviteInput('');
      setBanner({ text: res.message || 'Account successfully joined server!', type: 'success' });
      setTimeout(() => setBanner(null), 5000);
    } else {
      setBanner({ text: res.message || 'Failed to join server.', type: 'error' });
      setTimeout(() => setBanner(null), 5000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetChannel = selectedChannelId || textChannels[0]?.id;
    if (!targetChannel || !messageContent.trim()) return;

    setSendingMsg(true);
    const ok = await onSendMessage(targetChannel, messageContent, tts);
    setSendingMsg(false);
    if (ok) {
      setMessageContent('');
      setBanner({ text: 'Message posted from your Discord account!', type: 'success' });
      setTimeout(() => setBanner(null), 3000);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      setBanner({
        text: 'The selected file is empty (0 KB). Please pick a valid audio file.',
        type: 'error',
      });
      setTimeout(() => setBanner(null), 6000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const res = await onUploadAudio(file);
    setUploading(false);

    const isSuccess = typeof res === 'boolean' ? res : res.success;
    const errorMsg = typeof res === 'object' ? res.error : undefined;

    if (isSuccess) {
      setActiveAudioTab('my-audios');
      setBanner({ text: `"${file.name}" saved to Soundboard! Click "Play in VC" to stream it.`, type: 'success' });
      setTimeout(() => setBanner(null), 5000);
    } else {
      setBanner({ text: errorMsg || `Failed to upload "${file.name}"`, type: 'error' });
      setTimeout(() => setBanner(null), 6000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInstantPlayFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      setBanner({
        text: 'The selected file is empty (0 KB). Please choose a valid audio file.',
        type: 'error',
      });
      setTimeout(() => setBanner(null), 6000);
      if (instantPlayInputRef.current) instantPlayInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setBanner({
      text: playbackMode === 'joint'
        ? `Uploading "${file.name}" & joint broadcasting to all connected accounts in VC...`
        : `Uploading "${file.name}" & streaming on Slot 0${activeSlotIndex + 1}...`,
      type: 'success',
    });
    const res = await onUploadAudio(file);
    setUploading(false);

    const isSuccess = typeof res === 'boolean' ? res : res.success;
    const soundId = typeof res === 'object' ? res.soundId : undefined;
    const errorMsg = typeof res === 'object' ? res.error : undefined;

    if (isSuccess && soundId) {
      setPlayingSoundId(soundId);
      setActiveAudioTab('my-audios');
      await onPlaySound(soundId, boostActive, playbackMode);
      setBanner({
        text: playbackMode === 'joint'
          ? `Now playing "${file.name}" jointly across all connected accounts in VC!`
          : `Now playing "${file.name}" live on Slot 0${activeSlotIndex + 1}!`,
        type: 'success',
      });
      setTimeout(() => setBanner(null), 5000);
    } else {
      setBanner({ text: errorMsg || 'Failed to start instant playback', type: 'error' });
      setTimeout(() => setBanner(null), 6000);
    }
    if (instantPlayInputRef.current) instantPlayInputRef.current.value = '';
  };

  const handleStreamUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !onPlayUrl) return;

    setStreamingUrl(true);
    const ok = await onPlayUrl(urlInput.trim(), boostActive, playbackMode);
    setStreamingUrl(false);

    if (ok) {
      setUrlInput('');
      setBanner({
        text: playbackMode === 'joint'
          ? 'Streaming URL jointly across all connected accounts in VC!'
          : `Streaming URL live into voice channel on Slot 0${activeSlotIndex + 1}!`,
        type: 'success',
      });
      setTimeout(() => setBanner(null), 4000);
    } else {
      setBanner({ text: 'Could not stream URL. Make sure your account is connected to a VC and that the link points to a valid audio file.', type: 'error' });
      setTimeout(() => setBanner(null), 6000);
    }
  };

  const handleTriggerSound = async (soundId: string) => {
    setPlayingSoundId(soundId);
    let ok = false;
    if (playbackMode === 'joint') {
      ok = await onPlaySound(soundId, boostActive, 'joint');
    } else {
      ok = await onPlaySound(soundId, boostActive, 'individual');
    }

    if (!ok) {
      setPlayingSoundId(null);
      if (!voiceState.connected) {
        setBanner({ text: 'Please connect to a voice channel first (in Discord or from the Voice Channels section)!', type: 'error' });
        setTimeout(() => setBanner(null), 5000);
      }
    }
  };

  const handleStopSound = () => {
    setPlayingSoundId(null);
    onStopAudio(playbackMode);
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] flex flex-col text-black selection:bg-[#FFE600] selection:text-black">
      {/* Neo-Brutalist Top Header */}
      <header className="bg-white border-b-3 border-black px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 shadow-neo-sm">
        {/* Left: App Logo & Brand Badges */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="btn-neo btn-neo-white p-2 md:hidden"
            title="Toggle Servers Menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-[#FFE600] border-2 border-black flex items-center justify-center shadow-neo-sm">
            <Radio className="w-5 h-5 text-black" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xs sm:text-sm font-black uppercase tracking-tight text-black">
                VOICE STUDIO
              </h1>
              <span
                className={`badge-neo text-[9px] sm:text-[10px] px-1.5 py-0.5 ${
                  isAdmin
                    ? 'bg-[#FFE600] text-black'
                    : 'bg-[#A78BFA] text-black'
                }`}
              >
                {isAdmin ? '👑 ADMIN 300%' : `🔑 ${maxTokensAllowed} SLOTS`}
              </span>
            </div>
            <p className="text-[10px] font-mono font-bold text-gray-500 hidden sm:block">
              DISCORD DAVE PROTOCOL
            </p>
          </div>
        </div>

        {/* Right: Actions, Live VC Status, Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Admin Dashboard Button */}
          {isAdmin ? (
            <button
              onClick={onOpenAdminModal}
              className="btn-neo btn-neo-yellow px-2.5 sm:px-3 py-1.5 text-xs font-black uppercase flex items-center space-x-1.5 shadow-neo-sm"
            >
              <Crown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Dashboard</span>
              <span className="sm:hidden">Admin</span>
            </button>
          ) : (
            <div className="hidden lg:flex items-center space-x-1.5 badge-neo bg-white px-2 py-1 text-[11px] font-mono">
              <span>{maxTokensAllowed} Token Plan</span>
              <span>•</span>
              <span className={isHighPeaks ? 'text-amber-600 font-black' : 'text-black'}>
                {isHighPeaks ? '300% Peaks' : '100% Master'}
              </span>
            </div>
          )}

          {/* Live VC Mini Status */}
          {voiceState.connected && (
            <div className="hidden md:flex items-center space-x-2 bg-[#DCFCE7] border-2 border-black px-2.5 py-1 rounded-lg shadow-neo-sm text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="truncate max-w-[140px]">
                Slot 0{activeSlotIndex + 1}: #{voiceState.channelName || 'Voice'}
              </span>

              <div className="flex items-center space-x-1 pl-1.5 border-l-2 border-black">
                <Volume2 className="w-3.5 h-3.5" />
                <input
                  type="range"
                  min="0"
                  max={maxVolume}
                  value={voiceState.volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-16 h-1.5 cursor-pointer"
                />
                <span className="font-mono text-[10px] w-8">{voiceState.volume}%</span>
              </div>

              <button
                onClick={() => onMuteToggle(!voiceState.selfMute)}
                className={`btn-neo p-1 text-[10px] ${voiceState.selfMute ? 'btn-neo-coral' : 'btn-neo-white'}`}
                title={voiceState.selfMute ? 'Unmute' : 'Mute'}
              >
                {voiceState.selfMute ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              </button>

              <button
                onClick={onLeaveVoice}
                className="btn-neo btn-neo-coral px-1.5 py-0.5 text-[10px] font-black"
              >
                Leave
              </button>
            </div>
          )}

          {/* Connected User Profile */}
          {profile ? (
            <div className="flex items-center space-x-2 bg-white border-2 border-black px-2 py-1 rounded-lg shadow-neo-sm">
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-6 h-6 rounded border border-black object-cover"
              />
              <div className="hidden sm:block text-left text-xs leading-none">
                <p className="font-black text-black truncate max-w-[100px]">{profile.username}</p>
                <p className="text-[9px] font-mono font-bold text-gray-500">SLOT 0{activeSlotIndex + 1}</p>
              </div>

              <button
                onClick={() => onDisconnectSlot(activeSlotIndex)}
                title="Disconnect Slot"
                className="btn-neo btn-neo-white p-1 ml-1"
              >
                <LogOut className="w-3 h-3 text-red-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setConnectSlotModal(activeSlotIndex);
                setSlotTokenInput('');
              }}
              className="btn-neo btn-neo-yellow px-2.5 py-1 text-xs font-black uppercase"
            >
              <Plus className="w-3 h-3 mr-1" />
              <span>Connect Slot {activeSlotIndex + 1}</span>
            </button>
          )}

          {/* Logout / Exit Portal Button */}
          {onLogoutSession && (
            <button
              onClick={onLogoutSession}
              title="Log out and return to Login Portal"
              className="btn-neo btn-neo-coral px-2.5 sm:px-3 py-1.5 text-xs font-black uppercase flex items-center space-x-1.5 shadow-neo-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Multi-Token Slot Rack */}
      <div className="bg-[#FAF8F5] border-b-3 border-black px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shadow-neo-sm">
        <div className="flex items-center space-x-2 overflow-x-auto py-0.5 w-full sm:w-auto">
          <span className="badge-neo bg-black text-white px-2 py-1 text-[10px] font-mono shrink-0">
            SLOTS:
          </span>

          <div className="flex items-center space-x-2 shrink-0">
            {Array.from({ length: Math.max(3, isAdmin ? 3 : maxTokensAllowed) }, (_, i) => i).map((slotIdx) => {
              const slotInfo = slots[slotIdx] || { slot: slotIdx, connected: false, profile: null, voiceState: { connected: false } };
              const isSlotUnlocked = isAdmin || slotIdx < maxTokensAllowed;
              const isActiveSlot = activeSlotIndex === slotIdx;

              if (!isSlotUnlocked) {
                return (
                  <div
                    key={slotIdx}
                    title="Key permits fewer slots. Ask Admin for Multi-Token access."
                    className="flex items-center space-x-1.5 bg-gray-200 border-2 border-black text-gray-500 px-2.5 py-1 rounded-lg text-xs font-bold cursor-not-allowed select-none opacity-60"
                  >
                    <Lock className="w-3 h-3" />
                    <span className="font-mono text-[11px]">Slot 0{slotIdx + 1}</span>
                  </div>
                );
              }

              if (!slotInfo.connected || !slotInfo.profile) {
                return (
                  <button
                    key={slotIdx}
                    onClick={() => {
                      setConnectSlotModal(slotIdx);
                      setSlotTokenInput('');
                    }}
                    className={`btn-neo px-2.5 py-1 text-xs font-black uppercase ${
                      isActiveSlot ? 'btn-neo-yellow' : 'btn-neo-white border-dashed'
                    }`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>Slot 0{slotIdx + 1}</span>
                  </button>
                );
              }

              return (
                <div
                  key={slotIdx}
                  onClick={() => onSelectSlot(slotIdx)}
                  className={`btn-neo px-2.5 py-1 text-xs font-black flex items-center space-x-1.5 cursor-pointer ${
                    isActiveSlot ? 'btn-neo-yellow ring-2 ring-black' : 'btn-neo-white'
                  }`}
                >
                  <img
                    src={slotInfo.profile.avatar_url}
                    alt={slotInfo.profile.username}
                    className="w-4 h-4 rounded border border-black"
                  />
                  <span className="truncate max-w-[90px]">{slotInfo.profile.username}</span>
                  {slotInfo.voiceState?.connected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 border border-black" title="In Voice Channel" />
                  )}
                  {slotInfo.voiceState?.isPlayingAudio && (
                    <span className="badge-neo bg-[#FFE600] text-black px-1.5 py-0.2 text-[8px] animate-pulse">
                      🎵 Playing
                    </span>
                  )}
                  {isActiveSlot && (
                    <span className="badge-neo bg-black text-white px-1 py-0.2 text-[8px]">
                      ACTIVE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Individual Player vs Joint Player Mode Switcher */}
        {slots.filter((s) => s.connected).length > 1 && (
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setPlaybackMode('individual')}
              className={`btn-neo px-2.5 py-1 text-[11px] font-black uppercase flex items-center gap-1 ${
                playbackMode === 'individual' ? 'btn-neo-yellow' : 'btn-neo-white'
              }`}
            >
              <User className="w-3 h-3" />
              <span>👤 Individual</span>
            </button>
            <button
              type="button"
              onClick={() => setPlaybackMode('joint')}
              className={`btn-neo px-2.5 py-1 text-[11px] font-black uppercase flex items-center gap-1 ${
                playbackMode === 'joint' ? 'btn-neo-coral' : 'btn-neo-white'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>🤝 Joint Sync</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile-Friendly View Switcher Tabs (Only visible on small screens) */}
      <div className="md:hidden bg-white border-b-2 border-black px-3 py-1.5 flex justify-between gap-1 shadow-neo-sm">
        <button
          onClick={() => setMobileTab('studio')}
          className={`btn-neo flex-1 py-1.5 text-xs font-black uppercase ${
            mobileTab === 'studio' ? 'btn-neo-yellow' : 'btn-neo-white'
          }`}
        >
          🎛️ Studio
        </button>
        <button
          onClick={() => setMobileTab('servers')}
          className={`btn-neo flex-1 py-1.5 text-xs font-black uppercase ${
            mobileTab === 'servers' ? 'btn-neo-yellow' : 'btn-neo-white'
          }`}
        >
          📻 Servers ({guilds.length})
        </button>
        <button
          onClick={() => setMobileTab('channels')}
          className={`btn-neo flex-1 py-1.5 text-xs font-black uppercase ${
            mobileTab === 'channels' ? 'btn-neo-yellow' : 'btn-neo-white'
          }`}
        >
          🔊 Channels ({voiceChannels.length})
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Servers (Desktop standard, Mobile tab or slide drawer) */}
        <aside
          className={`${
            mobileTab === 'servers' || mobileSidebarOpen ? 'block' : 'hidden'
          } md:block w-full md:w-80 bg-white border-r-3 border-black flex flex-col p-4 shrink-0 overflow-y-auto space-y-4`}
        >
          {/* Join Server by Invite */}
          <div className="card-neo p-4 space-y-2.5 bg-[#FAF8F5]">
            <h3 className="text-xs font-black uppercase tracking-tight text-black flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-black" />
              <span>Join Server via Invite</span>
            </h3>
            <form onSubmit={handleJoinServer} className="space-y-2">
              <input
                type="text"
                placeholder="discord.gg/xyz or invite"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                className="input-neo w-full text-xs py-2 px-3 font-mono"
              />
              <button
                type="submit"
                disabled={joiningInvite || !inviteInput.trim()}
                className="btn-neo btn-neo-yellow w-full py-2 text-xs font-black uppercase flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{joiningInvite ? 'Auto-Joining...' : 'Auto-Join Server'}</span>
              </button>
            </form>
          </div>

          {/* Joined Servers List */}
          <div className="space-y-2 flex-1">
            <div className="flex justify-between items-center px-1">
              <span className="badge-neo bg-black text-white px-2 py-0.5 text-[10px] font-mono">
                JOINED SERVERS ({guilds.length})
              </span>
            </div>

            <div className="space-y-2">
              {guilds.map((g) => {
                const isSelected = activeGuild?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      onSelectGuild(g);
                      setMobileTab('studio');
                      setMobileSidebarOpen(false);
                    }}
                    className={`card-neo p-2.5 flex items-center justify-between cursor-pointer transition-all group ${
                      isSelected
                        ? 'bg-[#FFE600] shadow-neo-lg scale-[1.01]'
                        : 'bg-white hover:bg-yellow-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      {g.icon_url ? (
                        <img
                          src={g.icon_url}
                          alt={g.name}
                          className="w-9 h-9 rounded-lg border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-lg border-2 border-black flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected ? 'bg-black text-white' : 'bg-gray-100 text-black'
                          }`}
                        >
                          {g.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs font-black truncate text-black">{g.name}</p>
                        {g.approximate_member_count && (
                          <p className="text-[10px] font-mono font-bold text-gray-600">
                            {g.approximate_member_count} members
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Leave server "${g.name}" with your active account?`)) {
                          onLeaveServer(g.id);
                        }
                      }}
                      title="Leave Server"
                      className="btn-neo btn-neo-white p-1 hover:btn-neo-coral"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-black" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Content Workspace */}
        <main
          className={`${
            mobileTab === 'servers' ? 'hidden md:block' : 'block'
          } flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-6xl`}
        >
          {banner && (
            <div
              className={`border-3 border-black p-3.5 rounded-xl shadow-neo font-bold text-xs sm:text-sm flex items-center space-x-2.5 ${
                banner.type === 'success' ? 'bg-[#DCFCE7] text-black' : 'bg-[#FF6B6B] text-black'
              }`}
            >
              {banner.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
          )}

          {activeGuild ? (
            <div className="space-y-6">
              {/* Active Server Card */}
              <div className="card-neo p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3.5">
                  {activeGuild.icon_url ? (
                    <img
                      src={activeGuild.icon_url}
                      alt={activeGuild.name}
                      className="w-12 h-12 rounded-xl border-2 border-black object-cover shadow-neo-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#FFE600] border-2 border-black flex items-center justify-center font-black text-black text-lg shadow-neo-sm">
                      {activeGuild.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-base sm:text-lg font-black uppercase text-black">
                      {activeGuild.name}
                    </h2>
                    <p className="text-xs font-mono font-bold text-gray-500 mt-0.5">
                      ID: {activeGuild.id} • {channels.length} Channels Accessible
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to leave ${activeGuild.name}?`)) {
                      onLeaveServer(activeGuild.id);
                    }
                  }}
                  className="btn-neo btn-neo-coral px-3 py-1.5 text-xs font-black uppercase self-start sm:self-auto"
                >
                  Leave Server
                </button>
              </div>

              {/* SECTION: DIGITAL AUDIO STUDIO & SOUNDBOARD */}
              {(mobileTab === 'studio' || window.innerWidth >= 768) && (
                <div className="card-neo p-4 sm:p-6 bg-white space-y-5 shadow-neo-lg">
                  {/* Mode Selector Deck: Individual vs Joint */}
                  <div className="bg-[#FAF8F5] border-3 border-black p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-neo-sm">
                    <div className="flex items-center space-x-2">
                      <span className="badge-neo bg-black text-white px-2 py-1 text-[10px] font-mono">
                        PLAYBACK MODE:
                      </span>
                      <span className="text-xs font-black uppercase text-black">
                        {playbackMode === 'individual'
                          ? `👤 Individual Player (Slot 0${activeSlotIndex + 1})`
                          : '🤝 Joint Player (All Connected Accounts in VC)'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setPlaybackMode('individual')}
                        className={`btn-neo px-3 py-1.5 text-xs font-black uppercase flex items-center gap-1.5 ${
                          playbackMode === 'individual' ? 'btn-neo-yellow' : 'btn-neo-white'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Individual Player</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlaybackMode('joint')}
                        className={`btn-neo px-3 py-1.5 text-xs font-black uppercase flex items-center gap-1.5 ${
                          playbackMode === 'joint' ? 'btn-neo-coral' : 'btn-neo-white'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>🤝 Joint Sync Player</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Audio Streaming Monitor Banner */}
                  {voiceState.isPlayingAudio && (
                    <div className={`p-4 rounded-xl border-3 border-black shadow-neo flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse ${
                      playbackMode === 'joint' ? 'bg-[#FF6B6B]' : 'bg-[#FFE600]'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-end space-x-1 h-6">
                          <span className="w-1.5 bg-black rounded-sm h-3 animate-bounce"></span>
                          <span className="w-1.5 bg-black rounded-sm h-6 animate-bounce [animation-delay:150ms]"></span>
                          <span className="w-1.5 bg-black rounded-sm h-4 animate-bounce [animation-delay:300ms]"></span>
                          <span className="w-1.5 bg-black rounded-sm h-5 animate-bounce [animation-delay:75ms]"></span>
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-black uppercase flex items-center gap-2">
                            <span>
                              {playbackMode === 'joint'
                                ? '🔥 JOINT AUDIO ACTIVE: PLAYING ACROSS ALL ACCOUNTS'
                                : `🔊 INDIVIDUAL AUDIO ACTIVE: SLOT 0${activeSlotIndex + 1} (${profile?.username})`}
                            </span>
                            <span className="badge-neo bg-black text-white px-2 py-0.5 text-[10px]">
                              {voiceState.volume}% {boostActive ? '• OVERDRIVE' : ''}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-black/80">
                            {voiceState.currentSoundName
                              ? `Track: "${voiceState.currentSoundName}" in #${voiceState.channelName || 'Voice'}`
                              : `Broadcasting live audio into #${voiceState.channelName || 'Voice'}`}
                            {playbackMode === 'individual' && ' • (Switch slots anytime to play a different sound on another account!)'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleStopSound}
                        className="btn-neo btn-neo-black text-white px-4 py-2 text-xs font-black uppercase flex items-center justify-center space-x-1.5 shrink-0"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>{playbackMode === 'joint' ? 'Stop Joint Playback' : 'Stop Slot Audio'}</span>
                      </button>
                    </div>
                  )}

                  {/* Header Deck: Controls & Loudness */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b-2 border-black/10">
                    <div>
                      <h3 className="text-base sm:text-lg font-black uppercase text-black flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-black" />
                        <span>
                          {playbackMode === 'individual'
                            ? `SLOT 0${activeSlotIndex + 1} INDIVIDUAL STUDIO`
                            : 'JOINT ALL-ACCOUNTS SYNC STUDIO'}
                        </span>
                      </h3>
                      <p className="text-xs font-bold text-gray-600 mt-0.5">
                        {playbackMode === 'individual'
                          ? 'Streaming audio only affects this account slot. Switch slots to stream different audios on each account.'
                          : 'Streaming audio will play this single sound combinely across all connected accounts in voice channels!'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Master Volume Slider Deck */}
                      <div className="flex items-center space-x-2 bg-[#F5F2EB] border-2 border-black px-3 py-1.5 rounded-xl shadow-neo-sm">
                        <Volume2 className="w-4 h-4 text-black" />
                        <input
                          type="range"
                          min="0"
                          max={maxVolume}
                          value={voiceState.volume}
                          onChange={(e) => onVolumeChange(Number(e.target.value))}
                          className="w-24 h-2 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-black w-10 text-black">
                          {voiceState.volume}%
                        </span>

                        <div className="flex items-center space-x-1 pl-1.5 border-l-2 border-black">
                          <button
                            type="button"
                            onClick={() => onVolumeChange(50)}
                            className={`btn-neo px-1.5 py-0.5 text-[10px] font-black ${
                              voiceState.volume === 50 ? 'btn-neo-yellow' : 'btn-neo-white'
                            }`}
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => onVolumeChange(100)}
                            className={`btn-neo px-1.5 py-0.5 text-[10px] font-black ${
                              voiceState.volume === 100 ? 'btn-neo-yellow' : 'btn-neo-white'
                            }`}
                          >
                            100%
                          </button>
                          {isHighPeaks && (
                            <>
                              <button
                                type="button"
                                onClick={() => onVolumeChange(200)}
                                className={`btn-neo px-1.5 py-0.5 text-[10px] font-black ${
                                  voiceState.volume === 200 ? 'btn-neo-yellow' : 'btn-neo-white'
                                }`}
                              >
                                200%
                              </button>
                              <button
                                type="button"
                                onClick={() => onVolumeChange(300)}
                                className={`btn-neo px-1.5 py-0.5 text-[10px] font-black ${
                                  voiceState.volume === 300 ? 'btn-neo-coral' : 'btn-neo-white'
                                }`}
                              >
                                300% 🔥
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Boost Button */}
                      <button
                        onClick={() => setBoostActive(!boostActive)}
                        className={`btn-neo px-3 py-1.5 text-xs font-black uppercase flex items-center space-x-1.5 ${
                          boostActive ? 'btn-neo-yellow' : 'btn-neo-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{boostActive ? (isHighPeaks ? '🔥 300% Peak Overdrive' : '🔊 Loud Boost Active') : 'Enable Boost'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Dual Broadcast Decks: File Broadcast & URL Streamer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF8F5] border-3 border-black rounded-xl p-4 shadow-neo-sm">
                    {/* Deck 1: Pick File & Play Live */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-1.5 text-black">
                        <FileAudio className="w-4 h-4 text-emerald-600" />
                        <span>Direct Audio File Broadcast</span>
                      </h4>
                      <p className="text-[11px] font-bold text-gray-600">
                        Pick any MP3, WAV, OGG, M4A or FLAC from your device. Stream immediately or save to library.
                      </p>

                      <input
                        type="file"
                        ref={instantPlayInputRef}
                        onChange={handleInstantPlayFile}
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus"
                        className="hidden"
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.opus"
                        className="hidden"
                      />

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={() => instantPlayInputRef.current?.click()}
                          disabled={uploading}
                          className="btn-neo btn-neo-lime px-3.5 py-2 text-xs font-black uppercase flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{uploading ? 'Processing...' : '⚡ Pick File & Play Immediately'}</span>
                        </button>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="btn-neo btn-neo-white px-3.5 py-2 text-xs font-black uppercase flex items-center space-x-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload to Library</span>
                        </button>
                      </div>
                    </div>

                    {/* Deck 2: Direct URL Streamer */}
                    <div className="space-y-2.5 border-t-2 md:border-t-0 md:border-l-2 border-black/10 pt-3 md:pt-0 md:pl-4">
                      <h4 className="text-xs font-black uppercase tracking-tight flex items-center gap-1.5 text-black">
                        <Link className="w-4 h-4 text-indigo-600" />
                        <span>Stream Direct Audio URL</span>
                      </h4>
                      <p className="text-[11px] font-bold text-gray-600">
                        Paste direct audio link to an MP3, WAV, or Discord audio attachment:
                      </p>

                      <form onSubmit={handleStreamUrl} className="flex items-center space-x-2 pt-1">
                        <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://example.com/audio.mp3"
                          className="input-neo flex-1 text-xs py-1.5 px-3 font-mono font-bold"
                        />
                        <button
                          type="submit"
                          disabled={streamingUrl || !urlInput.trim()}
                          className="btn-neo btn-neo-purple px-3.5 py-2 text-xs font-black uppercase flex items-center space-x-1.5 shrink-0 disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{streamingUrl ? 'Connecting...' : 'Stream URL'}</span>
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Soundboard Tabs */}
                  <div className="flex items-center space-x-2 border-b-2 border-black pb-2">
                    <button
                      onClick={() => setActiveAudioTab('my-audios')}
                      className={`btn-neo px-3 py-1.5 text-xs font-black uppercase flex items-center space-x-1.5 ${
                        activeAudioTab === 'my-audios' ? 'btn-neo-lime' : 'btn-neo-white'
                      }`}
                    >
                      <FolderUp className="w-3.5 h-3.5" />
                      <span>My Uploaded Audios ({userAudios.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveAudioTab('presets')}
                      className={`btn-neo px-3 py-1.5 text-xs font-black uppercase flex items-center space-x-1.5 ${
                        activeAudioTab === 'presets' ? 'btn-neo-yellow' : 'btn-neo-white'
                      }`}
                    >
                      <Disc className="w-3.5 h-3.5" />
                      <span>Built-in Presets ({presetSounds.length})</span>
                    </button>
                  </div>

                  {/* Tab 1: User Audios */}
                  {activeAudioTab === 'my-audios' && (
                    <div>
                      {userAudios.length === 0 ? (
                        <div className="text-center py-8 px-4 border-2 border-dashed border-black rounded-xl space-y-2 bg-[#FAF8F5]">
                          <FileAudio className="w-8 h-8 text-black mx-auto" />
                          <h4 className="text-xs sm:text-sm font-black uppercase text-black">
                            No custom audio files uploaded yet
                          </h4>
                          <p className="text-xs font-bold text-gray-600 max-w-sm mx-auto">
                            Click <strong className="text-black">"Pick File & Play Immediately"</strong> above to choose any MP3 or WAV from your device!
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                          {userAudios.map((sound) => {
                            const isPlaying = voiceState.isPlayingAudio && playingSoundId === sound.id;
                            return (
                              <div
                                key={sound.id}
                                className={`card-neo p-3 flex flex-col justify-between transition-all group ${
                                  isPlaying ? 'bg-[#DCFCE7] shadow-neo-lg ring-2 ring-black' : 'bg-white'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="badge-neo bg-[#4ADE80] text-black px-1.5 py-0.5 text-[9px]">
                                      CUSTOM AUDIO
                                    </span>
                                    <button
                                      onClick={() => onDeleteSound(sound.id)}
                                      title="Delete Sound"
                                      className="btn-neo btn-neo-white p-1 hover:btn-neo-coral"
                                    >
                                      <Trash2 className="w-3 h-3 text-black" />
                                    </button>
                                  </div>
                                  <h4 className="text-xs font-black truncate text-black" title={sound.name}>
                                    {sound.name}
                                  </h4>
                                  <p className="text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                    {(sound.size / 1024).toFixed(0)} KB • Ready to stream
                                  </p>
                                </div>

                                <div className="mt-3 pt-2 border-t-2 border-black/10">
                                  {isPlaying ? (
                                    <button
                                      onClick={handleStopSound}
                                      className="btn-neo btn-neo-coral w-full py-1.5 text-xs font-black uppercase flex items-center justify-center space-x-1.5"
                                    >
                                      <Square className="w-3 h-3" />
                                      <span>Stop Audio</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleTriggerSound(sound.id)}
                                      className="btn-neo btn-neo-lime w-full py-1.5 text-xs font-black uppercase flex items-center justify-center space-x-1.5"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      <span>{playbackMode === 'joint' ? '⚡ Play Jointly (All Accounts)' : `Play on Slot 0${activeSlotIndex + 1}`}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Built-in Presets */}
                  {activeAudioTab === 'presets' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {presetSounds.map((sound) => {
                        const isPlaying = voiceState.isPlayingAudio && playingSoundId === sound.id;
                        return (
                          <div
                            key={sound.id}
                            className={`card-neo p-3 flex flex-col justify-between transition-all group ${
                              isPlaying ? 'bg-[#FFE600] shadow-neo-lg ring-2 ring-black' : 'bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="badge-neo bg-[#FFE600] text-black px-1.5 py-0.5 text-[9px]">
                                  HIGH SOUND PRESET
                                </span>
                              </div>
                              <h4 className="text-xs font-black truncate text-black" title={sound.name}>
                                {sound.name}
                              </h4>
                              <p className="text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                {(sound.size / 1024).toFixed(0)} KB • Built-in Sound
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t-2 border-black/10">
                              {isPlaying ? (
                                <button
                                  onClick={handleStopSound}
                                  className="btn-neo btn-neo-coral w-full py-1.5 text-xs font-black uppercase flex items-center justify-center space-x-1.5"
                                >
                                  <Square className="w-3 h-3" />
                                  <span>Stop Audio</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleTriggerSound(sound.id)}
                                  className="btn-neo btn-neo-yellow w-full py-1.5 text-xs font-black uppercase flex items-center justify-center space-x-1.5"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>{playbackMode === 'joint' ? '⚡ Play Jointly (All Accounts)' : `Play on Slot 0${activeSlotIndex + 1}`}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Grid: Voice Channels & Text Message Dispatcher */}
              {(mobileTab === 'channels' || window.innerWidth >= 768) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Voice Channels Controller */}
                  <div className="card-neo p-4 sm:p-5 bg-white space-y-4 shadow-neo">
                    <div className="flex justify-between items-center border-b-2 border-black pb-2">
                      <h3 className="text-xs sm:text-sm font-black uppercase text-black flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-black" />
                        <span>Voice Channels ({voiceChannels.length})</span>
                      </h3>
                    </div>

                    {voiceChannels.length > 0 ? (
                      <div className="space-y-2">
                        {voiceChannels.map((vc) => {
                          const isThisConnected = voiceState.channelId === vc.id;
                          const canJoin = vc.canJoin !== false;
                          const otherSlotsInChannel = slots.filter(
                            (s) => s.slot !== activeSlotIndex && s.connected && s.voiceState?.channelId === vc.id
                          );

                          return (
                            <div
                              key={vc.id}
                              className={`card-neo p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
                                isThisConnected ? 'bg-[#DCFCE7]' : 'bg-[#FAF8F5]'
                              }`}
                            >
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                  {canJoin ? (
                                    <span className="font-mono text-base">🔊</span>
                                  ) : (
                                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                                  )}
                                  <span className={`font-black ${canJoin ? 'text-black' : 'text-gray-500'}`}>
                                    #{vc.name}
                                  </span>
                                  {isThisConnected && (
                                    <span className="badge-neo bg-[#4ADE80] text-black px-1.5 py-0.2 text-[9px]">
                                      SLOT 0{activeSlotIndex + 1} CONNECTED
                                    </span>
                                  )}
                                </div>

                                {otherSlotsInChannel.length > 0 && (
                                  <div className="flex items-center gap-1 pl-6">
                                    {otherSlotsInChannel.map((os) => (
                                      <span
                                        key={os.slot}
                                        className="badge-neo bg-[#FFE600] text-black px-1.5 py-0.2 text-[8px]"
                                      >
                                        Slot 0{os.slot + 1} ({os.profile?.username}) also here
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                {isThisConnected ? (
                                  <button
                                    onClick={onLeaveVoice}
                                    className="btn-neo btn-neo-coral px-3 py-1.5 text-xs font-black uppercase"
                                  >
                                    Leave VC (Slot 0{activeSlotIndex + 1})
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onJoinVoice(activeGuild.id, vc.id)}
                                    disabled={!canJoin}
                                    className="btn-neo btn-neo-lime px-3 py-1.5 text-xs font-black uppercase disabled:opacity-40"
                                  >
                                    {canJoin ? `Join VC (Slot 0${activeSlotIndex + 1})` : 'Locked'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-gray-500">No voice channels visible in this server.</p>
                    )}
                  </div>

                  {/* 2. Text Message Sender */}
                  <div className="card-neo p-4 sm:p-5 bg-white space-y-4 shadow-neo">
                    <h3 className="text-xs sm:text-sm font-black uppercase text-black flex items-center gap-2 border-b-2 border-black pb-2">
                      <Send className="w-4 h-4 text-black" />
                      <span>Send Message as Account</span>
                    </h3>

                    <form onSubmit={handleSendMessage} className="space-y-3">
                      <div>
                        <label className="text-xs font-black uppercase text-black block mb-1">
                          Target Channel
                        </label>
                        <select
                          value={selectedChannelId || textChannels[0]?.id || ''}
                          onChange={(e) => setSelectedChannelId(e.target.value)}
                          className="input-neo w-full text-xs py-2 px-3 font-bold"
                        >
                          {textChannels.map((tc) => (
                            <option key={tc.id} value={tc.id}>
                              # {tc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase text-black block mb-1">
                          Message Content
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Type message to post from your account..."
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          className="input-neo w-full text-xs p-3 font-mono resize-none font-bold"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF8F5] border-2 border-black text-xs font-black">
                        <span>Text-to-Speech (TTS)</span>
                        <input
                          type="checkbox"
                          checked={tts}
                          onChange={(e) => setTts(e.target.checked)}
                          className="w-4 h-4 accent-black rounded cursor-pointer"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sendingMsg || !messageContent.trim()}
                        className="btn-neo btn-neo-yellow w-full py-2.5 text-xs font-black uppercase flex items-center justify-center space-x-1.5 shadow-neo disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingMsg ? 'Posting Message...' : 'Send Message as Account'}</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : !profile ? (
            <div className="text-center py-12 px-4 card-neo bg-white space-y-4 max-w-lg mx-auto shadow-neo-lg my-8">
              <div className="w-16 h-16 bg-[#FFE600] border-3 border-black rounded-2xl mx-auto flex items-center justify-center shadow-neo">
                <Radio className="w-8 h-8 text-black" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black uppercase text-black">
                  Account Slot 0{activeSlotIndex + 1} Not Connected
                </h3>
                <p className="text-xs font-semibold text-gray-600 max-w-sm mx-auto">
                  Connect your Discord account token to Slot 0{activeSlotIndex + 1} to manage servers, join voice channels, and play sounds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConnectSlotModal(activeSlotIndex);
                  setSlotTokenInput('');
                }}
                className="btn-neo btn-neo-yellow px-6 py-2.5 text-xs font-black uppercase inline-flex items-center gap-2 shadow-neo"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Account to Slot 0{activeSlotIndex + 1}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-16 card-neo bg-white space-y-2">
              <Server className="w-10 h-10 text-black mx-auto mb-2" />
              <h3 className="text-base font-black uppercase text-black">Select a Server</h3>
              <p className="text-xs font-bold text-gray-600 max-w-sm mx-auto">
                Pick a server from the left sidebar or auto-join via an invite code to begin.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Connect Additional Token Modal */}
      {connectSlotModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="card-neo max-w-md w-full p-5 sm:p-6 space-y-4 shadow-neo-xl bg-white text-black border-3 border-black">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="text-sm sm:text-base font-black uppercase flex items-center gap-2">
                <Plus className="w-4 h-4 text-black" />
                <span>Connect Account to Slot {connectSlotModal + 1}</span>
              </h3>
              <button
                onClick={() => setConnectSlotModal(null)}
                className="btn-neo btn-neo-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-gray-600">
              Paste the Discord user token or Bluecord JSON for <strong>Account Slot {connectSlotModal + 1}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-black">Account Token / JSON</label>
              <textarea
                rows={3}
                value={slotTokenInput}
                onChange={(e) => setSlotTokenInput(e.target.value)}
                placeholder="Paste token or JSON..."
                className="input-neo w-full text-xs font-mono p-2.5 resize-none font-bold"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t-2 border-black/10">
              <button
                type="button"
                onClick={() => setConnectSlotModal(null)}
                className="btn-neo btn-neo-white px-3.5 py-1.5 text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={connectingSlot || !slotTokenInput.trim()}
                onClick={async () => {
                  setConnectingSlot(true);
                  let result = await onConnectSlotToken(connectSlotModal, slotTokenInput.trim());
                  let ok = typeof result === 'boolean' ? result : result?.success;

                  // Auto-retry once seamlessly on transient connection glitch
                  if (!ok && typeof result === 'object' && result?.error && !result.error.includes('4004')) {
                    await new Promise((r) => setTimeout(r, 800));
                    result = await onConnectSlotToken(connectSlotModal, slotTokenInput.trim());
                    ok = typeof result === 'boolean' ? result : result?.success;
                  }

                  setConnectingSlot(false);
                  const errMsg = typeof result === 'object' && result?.error ? result.error : 'Failed to authenticate token for this slot.';
                  if (ok) {
                    setConnectSlotModal(null);
                    setSlotTokenInput('');
                    setBanner({ text: `Account connected to Slot ${connectSlotModal + 1}!`, type: 'success' });
                    setTimeout(() => setBanner(null), 4000);
                  } else {
                    setBanner({ text: errMsg, type: 'error' });
                    setTimeout(() => setBanner(null), 6000);
                  }
                }}
                className="btn-neo btn-neo-yellow px-4 py-1.5 text-xs font-black uppercase disabled:opacity-50"
              >
                {connectingSlot ? 'Connecting...' : 'Connect Token'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

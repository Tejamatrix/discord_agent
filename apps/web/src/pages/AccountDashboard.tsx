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
  ChevronLeft,
  Settings2,
  User,
  Users,
  RotateCcw,
  Save,
} from 'lucide-react';
import { api } from '../services/api';
import { wsService } from '../services/socket';

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
  onUpdateCapacity?: (capacity: number) => Promise<void>;
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
  onUpdateCapacity,
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

  // Slot Pagination & Admin Custom Capacity
  const [slotPageRange, setSlotPageRange] = useState<number>(0);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [customCapacityInput, setCustomCapacityInput] = useState<number>(maxTokensAllowed || 100);
  const [savingCapacity, setSavingCapacity] = useState(false);

  useEffect(() => {
    setCustomCapacityInput(maxTokensAllowed || 100);
  }, [maxTokensAllowed]);

  useEffect(() => {
    if (slotPageRange !== -1 && maxTokensAllowed > 20) {
      const page = Math.floor(activeSlotIndex / 20);
      if (page !== slotPageRange) {
        setSlotPageRange(page);
      }
    }
  }, [activeSlotIndex, maxTokensAllowed]);

  // Mobile View Navigation Tab: 'servers' | 'studio' | 'channels'
  const [mobileTab, setMobileTab] = useState<'studio' | 'servers' | 'channels'>('studio');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const instantPlayInputRef = useRef<HTMLInputElement | null>(null);

  const isHighPeaks = isAdmin || soundTier === 'admin_peaks';
  const maxVolume = isHighPeaks ? 300 : 100;

  const userAudios = sounds.filter((s) => !s.isPreset);
  const presetSounds = sounds.filter((s) => s.isPreset);

  // --- LIVE MICROPHONE "SPEAK OUT" & VOICE RECORDING DECK ---
  const tenantId = adminEmail ? `admin_${adminEmail.toLowerCase()}` : (activeKey ? `key_${activeKey.toUpperCase()}` : 'default');

  const [isLiveSpeaking, setIsLiveSpeaking] = useState(false);
  const [isHoldTalking, setIsHoldTalking] = useState(false);
  const [liveGain, setLiveGain] = useState<number>(2.8);
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [broadcastingRecorded, setBroadcastingRecorded] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);

  const liveMediaStreamRef = useRef<MediaStream | null>(null);
  const liveMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const liveAnalyserRef = useRef<AnalyserNode | null>(null);
  const liveAnimFrameRef = useRef<number | null>(null);
  const liveChunksRef = useRef<Blob[]>([]);

  const recStreamRef = useRef<MediaStream | null>(null);
  const recRecorderRef = useRef<MediaRecorder | null>(null);
  const recIntervalRef = useRef<any>(null);
  const recChunksRef = useRef<Blob[]>([]);

  // Cleanup microphones, streams & recorders on unmount
  useEffect(() => {
    return () => {
      if (liveMediaRecorderRef.current && liveMediaRecorderRef.current.state !== 'inactive') {
        try { liveMediaRecorderRef.current.stop(); } catch {}
      }
      if (liveMediaStreamRef.current) {
        liveMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (liveAudioContextRef.current) {
        try { liveAudioContextRef.current.close(); } catch {}
      }
      if (liveAnimFrameRef.current) {
        cancelAnimationFrame(liveAnimFrameRef.current);
      }
      if (recRecorderRef.current && recRecorderRef.current.state !== 'inactive') {
        try { recRecorderRef.current.stop(); } catch {}
      }
      if (recStreamRef.current) {
        recStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recIntervalRef.current) {
        clearInterval(recIntervalRef.current);
      }
    };
  }, []);

  const updateAudioLevel = () => {
    if (liveAnalyserRef.current) {
      const dataArray = new Uint8Array(liveAnalyserRef.current.frequencyBinCount);
      liveAnalyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      setMicAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
    }
    liveAnimFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const startLiveSpeak = async () => {
    setMicError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone capture is not supported by your browser or environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      liveMediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        liveAudioContextRef.current = audioCtx;
        liveAnalyserRef.current = analyser;
        updateAudioLevel();
      }

      const isJoint = playbackMode === 'joint';
      const startRes = await wsService.startLiveSpeak(tenantId, liveGain, isJoint, activeSlotIndex);
      if (!startRes.success && startRes.error) {
        throw new Error(startRes.error);
      }

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      liveMediaRecorderRef.current = recorder;
      liveChunksRef.current = [];

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          liveChunksRef.current.push(e.data);
          const buffer = await e.data.arrayBuffer();
          wsService.sendLiveSpeakChunk(tenantId, buffer);
        }
      };

      recorder.onstop = async () => {
        if (liveChunksRef.current.length > 0) {
          const blob = new Blob(liveChunksRef.current, { type: mimeType });
          try {
            await api.liveSpeakAudio(blob, liveGain, isJoint, activeSlotIndex);
          } catch (e) {
            console.warn('Live speak broadcast note:', e);
          }
        }
      };

      recorder.start(200);
      setIsLiveSpeaking(true);
      setBanner({
        text: isJoint
          ? '🎙️ SPEAK OUT ACTIVE! Your voice is broadcasting live across ALL connected accounts in VC with ultra loud volume!'
          : `🎙️ SPEAK OUT ACTIVE! Broadcasting live on Slot 0${activeSlotIndex + 1} (${profile?.username})!`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to start live speak:', err);
      setMicError(err.message || 'Microphone access denied or error');
      stopLiveSpeak();
    }
  };

  const stopLiveSpeak = async () => {
    setIsLiveSpeaking(false);
    setIsHoldTalking(false);
    setMicAudioLevel(0);

    if (liveAnimFrameRef.current) {
      cancelAnimationFrame(liveAnimFrameRef.current);
      liveAnimFrameRef.current = null;
    }
    if (liveMediaRecorderRef.current && liveMediaRecorderRef.current.state !== 'inactive') {
      try {
        liveMediaRecorderRef.current.stop();
      } catch {}
      liveMediaRecorderRef.current = null;
    }
    if (liveMediaStreamRef.current) {
      liveMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      liveMediaStreamRef.current = null;
    }
    if (liveAudioContextRef.current) {
      try {
        liveAudioContextRef.current.close();
      } catch {}
      liveAudioContextRef.current = null;
    }

    try {
      await wsService.stopLiveSpeak(tenantId);
    } catch {}
  };

  const startRecording = async () => {
    setMicError(null);
    setRecordedBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    recChunksRef.current = [];
    setRecordDuration(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone capture is not supported by your browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
      };

      recorder.start(100);
      setIsRecording(true);

      recIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setMicError(err.message || 'Microphone access denied');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recIntervalRef.current) {
      clearInterval(recIntervalRef.current);
      recIntervalRef.current = null;
    }
    if (recRecorderRef.current && recRecorderRef.current.state !== 'inactive') {
      try {
        recRecorderRef.current.stop();
      } catch {}
    }
    if (recStreamRef.current) {
      recStreamRef.current.getTracks().forEach((track) => track.stop());
      recStreamRef.current = null;
    }
  };

  const handleBroadcastRecording = async () => {
    if (!recordedBlob) return;
    setBroadcastingRecorded(true);
    try {
      const isJoint = playbackMode === 'joint';
      const res = await api.liveSpeakAudio(recordedBlob, liveGain, isJoint, activeSlotIndex);
      if (res.success) {
        setBanner({
          text: isJoint
            ? '⚡ Recording successfully broadcasted across ALL connected accounts in VC with ultra loud volume!'
            : `⚡ Recording broadcasted to Slot 0${activeSlotIndex + 1}!`,
          type: 'success',
        });
        setTimeout(() => setBanner(null), 6000);
      } else {
        setBanner({
          text: res.error || 'Failed to broadcast recording to Discord',
          type: 'error',
        });
      }
    } catch (err: any) {
      setBanner({
        text: err.message || 'Error broadcasting recording',
        type: 'error',
      });
    } finally {
      setBroadcastingRecorded(false);
    }
  };

  const handleSaveRecordingToLibrary = async () => {
    if (!recordedBlob) return;
    setSavingRecording(true);
    try {
      const now = new Date();
      const fileName = `Voice_Rec_${now.getHours()}${now.getMinutes()}${now.getSeconds()}.webm`;
      const file = new File([recordedBlob], fileName, { type: recordedBlob.type || 'audio/webm' });
      const res = await onUploadAudio(file);
      const isSuccess = typeof res === 'boolean' ? res : res.success;
      if (isSuccess) {
        setActiveAudioTab('my-audios');
        setBanner({
          text: `"${fileName}" saved to your soundboard library!`,
          type: 'success',
        });
        setTimeout(() => setBanner(null), 5000);
      }
    } catch (err: any) {
      setBanner({ text: err.message || 'Error saving recording', type: 'error' });
    } finally {
      setSavingRecording(false);
    }
  };

  const handleResetRecording = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordedBlob(null);
    setRecordDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    if (isLiveSpeaking) {
      stopLiveSpeak();
    }
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
          {/* Header Badge & Admin Custom Capacity Button */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="badge-neo bg-black text-white px-2 py-1 text-[10px] font-mono shrink-0">
              SLOTS ({slots.filter((s) => s.connected).length}/{isAdmin ? (maxTokensAllowed || 100) : maxTokensAllowed})
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCapacityModal(true)}
                className="btn-neo btn-neo-yellow text-[10px] px-2 py-1 font-black uppercase flex items-center space-x-1 shadow-neo-sm hover:scale-105 transition-transform"
                title="Super Admin / Admin Only: Customize Slot Rack Capacity (up to 100)"
              >
                <Settings2 className="w-3 h-3" />
                <span>Custom Slots ({maxTokensAllowed})</span>
              </button>
            )}
          </div>

          {/* Range Pagination Tabs when slot count > 20 */}
          {((isAdmin ? (maxTokensAllowed || 100) : maxTokensAllowed) > 20) && (
            <div className="flex items-center space-x-1 overflow-x-auto py-0.5 shrink-0 border-l-2 border-black/20 pl-2">
              {Array.from({ length: Math.ceil((isAdmin ? (maxTokensAllowed || 100) : maxTokensAllowed) / 20) }, (_, pageIdx) => {
                const start = pageIdx * 20 + 1;
                const end = Math.min((pageIdx + 1) * 20, isAdmin ? (maxTokensAllowed || 100) : maxTokensAllowed);
                const isActive = slotPageRange === pageIdx;
                return (
                  <button
                    key={pageIdx}
                    type="button"
                    onClick={() => setSlotPageRange(pageIdx)}
                    className={`px-1.5 py-0.5 text-[9px] font-black rounded border-2 border-black transition-all ${
                      isActive ? 'bg-[#FFE600] text-black shadow-neo-sm font-bold' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {start}-{end}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSlotPageRange(-1)}
                className={`px-1.5 py-0.5 text-[9px] font-black rounded border-2 border-black transition-all ${
                  slotPageRange === -1 ? 'bg-[#FFE600] text-black shadow-neo-sm font-bold' : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                All
              </button>
            </div>
          )}

          {/* Slot Rack Elements */}
          <div className="flex items-center space-x-2 shrink-0">
            {Array.from({ length: Math.max(3, isAdmin ? (maxTokensAllowed || 100) : maxTokensAllowed) }, (_, i) => i)
              .filter((slotIdx) => {
                const total = Math.max(3, isAdmin ? (maxTokensAllowed || 100) : maxTokensAllowed);
                if (slotPageRange === -1 || total <= 20) return true;
                return Math.floor(slotIdx / 20) === slotPageRange;
              })
              .map((slotIdx) => {
                const slotInfo = slots[slotIdx] || { slot: slotIdx, connected: false, profile: null, voiceState: { connected: false } };
                const isSlotUnlocked = isAdmin || slotIdx < maxTokensAllowed;
                const isActiveSlot = activeSlotIndex === slotIdx;
                const slotLabel = `Slot ${String(slotIdx + 1).padStart(2, '0')}`;

                if (!isSlotUnlocked) {
                  return (
                    <div
                      key={slotIdx}
                      title="Key permits fewer slots. Ask Admin for Multi-Token access."
                      className="flex items-center space-x-1.5 bg-gray-200 border-2 border-black text-gray-500 px-2.5 py-1 rounded-lg text-xs font-bold cursor-not-allowed select-none opacity-60"
                    >
                      <Lock className="w-3 h-3" />
                      <span className="font-mono text-[11px]">{slotLabel}</span>
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
                      <span>{slotLabel}</span>
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
                      className="btn-neo btn-neo-white p-1 hover:btn-neo-coral shrink-0 ml-1"
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

                  {/* SECTION: LIVE MICROPHONE STUDIO: SPEAK OUT & VOICE RECORDING */}
                  <div className="bg-[#FAF8F5] border-3 border-black rounded-xl p-4 shadow-neo space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-2.5">
                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase text-black flex items-center gap-2">
                          <Mic className="w-4 h-4 text-rose-600" />
                          <span>Live Microphone Studio: Speak Out & Voice Recording</span>
                        </h4>
                        <p className="text-[11px] font-bold text-gray-600">
                          Speak live in real time to broadcast your voice directly into Discord VC, or record a clip first to preview and blast across accounts!
                        </p>
                      </div>

                      {/* Volume Boost / Loudness Overdrive Selector */}
                      <div className="flex items-center space-x-1.5 bg-white border-2 border-black px-2.5 py-1 rounded-lg shrink-0">
                        <Volume2 className="w-3.5 h-3.5 text-black" />
                        <span className="text-[10px] font-black uppercase text-black mr-1">Mic Boost:</span>
                        <button
                          type="button"
                          onClick={() => setLiveGain(1.8)}
                          className={`btn-neo px-2 py-0.5 text-[10px] font-black ${liveGain === 1.8 ? 'btn-neo-yellow' : 'btn-neo-white'}`}
                        >
                          1.8x
                        </button>
                        <button
                          type="button"
                          onClick={() => setLiveGain(2.8)}
                          className={`btn-neo px-2 py-0.5 text-[10px] font-black ${liveGain === 2.8 ? 'btn-neo-yellow' : 'btn-neo-white'}`}
                        >
                          2.8x Loud
                        </button>
                        <button
                          type="button"
                          onClick={() => setLiveGain(3.5)}
                          className={`btn-neo px-2 py-0.5 text-[10px] font-black ${liveGain === 3.5 ? 'btn-neo-coral' : 'btn-neo-white'}`}
                        >
                          3.5x Max 🔥
                        </button>
                      </div>
                    </div>

                    {micError && (
                      <div className="p-2.5 bg-red-100 border-2 border-red-500 rounded-lg text-xs font-bold text-red-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{micError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* OPTION 1: SPEAK OUT (LIVE MIC BROADCAST) */}
                      <div className={`p-4 rounded-xl border-3 border-black space-y-3 transition-colors ${
                        isLiveSpeaking ? 'bg-amber-100 shadow-neo' : 'bg-white shadow-neo-sm'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${isLiveSpeaking ? 'bg-red-500 animate-ping' : 'bg-gray-400'}`} />
                            <span className="text-xs font-black uppercase tracking-tight text-black">
                              🎙️ Option 1: Speak Out (Live Mic)
                            </span>
                          </div>
                          <span className={`badge-neo px-2 py-0.5 text-[10px] font-mono ${
                            isLiveSpeaking ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-200 text-black'
                          }`}>
                            {isLiveSpeaking ? '🔴 LIVE ON-AIR' : '⚪ IDLE'}
                          </span>
                        </div>

                        <p className="text-[11px] font-bold text-gray-600 leading-tight">
                          Talk directly into your microphone. Your live voice streams immediately into Discord VC on{' '}
                          <strong className="text-black">
                            {playbackMode === 'joint' ? 'ALL CONNECTED ACCOUNTS' : `Slot 0${activeSlotIndex + 1}`}
                          </strong>{' '}
                          at amplified loud volume!
                        </p>

                        {/* Real-time Decibel / VU Meter Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500">
                            <span>Live Audio Input Level</span>
                            <span className="font-mono">{micAudioLevel}%</span>
                          </div>
                          <div className="flex items-end justify-center space-x-1 h-7 bg-black/5 rounded-lg p-1 border border-black/20">
                            {[...Array(16)].map((_, i) => {
                              const threshold = (i / 16) * 100;
                              const isLit = isLiveSpeaking && micAudioLevel >= threshold;
                              return (
                                <span
                                  key={i}
                                  className={`w-1.5 rounded-sm transition-all duration-75 ${
                                    isLit
                                      ? i > 12
                                        ? 'bg-rose-500 h-5'
                                        : i > 8
                                        ? 'bg-amber-400 h-4'
                                        : 'bg-emerald-500 h-3.5'
                                      : 'bg-black/15 h-1.5'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* Action Buttons for Speak Out */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={isLiveSpeaking ? stopLiveSpeak : startLiveSpeak}
                            className={`btn-neo flex-1 py-2.5 px-4 text-xs font-black uppercase flex items-center justify-center space-x-2 ${
                              isLiveSpeaking ? 'btn-neo-coral' : 'btn-neo-yellow'
                            }`}
                          >
                            {isLiveSpeaking ? (
                              <>
                                <Square className="w-4 h-4 fill-current" />
                                <span>⏹️ Stop Speak Out</span>
                              </>
                            ) : (
                              <>
                                <Radio className="w-4 h-4" />
                                <span>🎙️ Start Live Speak Out</span>
                              </>
                            )}
                          </button>

                          {/* Push-to-Talk Hold Button */}
                          <button
                            type="button"
                            onMouseDown={() => {
                              if (!isLiveSpeaking) {
                                setIsHoldTalking(true);
                                startLiveSpeak();
                              }
                            }}
                            onMouseUp={() => {
                              if (isHoldTalking) {
                                stopLiveSpeak();
                              }
                            }}
                            onTouchStart={() => {
                              if (!isLiveSpeaking) {
                                setIsHoldTalking(true);
                                startLiveSpeak();
                              }
                            }}
                            onTouchEnd={() => {
                              if (isHoldTalking) {
                                stopLiveSpeak();
                              }
                            }}
                            className={`btn-neo px-3 py-2.5 text-xs font-black uppercase flex items-center space-x-1.5 select-none ${
                              isHoldTalking ? 'btn-neo-lime' : 'btn-neo-white'
                            }`}
                            title="Press & hold to speak, release to stop"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>{isHoldTalking ? 'Speaking...' : 'Hold to Speak'}</span>
                          </button>
                        </div>
                      </div>

                      {/* OPTION 2: BESIDE IT: VOICE RECORDING */}
                      <div className={`p-4 rounded-xl border-3 border-black space-y-3 transition-colors ${
                        isRecording ? 'bg-rose-50 shadow-neo' : 'bg-white shadow-neo-sm'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-600 animate-ping' : 'bg-gray-400'}`} />
                            <span className="text-xs font-black uppercase tracking-tight text-black">
                              🔴 Option 2: Voice Recording
                            </span>
                          </div>
                          <span className={`badge-neo px-2 py-0.5 text-[10px] font-mono ${
                            isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-gray-200 text-black'
                          }`}>
                            {isRecording ? `REC ${formatDuration(recordDuration)}` : 'READY'}
                          </span>
                        </div>

                        <p className="text-[11px] font-bold text-gray-600 leading-tight">
                          Record audio from your mic first. Review it with the player, then blast it loud to all connected accounts or save it to your library!
                        </p>

                        {/* Recording Player / Status Area */}
                        {recordedAudioUrl ? (
                          <div className="p-2.5 bg-[#FAF8F5] border-2 border-black rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-gray-600">
                              <span>PREVIEW RECORDING ({formatDuration(recordDuration)}):</span>
                              <button
                                onClick={handleResetRecording}
                                className="text-red-600 hover:underline flex items-center gap-1 font-bold"
                              >
                                <RotateCcw className="w-3 h-3" /> Discard
                              </button>
                            </div>
                            <audio controls src={recordedAudioUrl} className="w-full h-8 outline-none" />
                          </div>
                        ) : (
                          <div className="h-14 flex items-center justify-center border-2 border-dashed border-black/20 rounded-lg text-xs font-bold text-gray-500 bg-black/5">
                            {isRecording ? (
                              <div className="flex items-center space-x-2 text-rose-600 font-mono font-black animate-pulse">
                                <span className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping" />
                                <span>RECORDING IN PROGRESS ({formatDuration(recordDuration)})...</span>
                              </div>
                            ) : (
                              <span>No voice recording yet. Click "Start Recording" below.</span>
                            )}
                          </div>
                        )}

                        {/* Recording Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {!recordedAudioUrl ? (
                            <button
                              type="button"
                              onClick={isRecording ? stopRecording : startRecording}
                              className={`btn-neo w-full py-2.5 px-4 text-xs font-black uppercase flex items-center justify-center space-x-2 ${
                                isRecording ? 'btn-neo-coral' : 'btn-neo-white'
                              }`}
                            >
                              {isRecording ? (
                                <>
                                  <Square className="w-4 h-4 fill-current" />
                                  <span>⏹️ Stop Recording</span>
                                </>
                              ) : (
                                <>
                                  <Mic className="w-4 h-4 text-rose-600" />
                                  <span>🔴 Start Recording Voice</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <button
                                type="button"
                                onClick={handleBroadcastRecording}
                                disabled={broadcastingRecorded}
                                className="btn-neo btn-neo-lime flex-1 py-2 px-3 text-xs font-black uppercase flex items-center justify-center space-x-1.5 disabled:opacity-50"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>{broadcastingRecorded ? 'Broadcasting...' : '⚡ Blast to All Accounts'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleSaveRecordingToLibrary}
                                disabled={savingRecording}
                                className="btn-neo btn-neo-white py-2 px-3 text-xs font-black uppercase flex items-center justify-center space-x-1.5 disabled:opacity-50"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>{savingRecording ? 'Saving...' : 'Save'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
                  {/* 1. Voice Channels Controller */}
                  <div className="card-neo p-4 sm:p-5 bg-white space-y-4 shadow-neo min-w-0">
                    <div className="flex justify-between items-center border-b-2 border-black pb-2">
                      <h3 className="text-xs sm:text-sm font-black uppercase text-black flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-black" />
                        <span>Voice Channels ({voiceChannels.length})</span>
                      </h3>
                    </div>

                    {voiceChannels.length > 0 ? (
                      <div className="space-y-2.5">
                        {voiceChannels.map((vc) => {
                          const isThisConnected = voiceState.channelId === vc.id;
                          const canJoin = vc.canJoin !== false;
                          const otherSlotsInChannel = slots.filter(
                            (s) => s.slot !== activeSlotIndex && s.connected && s.voiceState?.channelId === vc.id
                          );
                          const activeSlotLabel = `Slot ${String(activeSlotIndex + 1).padStart(2, '0')}`;

                          return (
                            <div
                              key={vc.id}
                              className={`card-neo p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors overflow-hidden ${
                                isThisConnected ? 'bg-[#DCFCE7]' : 'bg-[#FAF8F5]'
                              }`}
                            >
                              <div className="flex flex-col space-y-1.5 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                  {canJoin ? (
                                    <span className="font-mono text-sm shrink-0">🔊</span>
                                  ) : (
                                    <Lock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                  )}
                                  <span
                                    title={`#${vc.name}`}
                                    className={`font-black truncate max-w-[160px] sm:max-w-[210px] ${canJoin ? 'text-black' : 'text-gray-500'}`}
                                  >
                                    #{vc.name}
                                  </span>
                                  {isThisConnected && (
                                    <span className="badge-neo bg-[#4ADE80] text-black px-1.5 py-0.5 text-[9px] font-black shrink-0">
                                      {activeSlotLabel} CONNECTED
                                    </span>
                                  )}
                                </div>

                                {otherSlotsInChannel.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                                    {otherSlotsInChannel.slice(0, 3).map((os) => (
                                      <span
                                        key={os.slot}
                                        title={`Slot ${os.slot + 1} (${os.profile?.username || 'User'})`}
                                        className="badge-neo bg-[#FFE600] text-black px-1.5 py-0.5 text-[9px] font-bold truncate max-w-[140px] shrink-0"
                                      >
                                        Slot {String(os.slot + 1).padStart(2, '0')} ({os.profile?.username || 'User'})
                                      </span>
                                    ))}
                                    {otherSlotsInChannel.length > 3 && (
                                      <span
                                        title={otherSlotsInChannel
                                          .slice(3)
                                          .map((os) => `Slot ${os.slot + 1} (${os.profile?.username || 'User'})`)
                                          .join(', ')}
                                        className="badge-neo bg-black text-white px-1.5 py-0.5 text-[9px] font-bold shrink-0 cursor-help"
                                      >
                                        +{otherSlotsInChannel.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center justify-end">
                                {isThisConnected ? (
                                  <button
                                    onClick={onLeaveVoice}
                                    className="btn-neo btn-neo-coral px-3 py-1.5 text-xs font-black uppercase shadow-neo-sm whitespace-nowrap"
                                  >
                                    Leave VC ({activeSlotLabel})
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onJoinVoice(activeGuild.id, vc.id)}
                                    disabled={!canJoin}
                                    className="btn-neo btn-neo-lime px-3 py-1.5 text-xs font-black uppercase disabled:opacity-40 shadow-neo-sm whitespace-nowrap"
                                  >
                                    {canJoin ? `Join VC (${activeSlotLabel})` : 'Locked'}
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
                  <div className="card-neo p-4 sm:p-5 bg-white space-y-4 shadow-neo min-w-0">
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

      {/* Admin Custom Slot Capacity Modal */}
      {isAdmin && showCapacityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card-neo w-full max-w-md bg-white border-3 border-black p-5 shadow-neo space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-[#FFE600] border-2 border-black rounded shadow-neo-sm">
                  <Settings2 className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Voice Slot Capacity</h3>
                  <p className="text-[11px] text-gray-500 font-bold">Admin Only • Configure active slots (1-100)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCapacityModal(false)}
                className="btn-neo btn-neo-white px-2 py-1 text-xs font-black"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-700 mb-1.5">
                Quick Presets:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 3, 5, 10, 20, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCustomCapacityInput(preset)}
                    className={`px-2 py-1.5 text-xs font-black rounded border-2 border-black transition-all ${
                      customCapacityInput === preset
                        ? 'bg-[#FFE600] text-black shadow-neo-sm scale-102'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {preset} Slots
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-gray-700 mb-1">
                Custom Capacity (1 – 100):
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={customCapacityInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setCustomCapacityInput(Math.max(1, Math.min(100, val)));
                  }
                }}
                className="input-neo w-full text-base font-mono font-black p-2.5"
              />
              <p className="text-[10px] text-gray-500 mt-1 font-bold">
                ⚠️ Regular clients unlocked via key are strictly limited to their key's count. Only Admin can expand up to 100 slots.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t-2 border-black/10">
              <button
                type="button"
                onClick={() => setShowCapacityModal(false)}
                className="btn-neo btn-neo-white px-3.5 py-1.5 text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingCapacity}
                onClick={async () => {
                  setSavingCapacity(true);
                  try {
                    if (onUpdateCapacity) {
                      await onUpdateCapacity(customCapacityInput);
                    }
                    setShowCapacityModal(false);
                    setBanner({ text: `Voice slot capacity set to ${customCapacityInput}!`, type: 'success' });
                    setTimeout(() => setBanner(null), 3000);
                  } catch (err: any) {
                    setBanner({ text: err.message || 'Failed to update capacity', type: 'error' });
                  } finally {
                    setSavingCapacity(false);
                  }
                }}
                className="btn-neo btn-neo-yellow px-4 py-1.5 text-xs font-black uppercase disabled:opacity-50"
              >
                {savingCapacity ? 'Applying...' : 'Apply Capacity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

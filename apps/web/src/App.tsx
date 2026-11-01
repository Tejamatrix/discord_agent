import React, { useEffect, useState, useCallback } from 'react';
import { api } from './services/api';
import { wsService } from './services/socket';
import { AccessKeyGateModal } from './components/AccessKeyGateModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AccountDashboard, VoiceStateInfo, SoundItem, SlotSummary } from './pages/AccountDashboard';

export default function App() {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [guilds, setGuilds] = useState<any[]>([]);
  const [activeGuild, setActiveGuild] = useState<any | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [sounds, setSounds] = useState<SoundItem[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceStateInfo>({
    connected: false,
    guildId: null,
    channelId: null,
    channelName: null,
    volume: 100,
    selfMute: false,
    selfDeaf: false,
    isPlayingAudio: false,
  });

  // Access Key & Admin Authentication State
  const [isAdmin, setIsAdmin] = useState<boolean>(api.isAdmin);
  const [adminEmail, setAdminEmail] = useState<string | null>(api.adminEmail);
  const [activeKey, setActiveKey] = useState<string | null>(api.activeKey);
  const [maxTokensAllowed, setMaxTokensAllowed] = useState<number>(api.isAdmin ? 10 : 1);
  const [soundTier, setSoundTier] = useState<'standard' | 'admin_peaks'>(api.soundTier);

  // Modal Dialogs
  const [isKeyGateOpen, setIsKeyGateOpen] = useState<boolean>(!api.activeKey && !api.isAdmin);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(api.isAdmin);

  // Multi-Token Slots State
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [slots, setSlots] = useState<SlotSummary[]>([]);

  const loadSlots = async () => {
    try {
      const res = await api.getSlots();
      if (res.success && res.data) {
        setSlots(res.data.slots || []);
        setActiveSlotIndex(res.data.activeSlotIndex ?? 0);
        if (res.data.maxTokens) {
          setMaxTokensAllowed(res.data.maxTokens);
        }
      }
    } catch {}
  };

  const loadGuilds = async (slotIndex?: number) => {
    const targetSlot = slotIndex ?? activeSlotIndex;
    const res = await api.getAccountGuilds(targetSlot);
    if (res.success && res.data) {
      setGuilds(res.data);
      if (res.data.length > 0) {
        if (!activeGuild || !res.data.some((g: any) => g.id === activeGuild.id)) {
          selectGuild(res.data[0], targetSlot);
        }
      } else {
        setActiveGuild(null);
        setChannels([]);
      }
    }
  };

  const loadSounds = async () => {
    const res = await api.getAudios();
    if (res.success && res.data) {
      setSounds(res.data);
    }
  };

  const selectGuild = async (guild: any, slotIndex?: number) => {
    setActiveGuild(guild);
    const targetSlot = slotIndex ?? activeSlotIndex;
    const res = await api.getAccountChannels(guild.id, targetSlot);
    if (res.success && res.data) {
      setChannels(res.data);
    } else {
      setChannels([]);
    }
  };

  const checkCurrentSession = useCallback(async () => {
    if (!api.activeKey && !api.isAdmin) {
      setIsKeyGateOpen(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setIsKeyGateOpen(false);

    // Join tenant room over WebSocket
    const currentTenantId = api.isAdmin
      ? `admin_${api.adminEmail || 'master'}`
      : `key_${api.activeKey}`;
    wsService.joinTenant(currentTenantId);

    await loadSlots();
    await loadSounds();

    const res = await api.getAccountProfile();
    if (res.success && res.data) {
      setProfile(res.data);
      await loadGuilds(activeSlotIndex);
      const vRes = await api.getAccountVoiceState(activeSlotIndex);
      if (vRes.success && vRes.data) setVoiceState(vRes.data);
    } else {
      setProfile(null);
      setGuilds([]);
      setActiveGuild(null);
      setChannels([]);
    }

    setLoading(false);
  }, [activeSlotIndex]);

  useEffect(() => {
    checkCurrentSession();

    // Connect WebSocket and listen for real-time voice and slot updates
    wsService.connect();

    const handleVoiceUpdate = (state: any) => {
      if (state) {
        if (state.slot === undefined || state.slot === activeSlotIndex) {
          setVoiceState(state);
        }
        setSlots((prev) =>
          prev.map((s) => (s.slot === state.slot ? { ...s, voiceState: state } : s))
        );
      }
    };

    const handleSlotsUpdate = (updatedSlots: SlotSummary[]) => {
      if (updatedSlots && Array.isArray(updatedSlots)) {
        setSlots(updatedSlots);
        const activeInfo = updatedSlots.find((s) => s.slot === activeSlotIndex);
        if (activeInfo?.voiceState) {
          setVoiceState(activeInfo.voiceState);
        }
      }
    };

    wsService.on('account:voice_state', handleVoiceUpdate);
    wsService.on('account:slots_update', handleSlotsUpdate);

    // Heartbeat sync every 3.5 seconds
    const pollInterval = setInterval(async () => {
      if (!api.activeKey && !api.isAdmin) return;
      try {
        const vRes = await api.getAccountVoiceState(activeSlotIndex);
        if (vRes.success && vRes.data) {
          setVoiceState(vRes.data);
        }
        await loadSlots();
      } catch {}
    }, 3500);

    return () => {
      wsService.off('account:voice_state', handleVoiceUpdate);
      wsService.off('account:slots_update', handleSlotsUpdate);
      clearInterval(pollInterval);
    };
  }, [checkCurrentSession, activeSlotIndex]);

  // Key Activation Handlers
  const handleKeyActivated = async (keyInfo: { key: string; maxTokens: number; soundTier: string }) => {
    setActiveKey(keyInfo.key);
    setMaxTokensAllowed(keyInfo.maxTokens);
    setSoundTier(keyInfo.soundTier as any);
    setIsAdmin(false);
    setIsKeyGateOpen(false);
    setIsAdminModalOpen(false);
    await checkCurrentSession();
  };

  const handleAdminAuthenticated = async (adminInfo: { email: string; maxTokens: number; soundTier: string }) => {
    setIsAdmin(true);
    setAdminEmail(adminInfo.email);
    setMaxTokensAllowed(adminInfo.maxTokens || 10);
    setSoundTier('admin_peaks');
    setIsKeyGateOpen(false);
    setIsAdminModalOpen(true);
    await checkCurrentSession();
  };

  const handleLogout = () => {
    api.clearSession();
    setIsAdmin(false);
    setAdminEmail(null);
    setActiveKey(null);
    setMaxTokensAllowed(1);
    setSoundTier('standard');
    setProfile(null);
    setSlots([]);
    setGuilds([]);
    setActiveGuild(null);
    setChannels([]);
    setSounds([]);
    setIsAdminModalOpen(false);
    setIsKeyGateOpen(true);
  };

  // Slot Management Handlers
  const handleSelectSlot = async (slotIndex: number) => {
    setActiveSlotIndex(slotIndex);
    setLoading(true);
    const res = await api.selectSlot(slotIndex);
    setLoading(false);
    if (res.success && res.data) {
      setProfile(res.data.profile);
      if (res.data.voiceState) setVoiceState(res.data.voiceState);
      await loadGuilds(slotIndex);
      await loadSlots();
    }
  };

  const handleConnectSlotToken = async (slotIndex: number, token: string): Promise<{ success: boolean; error?: string }> => {
    const res = await api.connectSlot(slotIndex, token, activeKey || undefined, isAdmin);
    if (res.success && res.data) {
      await loadSlots();
      await handleSelectSlot(slotIndex);
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to authenticate token with Discord.' };
  };

  const handleDisconnectSlot = async (slotIndex: number): Promise<boolean> => {
    const res = await api.disconnectSlot(slotIndex);
    if (res.success) {
      await loadSlots();
      if (slotIndex === activeSlotIndex) {
        setProfile(null);
        setGuilds([]);
        setActiveGuild(null);
        setChannels([]);
      }
      return true;
    }
    return false;
  };

  const handleBroadcastPlay = async (soundId?: string, audioUrl?: string, boost?: boolean): Promise<boolean> => {
    const res = await api.broadcastPlayVoice({ soundId, audioUrl, boost });
    return Boolean(res.success);
  };

  const handleBroadcastStop = async () => {
    await api.broadcastStopVoice();
  };

  const handleDisconnect = async () => {
    await api.disconnectAccount();
    setProfile(null);
    setGuilds([]);
    setActiveGuild(null);
    setChannels([]);
    await loadSlots();
  };

  const handleJoinServer = async (invite: string) => {
    const res = await api.joinServerByInvite(invite, activeSlotIndex);
    if (res.success) {
      await loadGuilds(activeSlotIndex);
      if (res.data?.guild?.id) {
        const found = guilds.find((g) => g.id === res.data.guild.id);
        if (found) selectGuild(found, activeSlotIndex);
      }
      return { success: true, message: res.message || 'Successfully joined server!' };
    } else {
      return { success: false, message: res.error || 'Failed to join server' };
    }
  };

  const handleLeaveServer = async (guildId: string) => {
    const res = await api.leaveAccountServer(guildId, activeSlotIndex);
    if (res.success) {
      setGuilds((prev) => prev.filter((g) => g.id !== guildId));
      if (activeGuild?.id === guildId) {
        const remaining = guilds.filter((g) => g.id !== guildId);
        if (remaining.length > 0) selectGuild(remaining[0], activeSlotIndex);
        else setActiveGuild(null);
      }
      return true;
    }
    return false;
  };

  const handleSendMessage = async (channelId: string, content: string, tts: boolean) => {
    const res = await api.sendAccountMessage(channelId, content, tts, activeSlotIndex);
    if (res.success) {
      return true;
    } else {
      alert(`Failed to send message: ${res.error}`);
      return false;
    }
  };

  const handleJoinVoice = async (guildId: string, channelId: string) => {
    const res = await api.joinAccountVoice(guildId, channelId, activeSlotIndex);
    if (res.success && res.data) {
      setVoiceState(res.data);
      await loadSlots();
      return true;
    } else {
      alert(`Voice Join Notice: ${res.error || 'Permission denied or channel full'}`);
      return false;
    }
  };

  const handleLeaveVoice = async () => {
    const res = await api.leaveAccountVoice(activeSlotIndex);
    if (res.success && res.data) {
      setVoiceState(res.data);
      await loadSlots();
      return true;
    }
    return false;
  };

  const handleVolumeChange = async (volume: number) => {
    const res = await api.setAccountVoiceVolume(volume, activeSlotIndex);
    if (res.success && res.data) {
      setVoiceState(res.data);
    }
  };

  const handleMuteToggle = async (mute: boolean) => {
    const res = await api.setAccountVoiceMute(mute, activeSlotIndex);
    if (res.success && res.data) {
      setVoiceState(res.data);
    }
  };

  const handleDeafToggle = async (deaf: boolean) => {
    const res = await api.setAccountVoiceDeaf(deaf, activeSlotIndex);
    if (res.success && res.data) {
      setVoiceState(res.data);
    }
  };

  const handleUploadAudio = async (file: File) => {
    const res = await api.uploadAudio(file);
    if (res.success) {
      await loadSounds();
      return { success: true, soundId: res.data?.id };
    }
    return { success: false, error: res.error };
  };

  const handlePlaySound = async (
    soundId: string,
    boost: boolean = false,
    mode: 'individual' | 'joint' = 'individual'
  ) => {
    const res = await api.playSoundInVoice(soundId, boost, activeSlotIndex, mode);
    if (res.success && res.data?.voiceState) {
      setVoiceState(res.data.voiceState);
      await loadSlots();
      return true;
    }
    return false;
  };

  const handlePlayUrl = async (
    audioUrl: string,
    boost: boolean = false,
    mode: 'individual' | 'joint' = 'individual'
  ) => {
    const res = await api.playAudioUrl(audioUrl, boost, activeSlotIndex, mode);
    if (res.success && res.data) {
      setVoiceState(res.data);
      await loadSlots();
      return true;
    } else {
      console.warn('Audio URL Playback Error:', res.error);
      return false;
    }
  };

  const handleDeleteSound = async (soundId: string) => {
    const res = await api.deleteAudio(soundId);
    if (res.success) {
      await loadSounds();
      return true;
    }
    return false;
  };

  const handleStopAudio = async (mode: 'individual' | 'joint' = 'individual') => {
    const res = await api.stopAccountVoiceAudio(activeSlotIndex, mode);
    if (res.success && res.data) {
      setVoiceState(res.data);
      await loadSlots();
    }
  };

  // Step 1: Compulsory Access Key Gatekeeper
  if (isKeyGateOpen) {
    return (
      <AccessKeyGateModal
        onKeyActivated={handleKeyActivated}
        onAdminAuthenticated={handleAdminAuthenticated}
      />
    );
  }

  return (
    <>
      <AccountDashboard
        profile={profile}
        guilds={guilds}
        activeGuild={activeGuild}
        channels={channels}
        voiceState={voiceState}
        sounds={sounds}
        isAdmin={isAdmin}
        adminEmail={adminEmail}
        activeKey={activeKey}
        maxTokensAllowed={maxTokensAllowed}
        soundTier={soundTier}
        slots={slots}
        activeSlotIndex={activeSlotIndex}
        onSelectSlot={handleSelectSlot}
        onConnectSlotToken={handleConnectSlotToken}
        onDisconnectSlot={handleDisconnectSlot}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onBroadcastPlay={handleBroadcastPlay}
        onBroadcastStop={handleBroadcastStop}
        onSelectGuild={selectGuild}
        onJoinServer={handleJoinServer}
        onLeaveServer={handleLeaveServer}
        onSendMessage={handleSendMessage}
        onJoinVoice={handleJoinVoice}
        onLeaveVoice={handleLeaveVoice}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onDeafToggle={handleDeafToggle}
        onUploadAudio={handleUploadAudio}
        onPlaySound={handlePlaySound}
        onPlayUrl={handlePlayUrl}
        onDeleteSound={handleDeleteSound}
        onStopAudio={handleStopAudio}
        onDisconnect={handleDisconnect}
        onLogoutSession={handleLogout}
      />

      {/* Admin Control Dashboard Modal */}
      {isAdmin && isAdminModalOpen && (
        <AdminDashboardModal
          onClose={() => setIsAdminModalOpen(false)}
          adminEmail={adminEmail || 'admin'}
          onLogoutAdmin={handleLogout}
        />
      )}
    </>
  );
}

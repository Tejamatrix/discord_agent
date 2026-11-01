import { ApiResponse } from '@hub/shared';

const BACKEND_URL = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

class ApiClient {
  private token: string | null = null;
  public adminEmail: string | null = null;
  public activeKey: string | null = null;
  public soundTier: 'standard' | 'admin_peaks' = 'standard';
  public isAdmin: boolean = false;

  constructor() {
    this.token = localStorage.getItem('hub_token');
    this.adminEmail = localStorage.getItem('hub_admin_email');
    this.activeKey = localStorage.getItem('hub_active_key');
    this.soundTier = (localStorage.getItem('hub_sound_tier') as any) || 'standard';
    this.isAdmin = localStorage.getItem('hub_is_admin') === 'true';
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('hub_token', token);
    } else {
      localStorage.removeItem('hub_token');
    }
  }

  public setAdminSession(email: string | null, isAdmin: boolean) {
    this.adminEmail = email;
    this.isAdmin = isAdmin;
    if (email && isAdmin) {
      localStorage.setItem('hub_admin_email', email);
      localStorage.setItem('hub_is_admin', 'true');
      this.soundTier = 'admin_peaks';
      localStorage.setItem('hub_sound_tier', 'admin_peaks');
    } else {
      localStorage.removeItem('hub_admin_email');
      localStorage.removeItem('hub_is_admin');
    }
  }

  public setActiveKeySession(key: string | null, soundTier: 'standard' | 'admin_peaks' = 'standard') {
    this.activeKey = key;
    this.soundTier = soundTier;
    if (key) {
      localStorage.setItem('hub_active_key', key);
      localStorage.setItem('hub_sound_tier', soundTier);
    } else {
      localStorage.removeItem('hub_active_key');
      localStorage.removeItem('hub_sound_tier');
    }
  }

  public clearSession() {
    this.token = null;
    this.adminEmail = null;
    this.activeKey = null;
    this.soundTier = 'standard';
    this.isAdmin = false;
    localStorage.removeItem('hub_token');
    localStorage.removeItem('hub_admin_email');
    localStorage.removeItem('hub_is_admin');
    localStorage.removeItem('hub_active_key');
    localStorage.removeItem('hub_sound_tier');
    localStorage.removeItem('dch_saved_token');
  }

  public getToken() {
    return this.token;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.adminEmail) {
      headers['x-admin-email'] = this.adminEmail;
    }

    if (this.isAdmin) {
      headers['x-is-admin'] = 'true';
    }

    if (this.activeKey) {
      headers['x-access-key'] = this.activeKey;
    }

    if (this.soundTier) {
      headers['x-sound-tier'] = this.soundTier;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error(`API Error [${endpoint}]:`, err);
      return {
        success: false,
        error: err.message || 'Network error',
      };
    }
  }

  // --- ACCESS KEY & LICENSE API ---
  public verifyKey(key: string) {
    return this.request('/account/key/verify', {
      method: 'POST',
      body: JSON.stringify({ key }),
    });
  }

  public activateKey(key: string, email?: string) {
    return this.request('/account/key/activate', {
      method: 'POST',
      body: JSON.stringify({ key, email }),
    });
  }

  // --- ADMIN PORTAL API ---
  public adminLogin(email: string, password?: string) {
    return this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  public getAdminStatus() {
    return this.request('/admin/status');
  }

  public getAdminKeys() {
    return this.request('/admin/keys');
  }

  public generateAdminKey(params: { maxTokens: number; soundTier: 'standard' | 'admin_peaks'; label?: string }) {
    return this.request('/admin/keys/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public revokeAdminKey(id: string) {
    return this.request(`/admin/keys/${id}/revoke`, { method: 'POST' });
  }

  public activateAdminKey(id: string) {
    return this.request(`/admin/keys/${id}/activate`, { method: 'POST' });
  }

  public deleteAdminKey(id: string) {
    return this.request(`/admin/keys/${id}`, { method: 'DELETE' });
  }

  // --- ADMIN DELEGATION API ---
  public getAdminList() {
    return this.request('/admin/admins');
  }

  public addAdminEmail(email: string, password?: string) {
    return this.request('/admin/admins/add', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  public removeAdminEmail(email: string) {
    return this.request(`/admin/admins/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }

  // --- MULTI-TOKEN SLOTS API ---
  public getSlots() {
    return this.request('/account/slots');
  }

  public connectSlot(slotIndex: number, tokenOrJson: string, key?: string, isAdmin?: boolean) {
    return this.request(`/account/slots/${slotIndex}/connect`, {
      method: 'POST',
      body: JSON.stringify({
        token: tokenOrJson,
        key: key || this.activeKey,
        isAdmin: isAdmin ?? this.isAdmin,
      }),
    });
  }

  public disconnectSlot(slotIndex: number) {
    return this.request(`/account/slots/${slotIndex}/disconnect`, { method: 'POST' });
  }

  public selectSlot(slotIndex: number) {
    return this.request(`/account/slots/${slotIndex}/select`, { method: 'POST' });
  }

  public broadcastPlayVoice(params: { soundId?: string; audioUrl?: string; boost?: boolean }) {
    return this.request('/account/voice/broadcast-play', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        isAdmin: this.isAdmin,
        soundTier: this.soundTier,
      }),
    });
  }

  public broadcastStopVoice() {
    return this.request('/account/voice/broadcast-stop', { method: 'POST' });
  }

  // User Account Controller (Token or JSON)
  public connectAccount(tokenOrJson: string) {
    return this.request('/account/connect', {
      method: 'POST',
      body: JSON.stringify({ token: tokenOrJson }),
    });
  }

  public getAccountProfile() {
    return this.request('/account/me');
  }

  public disconnectAccount() {
    return this.request('/account/disconnect', { method: 'POST' });
  }

  public getAccountGuilds(slotIndex?: number) {
    const q = slotIndex !== undefined ? `?slot=${slotIndex}` : '';
    return this.request(`/account/guilds${q}`);
  }

  public getAccountChannels(guildId: string, slotIndex?: number) {
    const q = slotIndex !== undefined ? `?slot=${slotIndex}` : '';
    return this.request(`/account/guilds/${guildId}/channels${q}`);
  }

  public joinServerByInvite(invite: string, slotIndex?: number) {
    return this.request('/account/join-server', {
      method: 'POST',
      body: JSON.stringify({ invite, slotIndex }),
    });
  }

  public leaveAccountServer(guildId: string, slotIndex?: number) {
    const q = slotIndex !== undefined ? `?slot=${slotIndex}` : '';
    return this.request(`/account/guilds/${guildId}${q}`, {
      method: 'DELETE',
    });
  }

  public sendAccountMessage(channelId: string, content: string, tts: boolean = false, slotIndex?: number) {
    return this.request('/account/send-message', {
      method: 'POST',
      body: JSON.stringify({ channelId, content, tts, slotIndex }),
    });
  }

  // Voice Controls
  public joinAccountVoice(guildId: string, channelId: string, slotIndex?: number) {
    return this.request('/account/voice/join', {
      method: 'POST',
      body: JSON.stringify({ guildId, channelId, slotIndex }),
    });
  }

  public leaveAccountVoice(slotIndex?: number) {
    return this.request('/account/voice/leave', {
      method: 'POST',
      body: JSON.stringify({ slotIndex }),
    });
  }

  public setAccountVoiceVolume(volume: number, slotIndex?: number) {
    return this.request('/account/voice/volume', {
      method: 'POST',
      body: JSON.stringify({ volume, slotIndex }),
    });
  }

  public setAccountVoiceMute(mute: boolean, slotIndex?: number) {
    return this.request('/account/voice/mute', {
      method: 'POST',
      body: JSON.stringify({ mute, slotIndex }),
    });
  }

  public setAccountVoiceDeaf(deaf: boolean, slotIndex?: number) {
    return this.request('/account/voice/deaf', {
      method: 'POST',
      body: JSON.stringify({ deaf, slotIndex }),
    });
  }

  public playAccountVoiceAudio(audioUrl: string, boost: boolean = true, slotIndex?: number, mode: 'individual' | 'joint' = 'individual') {
    return this.request('/account/voice/play', {
      method: 'POST',
      body: JSON.stringify({ audioUrl, boost, slotIndex, mode }),
    });
  }

  public stopAccountVoiceAudio(slotIndex?: number, mode: 'individual' | 'joint' = 'individual') {
    return this.request('/account/voice/stop', {
      method: 'POST',
      body: JSON.stringify({ slotIndex, mode }),
    });
  }

  public getAccountVoiceState(slotIndex?: number) {
    const q = slotIndex !== undefined ? `?slot=${slotIndex}` : '';
    return this.request(`/account/voice/state${q}`);
  }

  // Audio Uploads & Soundboard
  public uploadAudio(file: File) {
    const formData = new FormData();
    formData.append('audio', file);
    return this.request('/account/audio/upload', {
      method: 'POST',
      body: formData,
    });
  }

  public getAudios() {
    return this.request('/account/audio');
  }

  public deleteAudio(id: string) {
    return this.request(`/account/audio/${id}`, {
      method: 'DELETE',
    });
  }

  public playSoundInVoice(soundId: string, boost: boolean = true, slotIndex?: number, mode: 'individual' | 'joint' = 'individual') {
    return this.request('/account/voice/play-sound', {
      method: 'POST',
      body: JSON.stringify({ soundId, boost, slotIndex, mode }),
    });
  }

  public playAudioUrl(audioUrl: string, boost: boolean = true, slotIndex?: number, mode: 'individual' | 'joint' = 'individual') {
    return this.request('/account/voice/play', {
      method: 'POST',
      body: JSON.stringify({ audioUrl, boost, slotIndex, mode }),
    });
  }

  // Activity
  public getActivity() {
    return this.request('/activity');
  }
}

export const api = new ApiClient();

import React, { useState } from 'react';
import { Key, ShieldAlert, Lock, Crown, ArrowRight, Zap, CheckCircle2, Sparkles, Radio, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

interface AccessKeyGateModalProps {
  onKeyActivated: (keyInfo: { key: string; maxTokens: number; soundTier: string }) => void;
  onAdminAuthenticated: (adminInfo: { email: string; maxTokens: number; soundTier: string }) => void;
}

export const AccessKeyGateModal: React.FC<AccessKeyGateModalProps> = ({
  onKeyActivated,
  onAdminAuthenticated,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'user'>('user');
  const [keyInput, setKeyInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDirectKeyEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = keyInput.trim().toUpperCase();
    if (!cleanKey) return;

    setError(null);
    setLoading(true);

    const verifyRes = await api.verifyKey(cleanKey);
    if (!verifyRes.success || !verifyRes.data) {
      setLoading(false);
      setError(verifyRes.error || 'Invalid or revoked license key. Contact administrator.');
      return;
    }

    const activateRes = await api.activateKey(cleanKey);
    setLoading(false);

    if (activateRes.success && activateRes.data) {
      api.setActiveKeySession(activateRes.data.key, activateRes.data.soundTier);
      onKeyActivated(activateRes.data);
    } else {
      setError(activateRes.error || 'Failed to activate license key.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setError('Please provide an administrator email address.');
      return;
    }
    if (!passwordInput.trim()) {
      setError('Please enter the administrator password.');
      return;
    }

    setError(null);
    setLoading(true);

    const res = await api.adminLogin(emailInput.trim(), passwordInput.trim());
    setLoading(false);

    if (res.success && res.data) {
      api.setAdminSession(res.data.email, true);
      onAdminAuthenticated(res.data);
    } else {
      setError(res.error || 'Invalid administrator email or password.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F2EB] flex flex-col items-center justify-center p-3 sm:p-6 text-black selection:bg-[#FFE600] selection:text-black">
      {/* Top Brand Sticker */}
      <div className="w-full max-w-4xl mb-6 text-center space-y-2">
        <div className="inline-flex items-center space-x-2 bg-white border-2 border-black px-3.5 py-1.5 rounded-lg shadow-neo-sm mb-1">
          <Radio className="w-4 h-4 text-black animate-pulse" />
          <span className="font-mono text-xs font-black uppercase tracking-wider">
            DISCORD AUDIO STREAM HUB • E2EE DAVE
          </span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-black">
          GOD x LIVE
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-gray-700 max-w-md mx-auto">
          Please select your access mode to enter the remote account and voice broadcasting system.
        </p>

        {/* Mobile-Friendly Switcher Tabs */}
        <div className="pt-2 flex justify-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => {
              setActiveTab('user');
              setError(null);
            }}
            className={`btn-neo px-4 py-2 text-xs font-black uppercase flex items-center gap-1.5 ${
              activeTab === 'user' ? 'btn-neo-purple' : 'btn-neo-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>User / Client</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError(null);
            }}
            className={`btn-neo px-4 py-2 text-xs font-black uppercase flex items-center gap-1.5 ${
              activeTab === 'admin' ? 'btn-neo-yellow' : 'btn-neo-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Admin Portal</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="w-full max-w-4xl mb-5 bg-[#FF6B6B] border-3 border-black p-3.5 rounded-xl shadow-neo text-black font-bold text-xs sm:text-sm flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Dual Cards Grid (Side-by-Side on Desktop, Responsive Tab on Mobile) */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* OPTION 1: USER / CLIENT KEY UNLOCK */}
        <div
          className={`card-neo p-5 sm:p-7 flex flex-col justify-between transition-all ${
            activeTab === 'user'
              ? 'ring-4 ring-black bg-white shadow-neo-lg scale-[1.01]'
              : 'hidden sm:flex bg-[#FAF8F5] opacity-90 hover:opacity-100'
          }`}
          onClick={() => setActiveTab('user')}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="badge-neo bg-[#A78BFA] text-black px-2.5 py-1 text-[11px]">
                🔑 CLIENT KEY
              </span>
              <span className="font-mono text-xs font-bold text-gray-500">PORTAL 01</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                User / Client Login
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 font-medium mt-1 leading-relaxed">
                Got an access key from your administrator? Enter your license key here to unlock your multi-token console.
              </p>
            </div>

            <div className="bg-[#F5F2EB] border-2 border-black p-3 rounded-lg space-y-1.5 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Multi-Token Voice Streamer</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Custom MP3/WAV Instant Soundboard</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Auto-Join Servers & Voice Channels</span>
              </div>
            </div>

            <form onSubmit={handleDirectKeyEntry} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider block">
                  Enter License Key:
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  placeholder="KEY-XXXX-XXXX-XXXX"
                  className="input-neo w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono font-black uppercase tracking-wider text-center"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !keyInput.trim()}
                className="btn-neo btn-neo-purple w-full py-3 text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2 shadow-neo disabled:opacity-50"
              >
                <span>{loading ? 'Validating Key...' : 'Unlock Client Console'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="pt-4 border-t-2 border-black/10 text-center">
            <span className="text-[11px] font-bold text-gray-500">
              Need a key? Ask your Superadmin to generate one for you.
            </span>
          </div>
        </div>

        {/* OPTION 2: ADMIN PORTAL */}
        <div
          className={`card-neo-yellow p-5 sm:p-7 flex flex-col justify-between transition-all ${
            activeTab === 'admin'
              ? 'ring-4 ring-black shadow-neo-lg scale-[1.01]'
              : 'hidden sm:flex opacity-90 hover:opacity-100'
          }`}
          onClick={() => setActiveTab('admin')}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="badge-neo bg-black text-white px-2.5 py-1 text-[11px]">
                👑 SUPERADMIN
              </span>
              <span className="font-mono text-xs font-bold text-black/60">PORTAL 02</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
                Administrator Portal
              </h2>
              <p className="text-xs sm:text-sm text-black/80 font-medium mt-1 leading-relaxed">
                Superadmin dashboard for full control, generating custom token keys for users, and 300% peak overdrive.
              </p>
            </div>

            <div className="bg-white/80 border-2 border-black p-3 rounded-lg space-y-1.5 text-xs font-bold text-black">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-black shrink-0" />
                <span>Option 1: Connect your tokens directly</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-black shrink-0" />
                <span>Option 2: Generate Keys (1, 2, 3 to N tokens)</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-black shrink-0" />
                <span>🔥 300% Peak Overdrive High Sound (+14 dB)</span>
              </div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3 pt-2">
              <div className="space-y-1 text-left">
                <label className="text-xs font-black uppercase tracking-wider block text-black">
                  Admin Email Address:
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@yourdomain.com"
                  className="input-neo w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-black uppercase tracking-wider block text-black">
                  Admin Password:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter admin password..."
                    className="input-neo w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !emailInput.trim() || !passwordInput.trim()}
                className="btn-neo btn-neo-black w-full py-3 text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2 shadow-neo disabled:opacity-50"
              >
                <Crown className="w-4 h-4 text-[#FFE600]" />
                <span>{loading ? 'Authenticating...' : 'Enter As Administrator'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="pt-4 border-t-2 border-black/15 text-center">
            <span className="text-[11px] font-extrabold text-black/70 font-mono">
              🔒 Secure Administrator Portal • Authorized Personnel Only
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Power,
  ShieldCheck,
  X,
  ArrowRight,
  Zap,
  Sparkles,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';

interface AdminDashboardModalProps {
  onClose: () => void;
  adminEmail: string;
  onLogoutAdmin?: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  onClose,
  adminEmail,
  onLogoutAdmin,
}) => {
  const [keys, setKeys] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [status, setStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAdminPassword, setCopiedAdminPassword] = useState<string | null>(null);

  // New admin email delegation state
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminBanner, setAdminBanner] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Key generator form state: support 1, 3, 5, 10, 25, 50, 100 up to custom 100 slots
  const [tokenSelectionType, setTokenSelectionType] = useState<'1' | '3' | '5' | '10' | '25' | '50' | '100' | 'custom'>('1');
  const [customTokenCount, setCustomTokenCount] = useState<number>(10);
  const [genSoundTier, setGenSoundTier] = useState<'standard' | 'admin_peaks'>('standard');
  const [genLabel, setGenLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<any | null>(null);
  const [generating, setGenerating] = useState(false);

  const getEffectiveTokenCount = (): number => {
    if (tokenSelectionType === '1') return 1;
    if (tokenSelectionType === '3') return 3;
    if (tokenSelectionType === '5') return 5;
    if (tokenSelectionType === '10') return 10;
    if (tokenSelectionType === '25') return 25;
    if (tokenSelectionType === '50') return 50;
    if (tokenSelectionType === '100') return 100;
    return Math.max(1, Math.min(100, Math.floor(Number(customTokenCount) || 1)));
  };

  const loadData = async () => {
    setLoading(true);
    const [statusRes, keysRes, adminsRes] = await Promise.all([
      api.getAdminStatus(),
      api.getAdminKeys(),
      api.getAdminList(),
    ]);
    if (statusRes.success) setStatus(statusRes.data);
    if (keysRes.success) setKeys(keysRes.data || []);
    if (adminsRes.success && adminsRes.data?.admins) setAdmins(adminsRes.data.admins);
    setLoading(false);
  };

  const handleAddAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    const cleanPass = newAdminPassword.trim();
    if (!cleanEmail) {
      setAdminBanner({ text: 'Please enter an admin email address.', type: 'error' });
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setAdminBanner({ text: 'Please set a password (at least 4 characters) for this admin.', type: 'error' });
      return;
    }

    setAddingAdmin(true);
    setAdminBanner(null);

    const res = await api.addAdminEmail(cleanEmail, cleanPass);
    setAddingAdmin(false);

    if (res.success) {
      setNewAdminEmail('');
      setNewAdminPassword('');
      setAdminBanner({ text: `Admin access and password granted to ${cleanEmail}!`, type: 'success' });
      await loadData();
    } else {
      setAdminBanner({ text: res.error || 'Failed to add admin email', type: 'error' });
    }
    setTimeout(() => setAdminBanner(null), 5000);
  };

  const handleRemoveAdminEmail = async (email: string) => {
    if (confirm(`Revoke admin privileges for "${email}"?`)) {
      const res = await api.removeAdminEmail(email);
      if (res.success) {
        setAdminBanner({ text: `Removed admin ${email}`, type: 'success' });
        await loadData();
      } else {
        setAdminBanner({ text: res.error || 'Failed to remove admin', type: 'error' });
      }
      setTimeout(() => setAdminBanner(null), 5000);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    const tokens = getEffectiveTokenCount();

    const res = await api.generateAdminKey({
      maxTokens: tokens,
      soundTier: genSoundTier,
      label: genLabel.trim() || undefined,
    });
    setGenerating(false);

    if (res.success && res.data) {
      setGeneratedKey(res.data);
      setGenLabel('');
      await loadData();
    } else {
      alert(`Failed to generate key: ${res.error}`);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const handleToggleKey = async (id: string, currentlyActive: boolean) => {
    if (currentlyActive) {
      await api.revokeAdminKey(id);
    } else {
      await api.activateAdminKey(id);
    }
    await loadData();
  };

  const handleDeleteKey = async (id: string) => {
    if (confirm('Are you sure you want to delete this access key?')) {
      await api.deleteAdminKey(id);
      await loadData();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="card-neo w-full max-w-4xl bg-white shadow-neo-xl overflow-hidden my-auto border-3 border-black text-black">
        {/* Top Header */}
        <div className="bg-[#FFE600] border-b-3 border-black p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-neo-sm">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <span>ADMIN CONTROL DASHBOARD</span>
                <span className="badge-neo bg-black text-white px-2 py-0.5 text-[10px]">
                  SUPERADMIN
                </span>
              </h2>
              <p className="text-xs font-mono font-bold text-black/75 mt-0.5">
                {adminEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onLogoutAdmin && (
              <button
                type="button"
                onClick={onLogoutAdmin}
                className="btn-neo btn-neo-coral px-3 py-1.5 text-xs font-black uppercase flex items-center gap-1.5"
                title="Log out from Superadmin"
              >
                <span>Logout</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="btn-neo btn-neo-white p-2 rounded-lg"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* THE TWO MAIN ADMIN PATHWAYS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPTION 1: Connect Your Tokens Directly */}
            <div className="bg-[#FAF8F5] border-3 border-black rounded-xl p-5 shadow-neo flex flex-col justify-between space-y-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 badge-neo bg-[#4ADE80] text-black px-2.5 py-1 text-xs mb-3">
                  <Zap className="w-3.5 h-3.5" />
                  <span>PATHWAY 01</span>
                </div>
                <h3 className="text-base font-black uppercase text-black">
                  Connect Your Tokens Directly
                </h3>
                <p className="text-xs text-gray-700 font-semibold mt-1 leading-relaxed">
                  Direct Superadmin access to connect 3 tokens (or N tokens). Automatically unlocks <strong>🔥 300% Peak Overdrive</strong> sound output ceiling (+14 dB).
                </p>
              </div>

              <button
                onClick={onClose}
                className="btn-neo btn-neo-lime w-full py-2.5 text-xs font-black uppercase flex items-center justify-center space-x-2"
              >
                <span>Launch & Connect Your Tokens</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* OPTION 2: Quick Key Generator Header Card */}
            <div className="bg-[#FAF8F5] border-3 border-black rounded-xl p-5 shadow-neo flex flex-col justify-between space-y-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 badge-neo bg-[#FFE600] text-black px-2.5 py-1 text-xs mb-3">
                  <Key className="w-3.5 h-3.5" />
                  <span>PATHWAY 02</span>
                </div>
                <h3 className="text-base font-black uppercase text-black">
                  Generate User Access Key
                </h3>
                <p className="text-xs text-gray-700 font-semibold mt-1 leading-relaxed">
                  Generate a user license key with <strong>1, 2, 3, or N token slots</strong>. The user simply types the key to open their panel.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
                <span className="badge-neo bg-white px-2 py-1 text-[11px] font-mono">
                  {keys.length} Active Key{keys.length === 1 ? '' : 's'}
                </span>
                <span>Configure & generate below &darr;</span>
              </div>
            </div>
          </div>

          {/* Key Generator Form Section */}
          <div className="bg-[#FFFDF9] border-3 border-black rounded-xl p-5 shadow-neo space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                <Key className="w-4 h-4 text-black" />
                <span>GENERATE NEW CLIENT ACCESS KEY</span>
              </h3>
            </div>

            <form onSubmit={handleGenerateKey} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. How many tokens user needs */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider block text-black">
                    Token Slots Limit
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['1', '3', '5', '10', '25', '50', '100', 'custom'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTokenSelectionType(t)}
                        className={`btn-neo py-1 text-[11px] font-black uppercase ${
                          tokenSelectionType === t
                            ? 'btn-neo-yellow'
                            : 'btn-neo-white text-gray-600'
                        }`}
                      >
                        {t === 'custom' ? 'Custom' : `${t}`}
                      </button>
                    ))}
                  </div>

                  {tokenSelectionType === 'custom' && (
                    <div className="pt-1.5 flex items-center space-x-2">
                      <span className="text-xs font-bold">Custom (1-100):</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={customTokenCount}
                        onChange={(e) => setCustomTokenCount(Number(e.target.value))}
                        className="input-neo w-24 px-2 py-1 text-xs font-mono font-black"
                      />
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-gray-600">
                    Granting: <strong className="text-black font-black">{getEffectiveTokenCount()} Token Slot(s)</strong>
                  </p>
                </div>

                {/* 2. Sound Output Power Tier */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider block text-black">
                    Audio Power Output
                  </label>
                  <select
                    value={genSoundTier}
                    onChange={(e) => setGenSoundTier(e.target.value as any)}
                    className="input-neo w-full px-3 py-2 text-xs font-bold"
                  >
                    <option value="standard">Standard Loud (Normal: 100%)</option>
                    <option value="admin_peaks">🔥 300% High Peaks Overdrive</option>
                  </select>
                </div>

                {/* 3. Client Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider block text-black">
                    Note / Client Name
                  </label>
                  <input
                    type="text"
                    value={genLabel}
                    onChange={(e) => setGenLabel(e.target.value)}
                    placeholder="e.g. VIP Client 1"
                    className="input-neo w-full px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="btn-neo btn-neo-yellow px-5 py-2.5 text-xs font-black uppercase flex items-center space-x-2 shadow-neo disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{generating ? 'Generating...' : `Generate ${getEffectiveTokenCount()}-Token Key`}</span>
              </button>
            </form>

            {/* Newly Generated Key Banner with 1-Click Copy */}
            {generatedKey && (
              <div className="bg-[#DCFCE7] border-3 border-black rounded-xl p-4 shadow-neo flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="space-y-1">
                  <span className="badge-neo bg-black text-white px-2 py-0.5 text-[10px]">
                    ✓ KEY CREATED SUCCESSFULLY
                  </span>
                  <p className="text-base font-mono font-black text-black tracking-widest">{generatedKey.key}</p>
                  <p className="text-xs font-bold text-gray-700">
                    {generatedKey.max_tokens} Token Slot(s) • {generatedKey.sound_tier === 'admin_peaks' ? '🔥 300% Overdrive' : '100% Standard'}
                  </p>
                </div>

                <button
                  onClick={() => handleCopy(generatedKey.key)}
                  className="btn-neo btn-neo-black text-white px-4 py-2 text-xs font-black uppercase flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {copiedKey === generatedKey.key ? (
                    <>
                      <Check className="w-4 h-4 text-[#4ADE80]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" />
                      <span>Copy Key</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Section: Authorized Administrators Delegation */}
          <div className="card-neo p-5 bg-white space-y-4 shadow-neo">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase text-black flex items-center gap-2">
                  <Users className="w-4 h-4 text-black" />
                  <span>AUTHORIZED ADMINISTRATORS ({admins.length})</span>
                </h3>
                <p className="text-[11px] font-bold text-gray-600 mt-0.5">
                  Superadmin Owner: <strong className="text-black">{adminEmail || 'Root Superadmin'}</strong>. The owner can delegate admin access to other email addresses.
                </p>
              </div>

              <span className="badge-neo bg-[#FFE600] text-black text-[10px] px-2 py-0.5 self-start sm:self-auto">
                OWNER CONTROL
              </span>
            </div>

            {adminBanner && (
              <div
                className={`border-2 border-black p-2.5 rounded-lg text-xs font-bold ${
                  adminBanner.type === 'success' ? 'bg-[#DCFCE7] text-black' : 'bg-[#FF6B6B] text-black'
                }`}
              >
                {adminBanner.text}
              </div>
            )}

            {/* Add New Admin Email & Password Form */}
            {status?.isOwner ? (
              <form onSubmit={handleAddAdminEmail} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5">
                  <input
                    type="email"
                    placeholder="Admin email (e.g. partner@gmail.com)..."
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="input-neo w-full px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-4 relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    placeholder="Set admin password..."
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="input-neo w-full px-3 py-2 text-xs font-bold pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-0.5"
                    title={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={addingAdmin || !newAdminEmail.trim() || !newAdminPassword.trim()}
                    className="btn-neo btn-neo-yellow w-full py-2 text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-neo-sm disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{addingAdmin ? 'Adding...' : 'Authorize Admin'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-gray-100 border-2 border-black rounded-lg text-xs font-bold text-gray-600 flex items-center gap-2">
                <Lock className="w-4 h-4 text-black shrink-0" />
                <span>Admin delegation & modification is restricted to Super Admin only.</span>
              </div>
            )}

            {/* Admins List Table */}
            <div className="border-2 border-black rounded-lg overflow-hidden bg-[#FAF8F5]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F2EB] border-b-2 border-black font-black uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Admin Email</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Assigned Password</th>
                    <th className="py-2 px-3">Authorized By</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {admins.map((adm) => {
                    const isOwner = adm.role === 'owner';
                    return (
                      <tr key={adm.id || adm.email} className="hover:bg-yellow-50/50 font-medium">
                        <td className="py-2.5 px-3 font-mono font-bold text-black select-all">
                          {adm.email}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`badge-neo text-[9px] px-2 py-0.5 ${
                              isOwner ? 'bg-[#FFE600] text-black' : 'bg-[#4ADE80] text-black'
                            }`}
                          >
                            {isOwner ? 'ROOT OWNER' : 'ADMIN'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] font-bold">
                          {isOwner ? (
                            <span className="text-gray-500 font-mono">••••••••</span>
                          ) : adm.password ? (
                            <div className="inline-flex items-center space-x-1.5 bg-white border border-black px-1.5 py-0.5 rounded shadow-neo-xs">
                              <span className="select-all font-mono font-black">{adm.password}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(adm.password)}
                                title="Copy Password"
                                className="text-gray-500 hover:text-black ml-1"
                              >
                                {copiedKey === adm.password ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Default</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-mono text-gray-600">
                          {adm.added_by || 'system'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isOwner ? (
                            <span className="text-[10px] font-bold text-gray-400 italic">Primary Owner</span>
                          ) : status?.isOwner ? (
                            <button
                              onClick={() => handleRemoveAdminEmail(adm.email)}
                              title="Revoke Admin Access"
                              className="btn-neo btn-neo-coral p-1 text-[10px]"
                            >
                              <Trash2 className="w-3 h-3 text-black" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold italic">Super Admin Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Keys Management Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>GENERATED LICENSES ({keys.length})</span>
              </h3>
              <button
                onClick={loadData}
                className="btn-neo btn-neo-white px-2.5 py-1 text-xs font-bold"
              >
                Refresh
              </button>
            </div>

            <div className="border-3 border-black rounded-xl overflow-hidden shadow-neo bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F2EB] text-black border-b-2 border-black font-black uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">License Key</th>
                      <th className="py-2.5 px-3">Slots</th>
                      <th className="py-2.5 px-3">Sound Power</th>
                      <th className="py-2.5 px-3">Note</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black/10">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-yellow-50/60 transition-colors font-medium">
                        <td className="py-3 px-4 font-mono font-black text-black select-all">
                          {k.key}
                        </td>
                        <td className="py-3 px-3">
                          <span className="badge-neo bg-white px-2 py-0.5 text-[10px] font-mono">
                            {k.max_tokens} Slot{k.max_tokens > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`badge-neo px-2 py-0.5 text-[10px] ${k.sound_tier === 'admin_peaks' ? 'bg-[#FFE600]' : 'bg-[#E2E8F0]'}`}>
                            {k.sound_tier === 'admin_peaks' ? '🔥 300%' : '100%'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-700 font-bold">
                          {k.label || '—'}
                        </td>
                        <td className="py-3 px-3">
                          {k.is_active ? (
                            <span className="badge-neo bg-[#4ADE80] text-black px-2 py-0.5 text-[10px]">Active</span>
                          ) : (
                            <span className="badge-neo bg-[#FF6B6B] text-black px-2 py-0.5 text-[10px]">Revoked</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handleCopy(k.key)}
                            title="Copy Key"
                            className="btn-neo btn-neo-white p-1.5"
                          >
                            {copiedKey === k.key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {status?.isOwner ? (
                            <>
                              <button
                                onClick={() => handleToggleKey(k.id, k.is_active)}
                                title={k.is_active ? 'Revoke Key' : 'Activate Key'}
                                className={`btn-neo p-1.5 ${k.is_active ? 'btn-neo-yellow' : 'btn-neo-lime'}`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteKey(k.id)}
                                title="Delete Key"
                                className="btn-neo btn-neo-coral p-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-black" />
                              </button>
                            </>
                          ) : (
                            <span className="badge-neo bg-emerald-100 text-emerald-800 border border-emerald-400 px-1.5 py-0.5 text-[9px] font-bold" title="Keys are permanent and only Super Admin can revoke">
                              Permanent
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

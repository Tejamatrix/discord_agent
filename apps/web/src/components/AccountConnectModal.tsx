import React, { useState } from 'react';
import { KeyRound, Shield, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

interface AccountConnectModalProps {
  onConnect: (tokenOrJson: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}

export const AccountConnectModal: React.FC<AccountConnectModalProps> = ({
  onConnect,
  loading,
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!input.trim()) {
      setError('Please provide an account token or JSON string.');
      return;
    }

    const res = await onConnect(input);
    if (!res.success) {
      setError(res.error || 'Failed to authenticate token with Discord.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex items-center justify-center p-3 sm:p-6 text-black selection:bg-[#FFE600] selection:text-black">
      <div className="card-neo max-w-lg w-full p-5 sm:p-8 space-y-5 shadow-neo-lg bg-white">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="badge-neo bg-[#FFE600] text-black px-2.5 py-1 text-xs">
              ⚡ PRIMARY TOKEN
            </span>
            <span className="font-mono text-xs font-black text-gray-500">SLOT 01</span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
              Connect Discord Account
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 font-semibold mt-0.5">
              Paste your user token or Bluecord JSON to initialize your Discord audio console.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-[#FF6B6B] border-2 border-black p-3 rounded-lg shadow-neo-sm flex items-center space-x-2.5 text-xs sm:text-sm font-bold text-black">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-black">
                Account Token / Bluecord JSON
              </label>
            </div>

            <textarea
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Paste token or JSON...\nExample: MTIzNDU2...\nor { "token": "MTIzNDU2..." }`}
              autoFocus
              className="input-neo w-full p-3 text-xs sm:text-sm font-mono resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-neo btn-neo-yellow w-full py-3.5 text-xs sm:text-sm font-black uppercase flex items-center justify-center space-x-2 shadow-neo disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Connect Token & Launch Console</span>
            )}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Security Note */}
        <div className="bg-[#FAF8F5] border-2 border-black p-3 rounded-lg shadow-neo-sm flex items-start space-x-2.5 text-xs font-bold text-gray-700">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Encrypted client session. Voice calls, channels, and audio streaming transmit securely using Discord DAVE E2EE voice protocol.
          </p>
        </div>
      </div>
    </div>
  );
};

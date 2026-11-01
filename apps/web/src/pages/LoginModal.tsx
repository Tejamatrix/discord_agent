import React from 'react';
import { Bot, LogIn, Radio, Shield, Sparkles } from 'lucide-react';

interface LoginModalProps {
  onDiscordLogin: () => void;
  onDemoLogin: () => void;
  loading: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onDiscordLogin,
  onDemoLogin,
  loading,
}) => {
  return (
    <div className="min-h-screen bg-discord-darker flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-discord-brand/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-discord-card border border-slate-700/80 rounded-3xl max-w-md w-full p-8 shadow-2xl relative z-10 text-center space-y-6">
        {/* App Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-discord-brand to-indigo-600 flex items-center justify-center mx-auto shadow-xl shadow-discord-brand/30">
          <Radio className="w-8 h-8 text-white animate-pulse" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-white">Discord Control Hub</h2>
          <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mt-1">
            Centralized SaaS Command Center
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Authenticate to control bot voice streaming, music queues, announcements, and server fleet operations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Main Discord OAuth2 button */}
          <button
            onClick={onDiscordLogin}
            disabled={loading}
            className="w-full bg-discord-brand hover:bg-discord-brand/90 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2.5 shadow-lg shadow-discord-brand/25 group"
          >
            <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Login with Discord OAuth2</span>
          </button>

          {/* Instant 1-Click Demo Login button */}
          <button
            onClick={onDemoLogin}
            disabled={loading}
            className="w-full bg-discord-dark hover:bg-discord-hover text-slate-200 border border-slate-700 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Instant 1-Click Demo Login (Full SaaS Preview)</span>
          </button>
        </div>

        {/* Security Assurance Badge */}
        <div className="pt-4 border-t border-slate-800 text-left bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Enterprise OAuth2 Security</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Your personal Discord password or personal user token is never requested or collected.
            Role-based multi-tenant permissions are strictly enforced.
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Activity, CheckCircle2, Key, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react';
import { ActivityLog } from '@hub/shared';

interface ActivityViewProps {
  logs: ActivityLog[];
  loginHistory: any[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ logs, loginHistory }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'logins'>('audit');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
          <ShieldCheck className="w-7 h-7 text-indigo-400" />
          Activity & Security Audits
        </h2>
        <p className="text-sm text-slate-400">
          Immutable audit trails for bot actions, voice stream events, and dashboard authentication.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'audit'
              ? 'bg-discord-brand text-white shadow-md shadow-discord-brand/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Operational Audit Logs ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('logins')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logins'
              ? 'bg-discord-brand text-white shadow-md shadow-discord-brand/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Session & Login History ({loginHistory.length})
        </button>
      </div>

      {/* Tab 1: Operational Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-discord-card border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-discord-dark/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Server / Scope</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-discord-dark/30 transition-colors">
                    <td className="py-3 px-4 text-white font-semibold flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{log.action}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{log.guild_name || 'System / All'}</td>
                    <td className="py-3 px-4 text-slate-300">{log.username || 'Current User'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Login History */}
      {activeTab === 'logins' && (
        <div className="bg-discord-card border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center space-x-2 text-xs text-slate-300">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span>OAuth2 Session Authentications for this tenant</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-discord-dark/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Protocol</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loginHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-discord-dark/30 transition-colors">
                    <td className="py-3 px-4 text-white font-semibold">{item.action}</td>
                    <td className="py-3 px-4 text-slate-300 font-mono">Discord OAuth2 + JWT</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                        VERIFIED
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ExternalLink, MessageSquare, CheckCircle, Bell } from 'lucide-react';
import { saveSlackWebhook } from '@/lib/api';

interface HeaderProps {
  user: {
    name?: string;
    email?: string;
    avatar?: string;
    slackWebhookUrl?: string | null;
  } | null;
  slackConnected: boolean;
  onSlackUpdated: () => void;
}

export function Header({ user, slackConnected, onSlackUpdated }: HeaderProps) {
  const router = useRouter();
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  }

  async function handleSaveSlack() {
    if (!webhookUrl.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveSlackWebhook(webhookUrl.trim());
      setSaveMsg('Slack connected successfully!');
      onSlackUpdated();
      setTimeout(() => setShowSlackModal(false), 1200);
    } catch (err: any) {
      setSaveMsg(err.message || 'Failed to save Slack webhook');
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
            R
          </div>
          <div>
            <span className="font-bold text-slate-100 tracking-tight text-base sm:text-lg">ReachInbox</span>
            <span className="text-xs text-indigo-400 ml-2 font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              Scheduler
            </span>
          </div>
        </div>

        {/* Right action group */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* BullMQ Dashboard link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/50"
          >
            <span>BullMQ Live</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Slack Connection button */}
          <button
            onClick={() => setShowSlackModal(true)}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              slackConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{slackConnected ? 'Slack Connected' : 'Connect Slack'}</span>
          </button>

          {/* User profile dropdown / info */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User avatar'}
                className="w-8 h-8 rounded-full bg-slate-800 ring-2 ring-indigo-500/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-medium text-xs">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden md:block text-left">
              <div className="text-xs font-medium text-slate-200 leading-none">{user?.name || 'Authorized Lead'}</div>
              <div className="text-[10px] text-slate-500 font-mono leading-none mt-1">{user?.email || 'user@reachinbox.ai'}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slack Connect Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Slack Rate Limit Alerts</h3>
                <p className="text-xs text-slate-400">Receive live alerts when sender hourly limits are hit.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Incoming Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {saveMsg && (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{saveMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSlackModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSlack}
                  disabled={saving || !webhookUrl.trim()}
                  className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {saving ? 'Connecting...' : 'Save Webhook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

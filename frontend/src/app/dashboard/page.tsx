'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Send,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  ChevronDown,
  LogOut,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { EmailTable } from '@/components/EmailTable';
import { ComposeView } from '@/components/ComposeView';
import { EmailDetailView } from '@/components/EmailDetailView';
import {
  fetchScheduledEmails,
  fetchSentEmails,
  clearSentEmailsApi,
  searchEmails,
  saveSlackWebhook,
  getSlackStatus,
  EmailItem,
} from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [searchResults, setSearchResults] = useState<EmailItem[] | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearingSent, setClearingSent] = useState(false);

  // View states
  const [isComposing, setIsComposing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  // Profile dropdown & Slack modal
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackUrl, setSlackUrl] = useState('');
  const [slackConnected, setSlackConnected] = useState(false);
  const [savingSlack, setSavingSlack] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token) {
      router.push('/');
      return;
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduled, sent, slack] = await Promise.all([
        fetchScheduledEmails(),
        fetchSentEmails(),
        getSlackStatus().catch(() => ({ connected: false })),
      ]);
      setScheduledEmails(scheduled || []);
      setSentEmails(sent || []);
      setSlackConnected(Boolean(slack?.connected));
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await searchEmails(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      console.error('Search failed:', err.message);
    }
  }

  async function handleClearSent() {
    if (
      !window.confirm(
        'Are you sure you want to permanently clear all sent email logs? This will delete them from the database and dashboard.'
      )
    ) {
      return;
    }
    setClearingSent(true);
    try {
      await clearSentEmailsApi();
      setSentEmails([]);
      if (searchResults) {
        setSearchResults(searchResults.filter((e) => e.status === 'SCHEDULED'));
      }
      if (selectedEmail && (selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED')) {
        setSelectedEmail(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to clear sent email logs');
    } finally {
      setClearingSent(false);
    }
  }

  async function handleSaveSlack() {
    if (!slackUrl.trim()) return;
    setSavingSlack(true);
    try {
      await saveSlackWebhook(slackUrl.trim());
      setSlackConnected(true);
      setShowSlackModal(false);
      setSlackUrl('');
    } catch (err: any) {
      alert(err.message || 'Failed to save Slack webhook');
    } finally {
      setSavingSlack(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  }

  // Active email list
  const currentList =
    searchResults !== null
      ? searchResults
      : activeTab === 'scheduled'
      ? scheduledEmails
      : sentEmails;

  const userName = user?.name || 'Oliver Brown';
  const userEmail = user?.email || 'oliver.brown@domain.io';
  const userAvatar =
    user?.avatar ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row text-gray-900 font-sans">
      {/* ── LEFT SIDEBAR (Matches Figma Images 2 & 3) ── */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-100 bg-white p-5 flex flex-col shrink-0">
        {/* Stylized Logo: ONG */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-2xl font-black tracking-tighter text-black font-mono">
            ONG
          </div>
        </div>

        {/* Profile Card Pill */}
        <div className="relative mb-6">
          <div
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center justify-between p-2 rounded-2xl bg-gray-50/80 hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate">
                  {userName}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {userEmail}
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1" />
          </div>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute left-0 top-14 w-full bg-white border border-gray-200 rounded-2xl shadow-xl p-2 z-50 text-xs space-y-1">
              <button
                onClick={() => {
                  setShowSlackModal(true);
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connect Slack Webhook</span>
              </button>

              <a
                href="http://localhost:5000/admin/queues"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                  <span>BullMQ Live Monitor</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                  :5000
                </span>
              </a>

              <div className="border-t border-gray-100 my-1"></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>

        {/* Compose Button (Pill shaped, Green outline, Matches Figma) */}
        <button
          onClick={() => {
            setSelectedEmail(null);
            setIsComposing(true);
          }}
          className="w-full py-2.5 px-4 mb-6 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA] font-semibold text-xs transition-all active:scale-[0.99] text-center"
        >
          Compose
        </button>

        {/* CORE Navigation Section */}
        <div className="space-y-1 flex-1">
          <div className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            CORE
          </div>

          {/* Scheduled Nav Item */}
          <button
            onClick={() => {
              setActiveTab('scheduled');
              setSearchResults(null);
              setSelectedEmail(null);
              setIsComposing(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-colors ${
              activeTab === 'scheduled' && !isComposing && !selectedEmail
                ? 'bg-[#E6F4EA] text-[#00A854] font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4" />
              <span>Scheduled</span>
            </div>
            <span className="text-xs font-mono font-medium">
              {scheduledEmails.length}
            </span>
          </button>

          {/* Sent Nav Item */}
          <button
            onClick={() => {
              setActiveTab('sent');
              setSearchResults(null);
              setSelectedEmail(null);
              setIsComposing(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-colors ${
              activeTab === 'sent' && !isComposing && !selectedEmail
                ? 'bg-[#E6F4EA] text-[#00A854] font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4" />
              <span>Sent</span>
            </div>
            <span className="text-xs font-mono font-medium">
              {sentEmails.length}
            </span>
          </button>
        </div>

        {/* Slack Status Indicator in sidebar footer */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                slackConnected ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
            <span>Slack Alerts</span>
          </span>
          <button
            onClick={() => setShowSlackModal(true)}
            className="text-[#00A854] hover:underline"
          >
            {slackConnected ? 'Connected' : 'Setup'}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-white min-h-screen">
        {/* CASE 1: Compose View is open */}
        {isComposing ? (
          <ComposeView
            defaultSender={userEmail}
            onBack={() => setIsComposing(false)}
            onSuccess={() => {
              setIsComposing(false);
              loadData();
            }}
          />
        ) : selectedEmail ? (
          /* CASE 2: Single Email Detail View is open */
          <EmailDetailView
            email={selectedEmail}
            onBack={() => setSelectedEmail(null)}
            onDelete={async () => {
              setSelectedEmail(null);
              loadData();
            }}
          />
        ) : (
          /* CASE 3: Normal Table / List View (Matches Figma Images 2 & 3) */
          <>
            {/* Header: Search Bar & Actions */}
            <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between gap-4 sticky top-0 bg-white z-10">
              {/* Search input pill */}
              <form onSubmit={handleSearch} className="flex-1 max-w-lg">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full pl-10 pr-4 py-2 bg-[#F3F4F6] border-none rounded-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              </form>

              {/* Right Action Icons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="Filter"
                >
                  <Filter className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  title="Refresh List"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin text-[#00A854]' : ''}`}
                  />
                </button>

                {/* Clear Sent Logs Action (if on Sent tab and has emails) */}
                {activeTab === 'sent' && sentEmails.length > 0 && (
                  <button
                    onClick={handleClearSent}
                    disabled={clearingSent}
                    className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                    title="Clear sent email logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{clearingSent ? 'Clearing...' : 'Clear Sent'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Email Rows List Table */}
            <div className="flex-1 overflow-y-auto">
              <EmailTable
                emails={currentList}
                loading={loading}
                type={activeTab}
                onSelectEmail={(email) => setSelectedEmail(email)}
                onComposeClick={() => setIsComposing(true)}
              />
            </div>
          </>
        )}
      </main>

      {/* Slack Connect Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Connect Slack Webhook
            </h3>
            <p className="text-xs text-gray-500">
              Enter your Slack Incoming Webhook URL to receive automated alerts when any sender reaches their hourly rate limit.
            </p>
            <input
              type="url"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSlackModal(false)}
                className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSlack}
                disabled={savingSlack || !slackUrl.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#00A854] hover:bg-[#009247] rounded-xl transition-all disabled:opacity-50"
              >
                {savingSlack ? 'Connecting...' : 'Save Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

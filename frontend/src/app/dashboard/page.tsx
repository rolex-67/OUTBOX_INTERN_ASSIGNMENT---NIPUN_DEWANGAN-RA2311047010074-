'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Send, Clock, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { Header } from '@/components/Header';
import { EmailTable } from '@/components/EmailTable';
import { ComposeModal } from '@/components/ComposeModal';
import {
  fetchScheduledEmails,
  fetchSentEmails,
  searchEmails,
  getSlackStatus,
  EmailItem,
} from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [searchResults, setSearchResults] = useState<EmailItem[] | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Authentication check
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
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
        getSlackStatus(),
      ]);
      setScheduledEmails(scheduled || []);
      setSentEmails(sent || []);
      setSlackConnected(slack.connected);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [loadData]);

  // Elasticsearch live search
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const results = await searchEmails(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      console.error('Search failed:', err.message);
    } finally {
      setSearching(false);
    }
  }

  function handleClearSearch() {
    setSearchQuery('');
    setSearchResults(null);
  }

  const currentList =
    searchResults !== null
      ? searchResults
      : activeTab === 'scheduled'
      ? scheduledEmails
      : sentEmails;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        user={user}
        slackConnected={slackConnected}
        onSlackUpdated={loadData}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top bar with stats & compose button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Email Dispatch Monitor
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live BullMQ queue status, throttle enforcement, and Elasticsearch lookup.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Scheduled in Queue</div>
              <div className="text-2xl font-extrabold text-indigo-400 mt-1">{scheduledEmails.length}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sent Delivered</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                {sentEmails.filter((e) => e.status === 'SENT').length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Delivery Failures</div>
              <div className="text-2xl font-extrabold text-rose-400 mt-1">
                {sentEmails.filter((e) => e.status === 'FAILED').length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Tabs Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-xl max-w-fit">
            <button
              onClick={() => {
                setActiveTab('scheduled');
                setSearchResults(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'scheduled' && searchResults === null
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Scheduled</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 font-mono">
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('sent');
                setSearchResults(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sent' && searchResults === null
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Sent Emails</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 font-mono">
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Elasticsearch Search Form */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search subject, body, lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-full sm:w-64 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
            {searchResults !== null && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-xl bg-slate-900 border border-slate-800"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Search status notification banner */}
        {searchResults !== null && (
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>
                Found <strong>{searchResults.length}</strong> matching emails in Elasticsearch index for &ldquo;{searchQuery}&rdquo;.
              </span>
            </div>
            <button onClick={handleClearSearch} className="underline text-indigo-300 hover:text-indigo-200">
              Return to tab view
            </button>
          </div>
        )}

        {/* Email Table */}
        <EmailTable
          emails={currentList}
          loading={loading}
          type={searchResults !== null ? 'sent' : activeTab}
          onComposeClick={() => setIsComposeOpen(true)}
        />
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={loadData}
        defaultSender={user?.email}
      />
    </div>
  );
}

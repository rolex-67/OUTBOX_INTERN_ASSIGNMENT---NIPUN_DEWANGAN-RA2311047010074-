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
  X,
} from 'lucide-react';
import { EmailTable } from '@/components/EmailTable';
import { ComposeView } from '@/components/ComposeView';
import { EmailDetailView } from '@/components/EmailDetailView';
import {
  fetchScheduledEmails,
  fetchSentEmails,
  clearSentEmailsApi,
  deleteEmailById,
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

  // Filter & Sort States
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'SENT' | 'FAILED'>('ALL');
  const [attachmentFilter, setAttachmentFilter] = useState<boolean>(false);
  const [starredFilter, setStarredFilter] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'RECIPIENT'>('NEWEST');
  const [refreshToast, setRefreshToast] = useState(false);

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

  async function handleRefresh() {
    await loadData();
    setRefreshToast(true);
    setTimeout(() => setRefreshToast(false), 2000);
  }

  function handleResetFilters() {
    setStatusFilter('ALL');
    setAttachmentFilter(false);
    setStarredFilter(false);
    setDateFilter('ALL');
    setSortBy('NEWEST');
  }

  async function handleDeleteSingleEmail(id?: string) {
    if (!id) return;
    if (!window.confirm('Are you sure you want to permanently delete this email?')) {
      return;
    }
    try {
      await deleteEmailById(id);
      setSelectedEmail(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete email');
    }
  }

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

  // Base email list
  const baseList =
    searchResults !== null
      ? searchResults
      : activeTab === 'scheduled'
      ? scheduledEmails
      : sentEmails;

  // Apply real-time client filtering and sorting
  let currentList = [...baseList];

  // 1. Status Filter
  if (statusFilter !== 'ALL') {
    currentList = currentList.filter((e) => e.status === statusFilter);
  }

  // 2. Attachment Filter
  if (attachmentFilter) {
    currentList = currentList.filter(
      (e) => Array.isArray(e.attachments) && e.attachments.length > 0
    );
  }

  // 3. Starred Filter
  if (starredFilter) {
    const starredMap =
      typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('reachinbox_starred') || '{}')
        : {};
    currentList = currentList.filter((e) => Boolean(starredMap[e.id || e.emailJobId || '']));
  }

  // 4. Date Filter
  if (dateFilter !== 'ALL') {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    currentList = currentList.filter((e) => {
      const dateStr = e.sentAt || e.scheduledAt;
      if (!dateStr) return false;
      const time = new Date(dateStr).getTime();
      if (dateFilter === 'TODAY') {
        return now - time <= oneDay;
      } else if (dateFilter === '7DAYS') {
        return now - time <= 7 * oneDay;
      } else if (dateFilter === '30DAYS') {
        return now - time <= 30 * oneDay;
      }
      return true;
    });
  }

  // 5. Sorting
  currentList.sort((a, b) => {
    if (sortBy === 'RECIPIENT') {
      return a.recipient.localeCompare(b.recipient);
    }
    const timeA = new Date(a.sentAt || a.scheduledAt || 0).getTime();
    const timeB = new Date(b.sentAt || b.scheduledAt || 0).getTime();
    if (sortBy === 'OLDEST') {
      return timeA - timeB;
    }
    return timeB - timeA;
  });

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (attachmentFilter ? 1 : 0) +
    (starredFilter ? 1 : 0) +
    (dateFilter !== 'ALL' ? 1 : 0) +
    (sortBy !== 'NEWEST' ? 1 : 0);

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
            onDelete={handleDeleteSingleEmail}
          />
        ) : (
          /* CASE 3: Normal Table / List View (Matches Figma Images 2 & 3) */
          <>
            {/* Header: Search Bar & Actions */}
            <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between gap-4 sticky top-0 bg-white z-20">
              {/* Search input pill */}
              <form onSubmit={handleSearch} className="flex-1 max-w-lg">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value.trim()) {
                        setSearchResults(null);
                      }
                    }}
                    placeholder="Search by subject, body, sender or recipient..."
                    className="w-full pl-10 pr-4 py-2 bg-[#F3F4F6] border-none rounded-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </form>

              {/* Right Action Icons */}
              <div className="flex items-center gap-2 relative">
                {/* FILTER BUTTON */}
                <button
                  type="button"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className={`p-2 rounded-full transition-colors relative flex items-center gap-1.5 ${
                    showFilterMenu || activeFilterCount > 0
                      ? 'bg-[#E6F4EA] text-[#00A854]'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Filter & Sort emails"
                >
                  <Filter className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#00A854] text-white text-[9px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* FILTER DROPDOWN MENU */}
                {showFilterMenu && (
                  <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-[#00A854]" />
                        <span className="font-bold text-gray-800 text-xs">Filter & Sort</span>
                      </div>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Reset All
                        </button>
                      )}
                    </div>

                    {/* Filter by Status */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['ALL', 'SCHEDULED', 'SENT', 'FAILED'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatusFilter(st)}
                            className={`px-2.5 py-1.5 rounded-lg border text-left font-medium transition-all ${
                              statusFilter === st
                                ? 'border-[#00A854] bg-[#E6F4EA] text-[#00A854]'
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {st === 'ALL' ? 'All Statuses' : st.charAt(0) + st.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter by Date Range */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Date Range
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { key: 'ALL', label: 'All Time' },
                          { key: 'TODAY', label: 'Today' },
                          { key: '7DAYS', label: 'Past 7 Days' },
                          { key: '30DAYS', label: 'Past 30 Days' },
                        ].map((range) => (
                          <button
                            key={range.key}
                            type="button"
                            onClick={() => setDateFilter(range.key as any)}
                            className={`px-2.5 py-1.5 rounded-lg border text-left font-medium transition-all ${
                              dateFilter === range.key
                                ? 'border-[#00A854] bg-[#E6F4EA] text-[#00A854]'
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {range.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Checkboxes: Attachments & Starred */}
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <span className="text-gray-700 font-medium">Has Attachments</span>
                        <input
                          type="checkbox"
                          checked={attachmentFilter}
                          onChange={(e) => setAttachmentFilter(e.target.checked)}
                          className="w-4 h-4 text-[#00A854] rounded focus:ring-[#00A854] accent-[#00A854]"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer py-1">
                        <span className="text-gray-700 font-medium">Starred Only</span>
                        <input
                          type="checkbox"
                          checked={starredFilter}
                          onChange={(e) => setStarredFilter(e.target.checked)}
                          className="w-4 h-4 text-[#00A854] rounded focus:ring-[#00A854] accent-[#00A854]"
                        />
                      </label>
                    </div>

                    {/* Sort Order */}
                    <div className="space-y-1.5 pt-1 border-t border-gray-100">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Sort By
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:border-[#00A854]"
                      >
                        <option value="NEWEST">Newest First</option>
                        <option value="OLDEST">Oldest First</option>
                        <option value="RECIPIENT">Recipient (A to Z)</option>
                      </select>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        {currentList.length} matching email(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFilterMenu(false)}
                        className="px-4 py-1.5 rounded-full bg-[#00A854] text-white hover:bg-[#009247] font-semibold text-xs transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* REFRESH BUTTON */}
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  title="Refresh emails from server"
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

            {/* Active Filters Bar (when any filter is on) */}
            {activeFilterCount > 0 && (
              <div className="px-6 py-2 bg-[#F9FAFB] border-b border-gray-100 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-gray-400 font-medium text-[11px]">Active Filters:</span>
                {statusFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 text-[11px]">
                    Status: {statusFilter}
                    <button type="button" onClick={() => setStatusFilter('ALL')} className="hover:text-red-500 font-bold ml-0.5">×</button>
                  </span>
                )}
                {dateFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 text-[11px]">
                    Date: {dateFilter}
                    <button type="button" onClick={() => setDateFilter('ALL')} className="hover:text-red-500 font-bold ml-0.5">×</button>
                  </span>
                )}
                {attachmentFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 text-[11px]">
                    With Attachments
                    <button type="button" onClick={() => setAttachmentFilter(false)} className="hover:text-red-500 font-bold ml-0.5">×</button>
                  </span>
                )}
                {starredFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 text-[11px]">
                    Starred Only
                    <button type="button" onClick={() => setStarredFilter(false)} className="hover:text-red-500 font-bold ml-0.5">×</button>
                  </span>
                )}
                {sortBy !== 'NEWEST' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 text-[11px]">
                    Sort: {sortBy}
                    <button type="button" onClick={() => setSortBy('NEWEST')} className="hover:text-red-500 font-bold ml-0.5">×</button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-[#00A854] hover:underline font-semibold ml-auto"
                >
                  Clear all
                </button>
              </div>
            )}

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

      {/* Refresh feedback toast */}
      {refreshToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-gray-900 text-white rounded-full text-xs shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dashboard updated</span>
        </div>
      )}

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

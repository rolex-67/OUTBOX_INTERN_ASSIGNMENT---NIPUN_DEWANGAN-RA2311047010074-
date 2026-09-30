'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { X, Upload, Send, Clock, Gauge, CheckCircle2, Trash2 } from 'lucide-react';
import { scheduleEmails, SchedulePayload } from '@/lib/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSender?: string;
}

export function ComposeModal({ isOpen, onClose, onSuccess, defaultSender }: ComposeModalProps) {
  const [sender, setSender] = useState(defaultSender || 'growth@reachinbox.ai');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipientInput, setManualRecipientInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetweenSends, setDelayBetweenSends] = useState(2); // seconds
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleClearFile() {
    setFileName(null);
    setRecipients([]);
    setError(null);
    // reset the hidden file input so the same file can be re-selected
    const input = document.getElementById('lead-file-upload') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  if (!isOpen) return null;

  function extractEmails(rawText: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = rawText.match(emailRegex) || [];
    return Array.from(new Set(matches.map((m) => m.toLowerCase())));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    Papa.parse(file, {
      complete: (results) => {
        const textContent = JSON.stringify(results.data);
        const parsedEmails = extractEmails(textContent);
        if (parsedEmails.length === 0) {
          setError('No valid email addresses found in file');
        } else {
          setRecipients(parsedEmails);
        }
      },
      error: () => {
        setError('Failed to parse uploaded file');
      },
    });
  }

  function handleAddManualEmails() {
    if (!manualRecipientInput.trim()) return;
    const found = extractEmails(manualRecipientInput);
    if (found.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...found])));
      setManualRecipientInput('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Auto-flush any email still typed in the manual input field
    let finalRecipients = [...recipients];
    if (manualRecipientInput.trim()) {
      const extra = extractEmails(manualRecipientInput);
      finalRecipients = Array.from(new Set([...finalRecipients, ...extra]));
      if (extra.length > 0) {
        setRecipients(finalRecipients);
        setManualRecipientInput('');
      }
    }

    if (finalRecipients.length === 0) {
      setError('Please add at least one recipient email');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and Email Body are required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: SchedulePayload = {
        sender: sender.trim(),
        recipients: finalRecipients,
        subject: subject.trim(),
        body: body.trim(),
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmailsMs: delayBetweenSends * 1000,
        hourlyLimit,
      };

      await scheduleEmails(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Schedule Email Outreach</h2>
            <p className="text-xs text-slate-400">Configure delays, rate limits, and leads for BullMQ queue.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Sender */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Sender Email</label>
            <input
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              required
              placeholder="e.g. founder@company.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Lead CSV/Text Upload */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-300">Recipient Leads (CSV or Text)</label>
              {recipients.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> {recipients.length} leads detected
                </span>
              )}
            </div>

            <div className="border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 text-center bg-slate-950/50 transition-colors relative">
              <input
                type="file"
                id="lead-file-upload"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              {fileName && (
                <button
                  type="button"
                  onClick={handleClearFile}
                  title="Remove file"
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-semibold transition-all"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
              <label htmlFor="lead-file-upload" className="cursor-pointer block">
                <Upload className="w-6 h-6 mx-auto mb-2 text-indigo-400" />
                <span className="text-slate-300 font-medium">Click to upload CSV or text file</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {fileName ? `Loaded: ${fileName}` : 'Auto-detects email columns and patterns'}
                </span>
              </label>
            </div>

            {/* Quick manual entry fallback */}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={manualRecipientInput}
                onChange={(e) => setManualRecipientInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddManualEmails(); } }}
                placeholder="Or paste comma/space separated emails"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-[11px]"
              />
              <button
                type="button"
                onClick={handleAddManualEmails}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="e.g. Quick question regarding cold outreach scaling"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Email Body</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              placeholder="Hi there, noticed ReachInbox is scaling fast..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Throttle & Scheduling Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Min Delay (Sec)
              </label>
              <input
                type="number"
                min="0"
                value={delayBetweenSends}
                onChange={(e) => setDelayBetweenSends(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Hourly Limit
              </label>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (recipients.length === 0 && !manualRecipientInput.trim())}
              className="inline-flex items-center gap-2 px-5 py-2 font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Scheduling Jobs...' : `Schedule ${recipients.length + (manualRecipientInput.trim() ? 1 : 0)} Email${recipients.length !== 1 ? 's' : ''}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

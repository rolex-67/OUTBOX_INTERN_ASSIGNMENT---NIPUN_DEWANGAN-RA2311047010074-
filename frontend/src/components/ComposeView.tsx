'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Calendar,
  Upload,
  X,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Strikethrough,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { scheduleEmails, SchedulePayload } from '@/lib/api';

interface ComposeViewProps {
  onBack: () => void;
  onSuccess: () => void;
  defaultSender?: string;
}

export function ComposeView({ onBack, onSuccess, defaultSender }: ComposeViewProps) {
  const [sender] = useState(defaultSender || 'oliver.brown@domain.io');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [inputEmail, setInputEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetweenSends, setDelayBetweenSends] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  // Send later popover state
  const [showSendLater, setShowSendLater] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [scheduledDisplay, setScheduledDisplay] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function extractEmails(rawText: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = rawText.match(emailRegex) || [];
    return Array.from(new Set(matches.map((m) => m.toLowerCase())));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    Papa.parse(file, {
      complete: (results) => {
        const textContent = JSON.stringify(results.data);
        const parsedEmails = extractEmails(textContent);
        if (parsedEmails.length === 0) {
          setError('No valid email addresses found in file');
        } else {
          setRecipients((prev) => Array.from(new Set([...prev, ...parsedEmails])));
        }
      },
      error: () => {
        setError('Failed to parse uploaded list file');
      },
    });
  }

  function handleAddRecipient() {
    if (!inputEmail.trim()) return;
    const found = extractEmails(inputEmail);
    if (found.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...found])));
      setInputEmail('');
    }
  }

  function handleRemoveRecipient(emailToRemove: string) {
    setRecipients((prev) => prev.filter((e) => e !== emailToRemove));
  }

  function setPresetTime(hoursToAdd: number, fixedHour?: number) {
    const d = new Date();
    if (fixedHour !== undefined) {
      d.setDate(d.getDate() + 1);
      d.setHours(fixedHour, 0, 0, 0);
    } else {
      d.setDate(d.getDate() + 1);
    }
    const iso = d.toISOString();
    setScheduledTime(iso);
    setScheduledDisplay(
      d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  }

  async function handleSend() {
    let finalRecipients = [...recipients];
    if (inputEmail.trim()) {
      const extra = extractEmails(inputEmail);
      finalRecipients = Array.from(new Set([...finalRecipients, ...extra]));
    }

    if (finalRecipients.length === 0) {
      setError('Please add at least one recipient email');
      return;
    }
    if (!subject.trim()) {
      setError('Please specify an email Subject');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: SchedulePayload = {
        sender,
        recipients: finalRecipients,
        subject: subject.trim(),
        body: body.trim() || 'Hi there, following up on our previous conversation.',
        startTime: scheduledTime || undefined,
        delayBetweenEmailsMs: delayBetweenSends * 1000,
        hourlyLimit,
      };

      await scheduleEmails(payload);
      onSuccess();
      onBack();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full bg-white flex flex-col min-h-screen relative">
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-gray-100 px-6 sm:px-10 flex items-center justify-between bg-white sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-gray-900">
            Compose New Email
          </h1>
        </div>

        {/* Right Action Icons & Send Later button */}
        <div className="flex items-center gap-4 relative">
          <button
            className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
            title="Attach files"
          >
            <Paperclip className="w-4 h-4 text-emerald-600" />
            <span className="absolute -top-1 -right-1 text-[10px] text-gray-500 font-medium">
              1
            </span>
          </button>

          <button
            onClick={() => setShowSendLater((prev) => !prev)}
            className={`p-2 rounded-full transition-colors ${
              showSendLater || scheduledTime
                ? 'bg-emerald-50 text-[#00A854]'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="Schedule email send"
          >
            <Clock className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            onClick={handleSend}
            disabled={submitting}
            className="px-5 py-1.5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA] active:scale-[0.98] text-xs font-semibold transition-all disabled:opacity-50"
          >
            {submitting
              ? 'Scheduling...'
              : scheduledTime
              ? 'Send Later'
              : 'Send'}
          </button>

          {/* Send Later Popover Modal (matches Image 5) */}
          {showSendLater && (
            <div className="absolute right-0 top-12 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl p-5 z-50 text-xs">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-gray-900 text-sm">Send Later</span>
                <button
                  onClick={() => setShowSendLater(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Date & Time Input */}
              <div className="mb-4">
                <label className="block text-[11px] text-gray-400 mb-1">
                  Pick date &amp; time
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={scheduledTime ? scheduledTime.slice(0, 16) : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const d = new Date(e.target.value);
                        setScheduledTime(d.toISOString());
                        setScheduledDisplay(
                          d.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        );
                      } else {
                        setScheduledTime('');
                        setScheduledDisplay('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#00A854]"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 mb-5">
                <button
                  type="button"
                  onClick={() => setPresetTime(24)}
                  className="w-full text-left py-1 px-2 rounded-lg hover:bg-gray-100 text-gray-700 text-xs transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(24, 10)}
                  className="w-full text-left py-1 px-2 rounded-lg hover:bg-gray-100 text-gray-700 text-xs transition-colors"
                >
                  Tomorrow, 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(24, 11)}
                  className="w-full text-left py-1 px-2 rounded-lg hover:bg-gray-100 text-gray-700 text-xs transition-colors"
                >
                  Tomorrow, 11:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(24, 15)}
                  className="w-full text-left py-1 px-2 rounded-lg hover:bg-gray-100 text-gray-700 text-xs transition-colors"
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setScheduledTime('');
                    setScheduledDisplay('');
                    setShowSendLater(false);
                  }}
                  className="text-gray-500 hover:text-gray-800 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendLater(false)}
                  className="px-4 py-1.5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA] font-semibold text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 sm:mx-10 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Main Email Form Area */}
      <div className="flex-1 max-w-5xl w-full px-6 sm:px-10 py-6 space-y-4">
        {/* FROM Field */}
        <div className="flex items-center gap-4 py-2 border-b border-gray-100">
          <span className="w-16 text-xs text-gray-400 font-normal">From</span>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-gray-100 text-gray-800 text-xs font-normal">
            <span>{sender}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>

        {/* TO Field with Recipient Chips & Upload List Action */}
        <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <span className="w-16 text-xs text-gray-400 font-normal">To</span>

            {/* Recipient Pills (matches Figma Images 6 & 7) */}
            {recipients.map((rec, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00A854] bg-[#E6F4EA]/40 text-[#00A854] text-xs font-normal"
              >
                <span>{rec}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(rec)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <input
              type="email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddRecipient();
                }
              }}
              placeholder={recipients.length === 0 ? 'recipient@example.com' : 'Add another...'}
              className="flex-1 min-w-[200px] text-xs text-gray-800 placeholder-gray-400 border-none focus:outline-none bg-transparent"
            />
          </div>

          {/* Upload List Action (Matches Image 6 & 7) */}
          <div className="shrink-0 flex items-center">
            <input
              type="file"
              id="upload-leads-list"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="upload-leads-list"
              className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-[#00A854] hover:text-[#009247] transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#00A854]" />
              <span>Upload List</span>
            </label>
          </div>
        </div>

        {/* SUBJECT Field */}
        <div className="flex items-center gap-4 py-2 border-b border-gray-100">
          <span className="w-16 text-xs text-gray-400 font-normal">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-xs text-gray-800 placeholder-gray-400 border-none focus:outline-none bg-transparent"
          />
        </div>

        {/* THROTTLE / RATE LIMITING Field */}
        <div className="flex items-center gap-6 py-2 border-b border-gray-100 flex-wrap text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span className="text-gray-400">Delay between 2 emails</span>
            <input
              type="number"
              min="0"
              value={delayBetweenSends}
              onChange={(e) => setDelayBetweenSends(Number(e.target.value))}
              placeholder="00"
              className="w-14 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-400">Hourly Limit</span>
            <input
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              placeholder="00"
              className="w-14 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>

          {scheduledDisplay && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Scheduled: {scheduledDisplay}</span>
            </div>
          )}
        </div>

        {/* RICH TEXT EDITOR CARD (Matches Image 5 & 6) */}
        <div className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-4 space-y-3 min-h-[360px] flex flex-col shadow-sm">
          {/* Editor Toolbar */}
          <div className="flex items-center gap-1 sm:gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200/80 text-gray-600 text-xs shadow-sm overflow-x-auto">
            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <Redo className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            <button type="button" className="px-1.5 py-0.5 hover:text-gray-900 font-semibold rounded">
              TT
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            <button type="button" className="p-1 hover:text-gray-900 rounded font-bold">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded italic">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded underline">
              <Underline className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <List className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 hover:text-gray-900 rounded">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Text Area */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            rows={12}
            className="flex-1 w-full bg-transparent border-none text-xs text-gray-800 placeholder-gray-400 focus:outline-none resize-none leading-relaxed p-1"
          />
        </div>
      </div>
    </div>
  );
}

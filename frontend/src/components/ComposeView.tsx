'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  X,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Strikethrough,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { scheduleEmails, SchedulePayload, EmailAttachment } from '@/lib/api';

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

  // Rich Text Editor ref and active formatting state
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: 'left' as 'left' | 'center' | 'right',
    heading: false,
    quote: false,
    listOrdered: false,
    listUnordered: false,
  });

  function checkActiveStyles() {
    if (typeof document === 'undefined') return;
    try {
      setActiveStyles({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        align: document.queryCommandState('justifyCenter')
          ? 'center'
          : document.queryCommandState('justifyRight')
          ? 'right'
          : 'left',
        heading: document.queryCommandValue('formatBlock') === 'h3',
        quote: document.queryCommandValue('formatBlock') === 'blockquote',
        listOrdered: document.queryCommandState('insertOrderedList'),
        listUnordered: document.queryCommandState('insertUnorderedList'),
      });
    } catch {}
  }

  function handleEditorInput() {
    if (!editorRef.current) return;
    setBody(editorRef.current.innerHTML);
    checkActiveStyles();
  }

  function execCmd(command: string, value: string | undefined = undefined) {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleEditorInput();
  }

  function toggleHeading() {
    if (editorRef.current) editorRef.current.focus();
    const current = document.queryCommandValue('formatBlock');
    if (current === 'h3') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, '<h3>');
    }
    handleEditorInput();
  }

  function toggleQuote() {
    if (editorRef.current) editorRef.current.focus();
    const current = document.queryCommandValue('formatBlock');
    if (current === 'blockquote') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, '<blockquote>');
    }
    handleEditorInput();
  }

  function cycleAlign() {
    if (editorRef.current) editorRef.current.focus();
    if (activeStyles.align === 'left') {
      document.execCommand('justifyCenter');
    } else if (activeStyles.align === 'center') {
      document.execCommand('justifyRight');
    } else {
      document.execCommand('justifyLeft');
    }
    handleEditorInput();
  }

  function handleInsertLink() {
    if (editorRef.current) editorRef.current.focus();
    const url = window.prompt('Enter web address / URL (e.g. https://reachinbox.ai):', 'https://');
    if (url && url.trim() && url !== 'https://') {
      document.execCommand('createLink', false, url.trim());
      handleEditorInput();
    }
  }

  // Attachments state
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

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

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            data: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }

  function handleRemoveAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function formatBytes(bytes?: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

    const htmlContent = editorRef.current?.innerHTML.trim() || body.trim();
    const plainText = editorRef.current?.innerText.trim() || body.trim();

    if (!plainText && (!htmlContent || htmlContent === '<br>')) {
      setError('Please write an email message body');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: SchedulePayload = {
        sender,
        recipients: finalRecipients,
        subject: subject.trim(),
        body: htmlContent || 'Hi there, following up on our previous conversation.',
        attachments: attachments.length > 0 ? attachments : undefined,
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
      {/* Hidden file input for attachments */}
      <input
        type="file"
        id="compose-file-attachments"
        multiple
        onChange={handleFileAttach}
        className="hidden"
      />

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
          {/* Functional Attachment Button */}
          <button
            type="button"
            onClick={() => document.getElementById('compose-file-attachments')?.click()}
            className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Attach files"
          >
            <Paperclip className="w-4 h-4 text-emerald-600" />
            {attachments.length > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] text-white bg-[#00A854] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {attachments.length}
              </span>
            )}
          </button>

          {/* Schedule Clock Button */}
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

        {/* Real Attached Files Section */}
        {attachments.length > 0 && (
          <div className="p-3 bg-gray-50/80 border border-gray-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold flex items-center gap-1.5 text-gray-800">
                <Paperclip className="w-3.5 h-3.5 text-[#00A854]" />
                <span>Attached Files ({attachments.length})</span>
              </span>
              <button
                type="button"
                onClick={() => document.getElementById('compose-file-attachments')?.click()}
                className="text-[11px] text-[#00A854] hover:underline"
              >
                + Add more
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium truncate max-w-[180px]">{file.name}</span>
                  <span className="text-[10px] text-gray-400">({formatBytes(file.size)})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RICH TEXT EDITOR CARD (Matches Image 5 & 6) */}
        <div className="rounded-2xl border border-gray-100 bg-[#F9FAFB] p-4 space-y-3 min-h-[360px] flex flex-col shadow-sm relative">
          {/* Editor Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-3 py-2 bg-white rounded-xl border border-gray-200/80 text-gray-600 text-xs shadow-sm overflow-x-auto select-none">
            {/* Undo */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('undo')}
              className="p-1.5 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            {/* Redo */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('redo')}
              className="p-1.5 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            {/* Typography / Heading Toggle */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHeading}
              className={`px-2 py-1 rounded font-bold text-xs transition-colors ${
                activeStyles.heading
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Heading (Title Style)"
            >
              TT
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            {/* Bold */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('bold')}
              className={`p-1.5 rounded transition-colors font-bold ${
                activeStyles.bold
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            {/* Italic */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('italic')}
              className={`p-1.5 rounded transition-colors italic ${
                activeStyles.italic
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            {/* Underline */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('underline')}
              className={`p-1.5 rounded transition-colors underline ${
                activeStyles.underline
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Underline (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            {/* Alignment Cycle */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cycleAlign}
              className="p-1.5 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex items-center gap-1"
              title={`Text Alignment (${activeStyles.align})`}
            >
              {activeStyles.align === 'center' ? (
                <AlignCenter className="w-3.5 h-3.5 text-[#00A854]" />
              ) : activeStyles.align === 'right' ? (
                <AlignRight className="w-3.5 h-3.5 text-[#00A854]" />
              ) : (
                <AlignLeft className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Numbered List */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertOrderedList')}
              className={`p-1.5 rounded transition-colors ${
                activeStyles.listOrdered
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            {/* Bullet List */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('insertUnorderedList')}
              className={`p-1.5 rounded transition-colors ${
                activeStyles.listUnordered
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            {/* Blockquote */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleQuote}
              className={`p-1.5 rounded transition-colors ${
                activeStyles.quote
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>

            {/* Insert Link */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsertLink}
              className="p-1.5 hover:text-[#00A854] hover:bg-gray-100 rounded transition-colors"
              title="Insert Link"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>

            {/* Strikethrough */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execCmd('strikeThrough')}
              className={`p-1.5 rounded transition-colors ${
                activeStyles.strike
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <span className="h-4 w-px bg-gray-200 mx-1"></span>

            {/* Attach files action */}
            <button
              type="button"
              onClick={() => document.getElementById('compose-file-attachments')?.click()}
              className="p-1.5 hover:text-[#00A854] hover:bg-[#E6F4EA]/50 rounded flex items-center gap-1.5 text-[11px] text-gray-600 transition-colors"
              title="Attach files"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#00A854]" />
              <span className="font-medium">Attach</span>
            </button>
          </div>

          {/* Rich Contenteditable Editor */}
          <div className="relative flex-1 flex flex-col min-h-[220px]">
            {(!body || body === '<br>' || body.trim() === '') && (
              <span className="absolute left-2 top-2 text-xs text-gray-400 pointer-events-none select-none">
                Type Your Reply...
              </span>
            )}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              onKeyUp={checkActiveStyles}
              onMouseUp={checkActiveStyles}
              className="flex-1 w-full bg-transparent border-none text-xs text-gray-800 focus:outline-none min-h-[220px] leading-relaxed p-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#00A854] [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:bg-gray-50 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#00A854] [&_a]:underline [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

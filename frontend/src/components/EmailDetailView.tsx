'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Archive, Trash2, ChevronDown, ChevronUp, Paperclip, FileText, Download, CheckCircle, Info } from 'lucide-react';
import { EmailItem } from '@/lib/api';

interface EmailDetailViewProps {
  email: EmailItem;
  onBack: () => void;
  onDelete?: (id?: string) => void;
}

export function EmailDetailView({ email, onBack, onDelete }: EmailDetailViewProps) {
  const emailId = email.id || email.emailJobId || '';
  const [isStarred, setIsStarred] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!emailId || typeof window === 'undefined') return;
    try {
      const starredMap = JSON.parse(localStorage.getItem('reachinbox_starred') || '{}');
      setIsStarred(Boolean(starredMap[emailId]));

      const archivedMap = JSON.parse(localStorage.getItem('reachinbox_archived') || '{}');
      setIsArchived(Boolean(archivedMap[emailId]));
    } catch {}
  }, [emailId]);

  function handleToggleStar() {
    if (!emailId) return;
    const nextVal = !isStarred;
    setIsStarred(nextVal);
    try {
      const starredMap = JSON.parse(localStorage.getItem('reachinbox_starred') || '{}');
      if (nextVal) {
        starredMap[emailId] = true;
      } else {
        delete starredMap[emailId];
      }
      localStorage.setItem('reachinbox_starred', JSON.stringify(starredMap));
      setStatusMessage(nextVal ? 'Email added to starred' : 'Email unstarred');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch {}
  }

  function handleToggleArchive() {
    if (!emailId) return;
    const nextVal = !isArchived;
    setIsArchived(nextVal);
    try {
      const archivedMap = JSON.parse(localStorage.getItem('reachinbox_archived') || '{}');
      if (nextVal) {
        archivedMap[emailId] = true;
      } else {
        delete archivedMap[emailId];
      }
      localStorage.setItem('reachinbox_archived', JSON.stringify(archivedMap));
      setStatusMessage(nextVal ? 'Email moved to Archive' : 'Email restored from Archive');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch {}
  }

  function formatFullDate(isoString?: string | null) {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  }

  function formatBytes(bytes?: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const senderInitial = (email.sender || 'U').charAt(0).toUpperCase();
  const attachments = Array.isArray(email.attachments) ? email.attachments : [];

  return (
    <div className="w-full bg-white flex flex-col min-h-screen">
      {/* Top Header Bar */}
      <div className="h-16 border-b border-gray-100 px-6 sm:px-10 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {email.subject || 'No Subject'}
            </h1>
            {isArchived && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                Archived
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 text-gray-500">
          {/* Star toggle */}
          <button
            type="button"
            onClick={handleToggleStar}
            className={`p-2 rounded-full transition-colors ${
              isStarred
                ? 'text-amber-400 bg-amber-50 hover:bg-amber-100'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={isStarred ? 'Unstar' : 'Star this email'}
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          {/* Archive toggle */}
          <button
            type="button"
            onClick={handleToggleArchive}
            className={`p-2 rounded-full transition-colors ${
              isArchived
                ? 'text-[#00A854] bg-[#E6F4EA] hover:bg-[#E6F4EA]/80'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={isArchived ? 'Unarchive' : 'Archive email'}
          >
            <Archive className="w-4 h-4" />
          </button>

          {/* Delete Action */}
          {onDelete && (
            <button
              onClick={() => onDelete(email.id || email.emailJobId)}
              className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-600 transition-colors"
              title="Delete email"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="mx-6 sm:mx-10 mt-3 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Email Body Content Area */}
      <div className="flex-1 max-w-4xl px-6 sm:px-10 py-8 space-y-6">
        {/* Sender details */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#00A854] text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
              {senderInitial}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">
                  {email.sender.split('@')[0]}
                </span>
                <span className="text-xs text-gray-500 font-normal">
                  &lt;{email.sender}&gt;
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mt-0.5 text-left"
              >
                <span>to {email.recipient}</span>
                {showDetails ? (
                  <ChevronUp className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-400 font-normal whitespace-nowrap">
            {formatFullDate(email.sentAt || email.scheduledAt)}
          </div>
        </div>

        {/* Detailed headers drawer if expanded */}
        {showDetails && (
          <div className="p-3 bg-gray-50/90 border border-gray-200 rounded-xl text-xs space-y-1.5 text-gray-600">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#00A854]" /> Email Details
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                email.status === 'SENT'
                  ? 'bg-emerald-100 text-emerald-700'
                  : email.status === 'SCHEDULED'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {email.status}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
              <div><span className="text-gray-400">From:</span> {email.sender}</div>
              <div><span className="text-gray-400">To:</span> {email.recipient}</div>
              <div><span className="text-gray-400">Scheduled At:</span> {formatFullDate(email.scheduledAt)}</div>
              {email.sentAt && <div><span className="text-gray-400">Dispatched At:</span> {formatFullDate(email.sentAt)}</div>}
              {email.id && <div className="sm:col-span-2 truncate"><span className="text-gray-400">Job ID:</span> {email.id}</div>}
              {email.error && <div className="sm:col-span-2 text-red-600"><span className="font-semibold">Error:</span> {email.error}</div>}
            </div>
          </div>
        )}

        {/* Real Message Body with HTML styling support */}
        <div className="text-sm text-gray-800 leading-relaxed space-y-4 pt-4 border-t border-gray-100">
          <div
            className="prose prose-sm max-w-none text-gray-800 [&_blockquote]:border-l-4 [&_blockquote]:border-[#00A854] [&_blockquote]:pl-4 [&_blockquote]:py-1.5 [&_blockquote]:my-3 [&_blockquote]:bg-gray-50/80 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#00A854] [&_a]:underline [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900"
            dangerouslySetInnerHTML={{
              __html: email.body.includes('<')
                ? email.body
                : email.body.replace(/\n/g, '<br/>'),
            }}
          />
        </div>

        {/* Real Uploaded Attachments Section (Rendered ONLY if user actually attached files) */}
        {attachments.length > 0 && (
          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-3">
              <Paperclip className="w-3.5 h-3.5 text-[#00A854]" />
              <span>
                {attachments.length} {attachments.length === 1 ? 'Attachment' : 'Attachments'}
              </span>
            </div>

            <div className="flex flex-wrap gap-4">
              {attachments.map((file, i) => {
                const isImage = file.type?.startsWith('image/') && file.data;
                return (
                  <div
                    key={i}
                    className="w-48 border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:border-gray-300 transition-colors"
                  >
                    {isImage ? (
                      <div className="h-28 bg-gray-50 overflow-hidden relative border-b border-gray-100">
                        <img
                          src={file.data}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-20 bg-gray-50 flex items-center justify-center text-gray-400 border-b border-gray-100">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-xs font-medium text-gray-800 truncate" title={file.name}>
                        {file.name}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                        <span>{formatBytes(file.size)}</span>
                        {file.data && (
                          <a
                            href={file.data}
                            download={file.name}
                            className="text-[#00A854] hover:underline flex items-center gap-0.5"
                          >
                            <Download className="w-2.5 h-2.5" /> Download
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

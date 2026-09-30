'use client';

import { ArrowLeft, Star, Archive, Trash2, ChevronDown, Paperclip, FileText, Download } from 'lucide-react';
import { EmailItem } from '@/lib/api';

interface EmailDetailViewProps {
  email: EmailItem;
  onBack: () => void;
  onDelete?: (id?: string) => void;
}

export function EmailDetailView({ email, onBack, onDelete }: EmailDetailViewProps) {
  function formatFullDate(isoString?: string | null) {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
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
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            {email.subject || 'No Subject'}
          </h1>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 text-gray-500">
          <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors">
            <Archive className="w-4 h-4" />
          </button>
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
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <span>to {email.recipient}</span>
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 font-normal whitespace-nowrap">
            {formatFullDate(email.sentAt || email.scheduledAt)}
          </div>
        </div>

        {/* Real Message Body Only (No hardcoded templates) */}
        <div className="text-sm text-gray-800 leading-relaxed space-y-4 pt-4 border-t border-gray-100">
          <p className="whitespace-pre-line">{email.body}</p>
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

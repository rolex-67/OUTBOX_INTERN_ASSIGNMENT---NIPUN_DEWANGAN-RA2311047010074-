'use client';

import { useState, useEffect } from 'react';
import { Clock, Star, Mail, Paperclip } from 'lucide-react';
import { EmailItem } from '@/lib/api';

interface EmailTableProps {
  emails: EmailItem[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  onSelectEmail: (email: EmailItem) => void;
  onComposeClick?: () => void;
}

export function EmailTable({
  emails,
  loading,
  type,
  onSelectEmail,
  onComposeClick,
}: EmailTableProps) {
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem('reachinbox_starred') || '{}');
      setStarred(stored);
    } catch {}
  }, []);

  function toggleStar(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setStarred((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      if (!updated[id]) {
        delete updated[id];
      }
      try {
        localStorage.setItem('reachinbox_starred', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  function formatScheduledBadge(isoString?: string | null) {
    if (!isoString) return 'Pending';
    try {
      const d = new Date(isoString);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const timeStr = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return `${dayName} ${timeStr}`;
    } catch {
      return isoString;
    }
  }

  if (loading) {
    return (
      <div className="w-full bg-white divide-y divide-gray-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-4 bg-gray-200 rounded w-36"></div>
              <div className="h-5 bg-gray-100 rounded-full w-28"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-full py-20 px-6 text-center bg-white">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#E6F4EA] flex items-center justify-center text-[#00A854]">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">
          {type === 'scheduled' ? 'No scheduled emails in queue' : 'No sent emails yet'}
        </h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
          {type === 'scheduled'
            ? 'Scheduled outreach batches will appear here with execution timestamps.'
            : 'Emails dispatched by the BullMQ worker via SMTP will appear here.'}
        </p>
        {onComposeClick && (
          <button
            onClick={onComposeClick}
            className="px-4 py-1.5 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#E6F4EA] text-xs font-semibold transition-all"
          >
            Compose New Email
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white divide-y divide-gray-100">
      {emails.map((email, idx) => {
        const itemKey = email.id || email.emailJobId || String(idx);
        const isStarred = starred[itemKey] || false;
        const recipientName = email.recipient.split('@')[0]
          .split('.')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');

        return (
          <div
            key={itemKey}
            onClick={() => onSelectEmail(email)}
            className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors group"
          >
            {/* Left & Middle content */}
            <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
              {/* Recipient */}
              <div className="w-44 shrink-0 text-xs font-semibold text-gray-900 truncate">
                To: {recipientName || email.recipient}
              </div>

              {/* Status / Scheduled Time Badge */}
              <div className="shrink-0">
                {type === 'scheduled' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF7ED] border border-[#FFEDD5] text-[#EA580C] text-[11px] font-medium whitespace-nowrap">
                    <Clock className="w-3 h-3 text-[#EA580C]" />
                    <span>{formatScheduledBadge(email.scheduledAt)}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium whitespace-nowrap">
                    Sent
                  </span>
                )}
              </div>

              {/* Subject & Preview Snippet */}
              <div className="text-xs text-gray-800 truncate flex-1 min-w-0 flex items-center gap-1.5">
                {email.attachments && email.attachments.length > 0 && (
                  <span title={`${email.attachments.length} attachment(s)`}>
                    <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </span>
                )}
                <span className="font-semibold text-gray-900 truncate">{email.subject || 'No Subject'}</span>
                {email.body && (
                  <span className="text-gray-400 font-normal truncate">
                    - {email.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Star Action */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={(e) => toggleStar(e, itemKey)}
                className={`p-1 rounded hover:bg-gray-200/50 transition-colors ${
                  isStarred ? 'text-amber-400' : 'text-gray-300 hover:text-gray-500'
                }`}
                title={isStarred ? 'Unstar' : 'Star'}
              >
                <Star className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

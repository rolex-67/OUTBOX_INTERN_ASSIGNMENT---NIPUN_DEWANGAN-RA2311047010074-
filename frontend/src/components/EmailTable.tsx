'use client';

import { Clock, CheckCircle2, AlertCircle, Mail, Calendar } from 'lucide-react';
import { EmailItem } from '@/lib/api';

interface EmailTableProps {
  emails: EmailItem[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  onComposeClick?: () => void;
}

export function EmailTable({ emails, loading, type, onComposeClick }: EmailTableProps) {
  if (loading) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm p-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-slate-800/40 rounded-xl">
              <div className="space-y-2 flex-1 max-w-sm">
                <div className="h-4 bg-slate-700/60 rounded w-3/4"></div>
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
              </div>
              <div className="h-4 bg-slate-700/60 rounded w-24"></div>
              <div className="h-6 bg-slate-700/60 rounded-full w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center backdrop-blur-sm">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Mail className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">
          {type === 'scheduled' ? 'No scheduled emails in queue' : 'No sent emails yet'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
          {type === 'scheduled'
            ? 'Schedule your first batch of outreach emails using BullMQ delayed jobs.'
            : 'Emails processed by the BullMQ worker via Ethereal SMTP will appear here.'}
        </p>
        {onComposeClick && (
          <button
            onClick={onComposeClick}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20"
          >
            Schedule New Outreach
          </button>
        )}
      </div>
    );
  }

  function formatDate(isoString?: string | null) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6">Recipient</th>
              <th className="py-3.5 px-4 sm:px-6">Subject</th>
              <th className="py-3.5 px-4 sm:px-6">
                {type === 'scheduled' ? 'Scheduled For' : 'Dispatched At'}
              </th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {emails.map((email, idx) => {
              const key = email.id || email.emailJobId || idx;
              return (
                <tr key={key} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4 sm:px-6 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-mono text-[11px]">
                        @
                      </div>
                      <div>
                        <div className="text-slate-100 font-medium">{email.recipient}</div>
                        <div className="text-[10px] text-slate-500 font-mono">From: {email.sender}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4 sm:px-6 max-w-xs sm:max-w-md">
                    <div className="text-slate-200 font-medium truncate">{email.subject}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{email.body}</div>
                  </td>

                  <td className="py-4 px-4 sm:px-6 text-slate-400 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(type === 'scheduled' ? email.scheduledAt : email.sentAt)}</span>
                    </div>
                  </td>

                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    {email.status === 'SCHEDULED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                        <Clock className="w-3 h-3 text-indigo-400 animate-pulse" />
                        <span>Scheduled</span>
                      </span>
                    )}
                    {email.status === 'SENT' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Delivered</span>
                      </span>
                    )}
                    {email.status === 'FAILED' && (
                      <span
                        title={email.error || 'Job failed'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300"
                      >
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

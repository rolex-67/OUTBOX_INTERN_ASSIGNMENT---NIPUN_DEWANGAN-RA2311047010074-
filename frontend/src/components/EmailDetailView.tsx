'use client';

import { ArrowLeft, Star, Archive, Trash2, ChevronDown, Paperclip, Image as ImageIcon } from 'lucide-react';
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

  const senderInitial = (email.sender || 'U').charAt(0).toUpperCase();

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
          <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden ml-1">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
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

        {/* Message Body */}
        <div className="text-sm text-gray-800 leading-relaxed space-y-4 pt-4 border-t border-gray-100">
          <p className="whitespace-pre-line">{email.body}</p>

          {/* Yellow Callout Quote Box (matches Image 4) */}
          <div className="border-l-4 border-amber-400 bg-amber-50/60 p-4 rounded-r-xl space-y-1.5 my-6 text-xs text-gray-800">
            <div className="font-semibold text-amber-900 flex items-center gap-1.5">
              <span>⚡</span> Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment <span>⚡</span>
            </div>
            <div className="text-gray-700">
              To explore securing your private transformation, simply reply right now with <strong className="text-gray-900">&quot;FLY OUT FIX&quot;</strong>.
            </div>
          </div>

          <p className="text-xs text-gray-500 italic pt-2">
            P.S. Always remember that you can develop world class technique! 🚀
          </p>
        </div>

        {/* Sample Attachment Previews (matches Image 4) */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-3">
            <Paperclip className="w-3.5 h-3.5" />
            <span>2 Attachments</span>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="w-48 border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:border-gray-300 transition-colors cursor-pointer">
              <div className="h-24 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white relative">
                <img
                  src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=80"
                  alt="Tennis Coach Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2.5">
                <div className="text-xs font-medium text-gray-800 truncate">Tennis_Coach_Profile.png</div>
                <div className="text-[10px] text-gray-400 mt-0.5">1.2 MB</div>
              </div>
            </div>

            <div className="w-48 border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:border-gray-300 transition-colors cursor-pointer">
              <div className="h-24 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white relative">
                <img
                  src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&auto=format&fit=crop&q=80"
                  alt="Tennis Coach Profile 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2.5">
                <div className="text-xs font-medium text-gray-800 truncate">Tennis_Coach_Profile2.png</div>
                <div className="text-[10px] text-gray-400 mt-0.5">1.2 MB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

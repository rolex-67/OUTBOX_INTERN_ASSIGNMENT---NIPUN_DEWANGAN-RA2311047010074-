import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReachInbox Email Scheduler',
  description: 'Production-grade distributed email scheduler dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased selection:bg-[#E6F4EA] selection:text-[#00A854]">
        {children}
      </body>
    </html>
  );
}

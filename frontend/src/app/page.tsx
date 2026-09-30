'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { directLoginApi, googleLoginApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  function parseJwt(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  async function handleDirectLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const targetEmail = email.trim() || 'oliver.brown@domain.io';
    const targetName = targetEmail.split('@')[0]
      .split('.')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ') || 'Oliver Brown';

    setLoading(true);
    setError(null);
    try {
      const data = await directLoginApi({
        email: targetEmail,
        name: targetName,
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80`,
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError('Google sign-in did not return valid credentials');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = parseJwt(credentialResponse.credential);
      const googleEmail = payload?.email || 'oliver.brown@domain.io';
      const googleName = payload?.name || 'Oliver Brown';
      const googleAvatar =
        payload?.picture ||
        `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80`;

      const data = await googleLoginApi({
        email: googleEmail,
        name: googleName,
        avatar: googleAvatar,
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-white px-4 py-12">
      {/* Centered Figma Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-gray-200/90 rounded-2xl p-8 sm:p-10 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6">
          Login
        </h1>

        {error && (
          <div className="mb-4 p-3 text-xs bg-red-50 border border-red-200 text-red-600 rounded-xl text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Google Login Button (Figma mint style) */}
          {googleClientId ? (
            <div className="w-full">
              <GoogleOAuthProvider clientId={googleClientId}>
                <div className="w-full flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() =>
                      setError('Google Sign-In failed. You can sign in using email below.')
                    }
                    theme="outline"
                    shape="pill"
                    size="large"
                    width="340"
                    text="continue_with"
                  />
                </div>
              </GoogleOAuthProvider>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleDirectLogin()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#EBF5F0] hover:bg-[#e0efe7] text-gray-700 font-medium text-sm rounded-xl transition-colors border border-transparent shadow-none"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Login with Google</span>
            </button>
          )}

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-3 text-gray-400 text-xs font-normal">
              or sign up through email
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleDirectLogin} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email ID"
                className="w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A854]/30 transition-all"
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 bg-[#F3F4F6] border-none rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00A854]/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#00A854] hover:bg-[#009247] active:scale-[0.99] text-white font-medium text-sm rounded-xl transition-all shadow-sm disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center space-y-1">
        <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
          MADE BY NIPUN DEWANGAN
        </p>
        <p className="text-[11px] font-mono font-medium text-[#00A854] tracking-wider">
          RA2311047010074
        </p>
        <p className="text-[11px] text-gray-400">
          ReachInbox Hiring Assignment • Full-stack Email Job Scheduler
        </p>
      </div>
    </div>
  );
}

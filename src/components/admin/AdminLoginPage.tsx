import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { adminFetch, saveAdminSessionToken } from '../../lib/adminAuthClient';
import type { AdminUser } from '../../types';

interface AdminLoginPageProps {
  onSuccess: (admin: AdminUser) => void;
}

export function AdminLoginPage({ onSuccess }: AdminLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        saveAdminSessionToken(null);
        setLoginError(data.error || 'Username atau password admin tidak valid.');
        return;
      }

      if (typeof data.sessionToken === 'string') {
        saveAdminSessionToken(data.sessionToken);
      }

      // Verify active session from backend before entering /admin/dashboard
      const meRes = await adminFetch('/api/admin/me');
      const meData = await meRes.json();
      if (!meRes.ok || !meData.authenticated || !meData.admin) {
        saveAdminSessionToken(null);
        setLoginError('Sesi admin gagal diverifikasi server. Silakan coba login ulang.');
        return;
      }

      setPassword('');
      onSuccess(meData.admin as AdminUser);
    } catch {
      saveAdminSessionToken(null);
      setLoginError('Gagal terhubung ke server autentikasi. Coba beberapa saat lagi.');
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-[#F4F9FF] to-white flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Top Brand Logo */}
      <div className="flex items-center gap-3 mb-6">
        <span className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
          <svg viewBox="0 0 36 36" className="w-7 h-7" aria-hidden="true">
            <rect x="6" y="5" width="24" height="26" rx="4" fill="#FFFFFF" />
            <circle cx="18" cy="20" r="6.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2" />
            <circle cx="18" cy="20" r="2.8" fill="#38BDF8" />
            <circle cx="12" cy="10" r="1.4" fill="#0284C7" />
            <circle cx="16.5" cy="10" r="1.4" fill="#FACC15" />
          </svg>
        </span>
        <div>
          <p className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-[#0F2744]">
            HUZAVIN LAUNDRY
          </p>
          <p className="text-xs font-semibold text-sky-700">Portal Administrasi Resmi</p>
        </div>
      </div>

      {/* Centered Login Card */}
      <div className="w-full max-w-md rounded-3xl bg-white border border-sky-200/80 p-6 sm:p-8 shadow-xl shadow-sky-900/5">
        {/* Cute Small Washing Machine Illustration */}
        <div className="flex items-center gap-4 mb-6 p-3.5 rounded-2xl bg-[#F4F9FF] border border-sky-100">
          <svg viewBox="0 0 88 88" className="w-16 h-16 shrink-0" aria-hidden="true">
            <rect x="14" y="10" width="60" height="68" rx="12" fill="#FFFFFF" stroke="#0284C7" strokeWidth="3.5" />
            <line x1="14" y1="26" x2="74" y2="26" stroke="#BAE6FD" strokeWidth="3" />
            <circle cx="27" cy="18" r="3" fill="#38BDF8" />
            <circle cx="37" cy="18" r="3" fill="#FACC15" />
            <rect x="52" y="15" width="12" height="6" rx="3" fill="#0284C7" />
            <circle cx="44" cy="51" r="18" fill="#E0F2FE" stroke="#0284C7" strokeWidth="3.5" />
            <path d="M30 53 Q37 44 44 52 T58 51" fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="72" cy="14" r="5" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="1.5" />
            <circle cx="80" cy="24" r="3.5" fill="#FEF08A" stroke="#FDE047" strokeWidth="1.2" />
          </svg>
          <div>
            <h1 className="font-display font-extrabold text-lg sm:text-xl text-[#0F2744]">
              Login Admin Huzavin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Masuk untuk mengelola pesanan, data pakaian, proses cuci, dan keuangan.
            </p>
          </div>
        </div>

        {loginError && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm font-semibold text-red-700"
          >
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="admin-username"
              className="block text-sm font-semibold text-[#0F2744] mb-1.5"
            >
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Masukkan username admin"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm text-[#0F2744]"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-sm font-semibold text-[#0F2744] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Masukkan password admin"
                className="w-full min-h-[48px] pl-4 pr-12 py-2.5 rounded-2xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm text-[#0F2744]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl text-slate-500 hover:text-sky-700 hover:bg-sky-50 flex items-center justify-center transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full min-h-[50px] py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-extrabold text-sm tracking-wide transition-colors shadow-md shadow-sky-600/20 flex items-center justify-center gap-2"
          >
            {loggingIn ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>MEMVERIFIKASI...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>LOGIN ADMIN</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sky-700 font-semibold hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Kembali ke Website Pelanggan
          </a>
          <span>Sesi Terenkripsi</span>
        </div>
      </div>
    </div>
  );
}

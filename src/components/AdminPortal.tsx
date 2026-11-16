import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Edit3,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  MessageCircle,
  MessageSquareHeart,
  Package,
  Plus,
  Search,
  Settings,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildGeneralWhatsappUrl,
  formatRupiah,
  formatWeightKg,
  getStageLabel,
  ORDER_STAGES,
  OrderStatusCode,
} from '../lib/laundryRules';
import type { AdminOverviewData, AdminUser, GalleryItem, OrderRecordClient, TestimonialItem } from '../types';

type AdminTab = 'orders' | 'services' | 'gallery' | 'testimonials' | 'settings';

export function AdminPortal() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Order filters & modal
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingOrder, setEditingOrder] = useState<OrderRecordClient | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatusCode>('ORDER_DITERIMA');
  const [editFinalWeight, setEditFinalWeight] = useState('');
  const [editFinalPrice, setEditFinalPrice] = useState('');
  const [editStatusNote, setEditStatusNote] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<OrderRecordClient | null>(null);

  // Gallery form state
  const [galleryForm, setGalleryForm] = useState<{
    id: string | null;
    title: string;
    category: string;
    imageUrl: string;
    caption: string;
    isIllustration: boolean;
  }>({
    id: null,
    title: '',
    category: 'Hasil setrika',
    imageUrl: '',
    caption: '',
    isIllustration: false,
  });

  // Testimonial form state
  const [testimonialForm, setTestimonialForm] = useState<{
    id: string | null;
    customerName: string;
    rating: number;
    comment: string;
  }>({
    id: null,
    customerName: '',
    rating: 5,
    comment: '',
  });

  // Settings & Password state
  const [settingsForm, setSettingsForm] = useState({
    businessName: '',
    sloganMain: '',
    sloganSecondary: '',
    address: '',
    whatsappDisplay: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  const loadOverview = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/admin/overview');
      if (res.status === 401) {
        setAdminUser(null);
        return;
      }
      const data = (await res.json()) as AdminOverviewData;
      setOverview(data);
      setSettingsForm({
        businessName: data.settings.businessName,
        sloganMain: data.settings.sloganMain,
        sloganSecondary: data.settings.sloganSecondary,
        address: data.settings.address,
        whatsappDisplay: data.settings.whatsappDisplay,
      });
    } catch {
      showToast('error', 'Gagal memuat data dashboard admin.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        if (data.authenticated && data.admin) {
          setAdminUser(data.admin);
          await loadOverview();
        }
      } finally {
        setCheckingAuth(false);
      }
    }
    checkSession();
  }, [loadOverview]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Login gagal.');
        return;
      }

      setAdminUser(data.admin);
      setPassword('');
      await loadOverview();
    } catch {
      setLoginError('Gagal terhubung ke server.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAdminUser(null);
    setOverview(null);
  }

  function openOrderModal(order: OrderRecordClient) {
    setEditingOrder(order);
    setEditStatus(order.status);
    setEditFinalWeight(order.finalWeight !== null ? String(order.finalWeight) : String(order.estimatedWeight));
    setEditFinalPrice(order.finalPrice !== null ? String(order.finalPrice) : String(order.estimatedPrice));
    setEditStatusNote('');
  }

  async function handleSaveOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOrder) return;
    setSavingOrder(true);

    try {
      const res = await fetch(`/api/admin/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          finalWeight: editFinalWeight === '' ? null : editFinalWeight,
          finalPrice: editFinalPrice === '' ? null : Number(editFinalPrice),
          statusNote: editStatusNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal memperbarui pesanan.');
        return;
      }
      setEditingOrder(null);
      showToast('success', `Pesanan ${editingOrder.orderCode} berhasil diperbarui.`);
      await loadOverview();
    } catch {
      showToast('error', 'Terjadi kesalahan saat menyimpan pesanan.');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleDeleteOrder() {
    if (!confirmDeleteOrder) return;
    try {
      const res = await fetch(`/api/admin/orders/${confirmDeleteOrder.id}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('error', 'Gagal menghapus pesanan.');
        return;
      }
      showToast('success', `Pesanan ${confirmDeleteOrder.orderCode} dihapus.`);
      setConfirmDeleteOrder(null);
      await loadOverview();
    } catch {
      showToast('error', 'Gagal menghapus pesanan.');
    }
  }

  async function handleUpdateService(serviceId: string, name: string, pricePerKg: number, description: string) {
    try {
      const res = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pricePerKg, description, estimatedDuration: '1–2 hari' }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal memperbarui harga layanan.');
        return;
      }
      showToast('success', `Tarif ${name} berhasil diperbarui.`);
      await loadOverview();
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    }
  }

  async function handleSaveGallery(e: React.FormEvent) {
    e.preventDefault();
    const method = galleryForm.id ? 'PUT' : 'POST';
    const url = galleryForm.id ? `/api/admin/gallery/${galleryForm.id}` : '/api/admin/gallery';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(galleryForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal menyimpan item galeri.');
        return;
      }
      setGalleryForm({
        id: null,
        title: '',
        category: 'Hasil setrika',
        imageUrl: '',
        caption: '',
        isIllustration: false,
      });
      showToast('success', 'Galeri berhasil diperbarui.');
      await loadOverview();
    } catch {
      showToast('error', 'Gagal menyimpan galeri.');
    }
  }

  async function handleDeleteGallery(id: string) {
    await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    showToast('success', 'Item galeri dihapus.');
    await loadOverview();
  }

  function handleGalleryFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Ukuran gambar maksimal 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setGalleryForm((prev) => ({ ...prev, imageUrl: reader.result as string, isIllustration: false }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveTestimonial(e: React.FormEvent) {
    e.preventDefault();
    const method = testimonialForm.id ? 'PUT' : 'POST';
    const url = testimonialForm.id
      ? `/api/admin/testimonials/${testimonialForm.id}`
      : '/api/admin/testimonials';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testimonialForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Gagal menyimpan testimoni.');
        return;
      }
      setTestimonialForm({ id: null, customerName: '', rating: 5, comment: '' });
      showToast('success', 'Testimoni pelanggan berhasil disimpan.');
      await loadOverview();
    } catch {
      showToast('error', 'Gagal menyimpan testimoni.');
    }
  }

  async function handleDeleteTestimonial(id: string) {
    await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    showToast('success', 'Testimoni dihapus.');
    await loadOverview();
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Gagal memperbarui pengaturan.');
      return;
    }
    showToast('success', 'Informasi kontak & bisnis berhasil diperbarui.');
    await loadOverview();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('error', 'Konfirmasi password baru tidak cocok.');
      return;
    }
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Gagal mengganti password.');
      return;
    }
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setAdminUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
    showToast('success', 'Password admin berhasil diperbarui.');
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F8FBFF] flex items-center justify-center p-6">
        <div className="text-sm font-semibold text-sky-700">Memeriksa sesi admin...</div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white border border-sky-200 p-7 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-display font-extrabold text-xl text-slate-900">
                Admin Dashboard Huzavin
              </h1>
              <p className="text-xs text-slate-500">Masuk untuk mengelola pesanan &amp; layanan</p>
            </div>
          </div>

          {loginError && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Username Admin
              </label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold text-sm transition-colors"
            >
              {loggingIn ? 'Memverifikasi...' : 'MASUK KE DASHBOARD'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <a href="/" className="inline-flex items-center gap-1.5 text-sky-700 font-semibold hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Kembali ke Website
            </a>
            <span>Autentikasi Terenkripsi</span>
          </div>
        </div>
      </div>
    );
  }

  const filteredOrders =
    overview?.orders.filter((o) => {
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const q = orderSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        o.orderCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q);
      return matchesStatus && matchesQuery;
    }) ?? [];

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap">
              ← Website Publik
            </a>
            <span className="text-slate-300">/</span>
            <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 truncate">
              Dashboard Admin Laundry Huzavin
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs font-medium text-slate-500">
              {adminUser.displayName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <div
            role="status"
            className={`px-4 py-3 rounded-2xl border shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Password Change Advisory if initial password is still active */}
        {adminUser.mustChangePassword && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs sm:text-sm text-amber-900">
                <p className="font-bold">Ganti Password Awal Demi Keamanan</p>
                <p>Akun ini masih menggunakan password awal konfigurasi. Segera ubah password sebelum website digunakan penuh.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold whitespace-nowrap shrink-0"
            >
              Ubah Password Sekarang
            </button>
          </div>
        )}

        {/* Database Status Strip */}
        {overview && (
          <div className="rounded-2xl bg-white border border-sky-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Database className="w-4 h-4 text-sky-600" aria-hidden="true" />
              <span>
                Penyimpanan Aktif: <strong className="text-slate-900">SQLite Lokal Permanen</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Supabase Eksternal:{' '}
                <strong className={overview.databaseStatus.supabaseConfigured ? 'text-emerald-700' : 'text-slate-600'}>
                  {overview.databaseStatus.supabaseConfigured ? 'Terkonfigurasi' : 'Belum dikonfigurasi (menggunakan SQLite aktif)'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={loadOverview}
              disabled={loadingData}
              className="text-sky-700 font-semibold hover:underline"
            >
              {loadingData ? 'Memuat...' : 'Muat Ulang Data'}
            </button>
          </div>
        )}

        {/* Summary KPI Cards */}
        {overview && (
          <section aria-label="Ringkasan pesanan" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total Order', value: overview.summary.totalOrders, accent: 'text-slate-900' },
              { label: 'Order Baru', value: overview.summary.newOrders, accent: 'text-sky-700' },
              { label: 'Menunggu Pickup', value: overview.summary.waitingPickup, accent: 'text-amber-700' },
              { label: 'Sedang Dicuci', value: overview.summary.washingNow, accent: 'text-sky-700' },
              { label: 'Siap Diantar', value: overview.summary.readyToDeliver, accent: 'text-indigo-700' },
              { label: 'Order Selesai', value: overview.summary.completedOrders, accent: 'text-emerald-700' },
              {
                label: 'Total Pendapatan',
                value: formatRupiah(overview.summary.totalRevenue),
                accent: 'text-emerald-700',
              },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl bg-white border border-sky-100 p-4">
                <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
                <p className={`font-display font-extrabold text-lg sm:text-xl mt-1 tabular-nums ${kpi.accent}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 pb-3">
          {[
            { id: 'orders', label: 'Manajemen Order', icon: Package },
            { id: 'services', label: 'Harga Layanan', icon: Tag },
            { id: 'gallery', label: 'Galeri', icon: ImageIcon },
            { id: 'testimonials', label: 'Testimoni', icon: MessageSquareHeart },
            { id: 'settings', label: 'Kontak & Keamanan', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'bg-white text-slate-600 border border-sky-100 hover:border-sky-300'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: MANAJEMEN ORDER */}
        {activeTab === 'orders' && overview && (
          <section className="rounded-3xl bg-white border border-sky-100 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" aria-hidden="true" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Cari kode order atau nama pelanggan..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="admin-status-filter" className="text-xs font-semibold text-slate-600">
                  Filter Status:
                </label>
                <select
                  id="admin-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm"
                >
                  <option value="ALL">Semua Status</option>
                  {ORDER_STAGES.map((stage) => (
                    <option key={stage.code} value={stage.code}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-sky-200 rounded-2xl bg-sky-50/40">
                <Package className="w-10 h-10 text-sky-300 mx-auto mb-2" aria-hidden="true" />
                <p className="font-semibold text-slate-700 text-sm">Belum ada pesanan yang sesuai.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Pesanan yang dibuat pelanggan melalui formulir website akan langsung muncul di sini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-sky-100 text-slate-500 font-semibold">
                      <th className="py-3 px-3">Kode Order</th>
                      <th className="py-3 px-3">Pelanggan</th>
                      <th className="py-3 px-3">Layanan &amp; Berat</th>
                      <th className="py-3 px-3">Total</th>
                      <th className="py-3 px-3">Alamat Pickup</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-sky-50/40">
                        <td className="py-3.5 px-3 font-mono font-bold text-sky-800 whitespace-nowrap">
                          {order.orderCode}
                          <div className="text-[11px] font-sans font-normal text-slate-400 tabular-nums">
                            {new Date(order.createdAt).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-900">{order.customerName}</div>
                          <div className="text-xs font-mono text-slate-500 tabular-nums">
                            {order.customerPhone}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{order.serviceName}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {order.finalWeight !== null
                              ? `${formatWeightKg(order.finalWeight)} (Aktual)`
                              : `${formatWeightKg(order.estimatedWeight)} (Est.)`}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {order.finalPrice !== null
                            ? formatRupiah(order.finalPrice)
                            : formatRupiah(order.estimatedPrice)}
                        </td>
                        <td className="py-3.5 px-3 max-w-[220px]">
                          <div className="truncate text-slate-700" title={order.pickupAddress}>
                            {order.pickupAddress}
                          </div>
                          <div className="text-xs text-slate-400 tabular-nums">
                            {order.pickupDate} · {order.pickupTime}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              order.status === 'PESANAN_SELESAI'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-sky-50 text-sky-800 border border-sky-200'
                            }`}
                          >
                            {getStageLabel(order.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openOrderModal(order)}
                              aria-label={`Kelola pesanan ${order.orderCode}`}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
                            >
                              Kelola
                            </button>
                            <a
                              href={buildGeneralWhatsappUrl(
                                order.customerPhone,
                                `Halo Kak ${order.customerName}, ini Admin Laundry Huzavin menginformasikan status pesanan ${order.orderCode}: ${getStageLabel(order.status)}.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Hubungi ${order.customerName} via WhatsApp`}
                              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteOrder(order)}
                              aria-label={`Hapus pesanan ${order.orderCode}`}
                              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: MANAJEMEN HARGA LAYANAN */}
        {activeTab === 'services' && overview && (
          <section className="grid md:grid-cols-2 gap-6">
            {overview.services.map((service) => (
              <ServiceEditorCard
                key={service.id}
                service={service}
                onSave={handleUpdateService}
              />
            ))}
          </section>
        )}

        {/* TAB 3: MANAJEMEN GALERI */}
        {activeTab === 'gallery' && overview && (
          <section className="grid lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveGallery}
              className="lg:col-span-5 rounded-3xl bg-white border border-sky-100 p-6 space-y-4 h-fit"
            >
              <h2 className="font-display font-bold text-lg text-slate-900">
                {galleryForm.id ? 'Edit Foto Galeri' : 'Tambah Foto Galeri'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Foto</label>
                <input
                  type="text"
                  required
                  value={galleryForm.title}
                  onChange={(e) => setGalleryForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                <select
                  value={galleryForm.category}
                  onChange={(e) => setGalleryForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {[
                    'Pakaian sebelum dicuci',
                    'Pakaian setelah dicuci',
                    'Hasil setrika',
                    'Pakaian terlipat rapi',
                    'Peralatan laundry',
                    'Aktivitas pelayanan laundry',
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Gambar atau Upload File Foto
                </label>
                <input
                  type="text"
                  required
                  value={galleryForm.imageUrl}
                  onChange={(e) => setGalleryForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  placeholder="/src/assets/... atau https://..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm mb-2"
                />
                <input type="file" accept="image/*" onChange={handleGalleryFileUpload} className="text-xs text-slate-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
                <textarea
                  rows={2}
                  value={galleryForm.caption}
                  onChange={(e) => setGalleryForm((p) => ({ ...p, caption: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={galleryForm.isIllustration}
                  onChange={(e) => setGalleryForm((p) => ({ ...p, isIllustration: e.target.checked }))}
                />
                Tandai sebagai gambar ilustrasi
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  {galleryForm.id ? 'Simpan Perubahan' : 'Tambah ke Galeri'}
                </button>
                {galleryForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryForm({
                        id: null,
                        title: '',
                        category: 'Hasil setrika',
                        imageUrl: '',
                        caption: '',
                        isIllustration: false,
                      })
                    }
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              {overview.gallery.map((item: GalleryItem) => (
                <div key={item.id} className="rounded-2xl bg-white border border-sky-100 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover bg-sky-50"
                  />
                  <div className="p-4 space-y-2">
                    <p className="text-[11px] text-slate-500">{item.category}</p>
                    <h3 className="font-display font-bold text-sm text-slate-900">{item.title}</h3>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setGalleryForm({
                            id: item.id,
                            title: item.title,
                            category: item.category,
                            imageUrl: item.imageUrl,
                            caption: item.caption,
                            isIllustration: item.isIllustration,
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 text-xs font-semibold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGallery(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: MANAJEMEN TESTIMONI */}
        {activeTab === 'testimonials' && overview && (
          <section className="grid lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveTestimonial}
              className="lg:col-span-5 rounded-3xl bg-white border border-sky-100 p-6 space-y-4 h-fit"
            >
              <h2 className="font-display font-bold text-lg text-slate-900">
                {testimonialForm.id ? 'Edit Testimoni Pelanggan' : 'Tambah Testimoni Asli'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  value={testimonialForm.customerName}
                  onChange={(e) => setTestimonialForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Contoh: Ibu Dewi (Pasir Putih)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rating Bintang</label>
                <select
                  value={testimonialForm.rating}
                  onChange={(e) => setTestimonialForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} Bintang
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Komentar Pelanggan</label>
                <textarea
                  rows={3}
                  required
                  value={testimonialForm.comment}
                  onChange={(e) => setTestimonialForm((p) => ({ ...p, comment: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
              >
                {testimonialForm.id ? 'Simpan Perubahan' : 'Publikasikan Testimoni'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-3">
              {overview.testimonials.length === 0 ? (
                <div className="rounded-3xl bg-white border border-sky-100 p-8 text-center text-sm text-slate-500">
                  Belum ada testimoni yang ditambahkan. Tambahkan ulasan asli dari pelanggan melalui formulir di samping.
                </div>
              ) : (
                overview.testimonials.map((t: TestimonialItem) => (
                  <div
                    key={t.id}
                    className="rounded-2xl bg-white border border-sky-100 p-5 flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="font-display font-bold text-sm text-slate-900">
                        {t.customerName} · {t.rating}/5 Bintang
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{t.comment}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setTestimonialForm({
                            id: t.id,
                            customerName: t.customerName,
                            rating: t.rating,
                            comment: t.comment,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* TAB 5: MANAJEMEN KONTAK & KEAMANAN PASSWORD */}
        {activeTab === 'settings' && (
          <section className="grid md:grid-cols-2 gap-6">
            <form onSubmit={handleSaveSettings} className="rounded-3xl bg-white border border-sky-100 p-6 space-y-4">
              <h2 className="font-display font-bold text-lg text-slate-900">Informasi Kontak &amp; Bisnis</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Bisnis</label>
                <input
                  type="text"
                  required
                  value={settingsForm.businessName}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, businessName: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor WhatsApp Admin</label>
                <input
                  type="text"
                  required
                  value={settingsForm.whatsappDisplay}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, whatsappDisplay: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  required
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slogan Utama</label>
                <input
                  type="text"
                  value={settingsForm.sloganMain}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, sloganMain: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
              >
                Simpan Pengaturan Kontak
              </button>
            </form>

            <form onSubmit={handleChangePassword} className="rounded-3xl bg-white border border-sky-100 p-6 space-y-4">
              <h2 className="font-display font-bold text-lg text-slate-900">Keamanan Akun &amp; Ganti Password</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password Saat Ini</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password Baru (min. 6 karakter)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Perbarui Password Admin
              </button>
            </form>
          </section>
        )}
      </main>

      {/* ORDER DETAIL & STATUS UPDATE MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-sky-200 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-mono font-bold text-sky-700">{editingOrder.orderCode}</p>
                <h2 className="font-display font-bold text-lg text-slate-900">{editingOrder.customerName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                aria-label="Tutup modal detail order"
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-2 text-xs sm:text-sm text-slate-600 border-b border-slate-100">
              <p>
                <strong>Layanan:</strong> {editingOrder.serviceName} ({formatRupiah(editingOrder.pricePerKg)}/kg)
              </p>
              <p>
                <strong>Alamat Pickup:</strong> {editingOrder.pickupAddress}
                {editingOrder.pickupLandmark ? ` · Patokan: ${editingOrder.pickupLandmark}` : ''}
              </p>
              <p>
                <strong>Jadwal Pickup:</strong> {editingOrder.pickupDate} ({editingOrder.pickupTime})
              </p>
              {editingOrder.notes && (
                <p>
                  <strong>Catatan:</strong> {editingOrder.notes}
                </p>
              )}
            </div>

            <form onSubmit={handleSaveOrder} className="pt-4 space-y-4">
              <div>
                <label htmlFor="modal-status-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Update Status Pengerjaan Laundry
                </label>
                <select
                  id="modal-status-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatusCode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
                >
                  {ORDER_STAGES.filter((s) => editingOrder.includesIroning || !s.ironingOnly).map((stage) => (
                    <option key={stage.code} value={stage.code}>
                      {stage.stepNumber}. {stage.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-final-weight" className="block text-xs font-semibold text-slate-700 mb-1">
                    Berat Cucian Aktual (kg)
                  </label>
                  <input
                    id="modal-final-weight"
                    type="text"
                    inputMode="decimal"
                    value={editFinalWeight}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditFinalWeight(val);
                      const parsed = Number.parseFloat(val.replace(',', '.'));
                      if (Number.isFinite(parsed) && parsed >= 1) {
                        setEditFinalPrice(String(Math.round(parsed * editingOrder.pricePerKg)));
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="modal-final-price" className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Pembayaran (Rp)
                  </label>
                  <input
                    id="modal-final-price"
                    type="number"
                    min={0}
                    value={editFinalPrice}
                    onChange={(e) => setEditFinalPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-status-note" className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Progres (Opsional)
                </label>
                <input
                  id="modal-status-note"
                  type="text"
                  value={editStatusNote}
                  onChange={(e) => setEditStatusNote(e.target.value)}
                  placeholder="Contoh: Sudah ditimbang 2,5 kg dan mulai dicuci"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={savingOrder}
                  className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors"
                >
                  {savingOrder ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeleteOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-4 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-slate-900">Hapus Pesanan?</h3>
            <p className="text-sm text-slate-600">
              Pesanan <strong className="font-mono">{confirmDeleteOrder.orderCode}</strong> atas nama{' '}
              <strong>{confirmDeleteOrder.customerName}</strong> akan dihapus permanen.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleDeleteOrder}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                Ya, Hapus
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOrder(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceEditorCard({
  service,
  onSave,
}: {
  service: AdminOverviewData['services'][number];
  onSave: (id: string, name: string, pricePerKg: number, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(String(service.pricePerKg));
  const [desc, setDesc] = useState(service.description);
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(service.id, name, Number(price), desc);
        setSaving(false);
      }}
      className="rounded-3xl bg-white border border-sky-100 p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-slate-900">{service.name}</h3>
        <span className="font-mono font-bold text-sky-700 tabular-nums">
          {formatRupiah(Number(price) || 0)}/kg
        </span>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Layanan</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Harga per Kg (Rp)</label>
        <input
          type="number"
          min={1000}
          step={500}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
        <textarea
          rows={2}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
      >
        {saving ? 'Menyimpan...' : 'Simpan Harga'}
      </button>
    </form>
  );
}

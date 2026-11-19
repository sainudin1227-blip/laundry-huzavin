import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  CreditCard,
  Database,
  Edit3,
  FilePlus2,
  History,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquareHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shirt,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  WashingMachine,
  X,
} from 'lucide-react';
import {
  buildGeneralWhatsappUrl,
  formatRupiah,
  ORDER_STAGES,
  type OrderStatusCode,
} from '../lib/laundryRules';
import {
  changeSupabaseAdminPassword,
  clearAdminSession,
  deleteSupabaseGalleryItem,
  deleteSupabaseOrder,
  deleteSupabaseTestimonial,
  fetchSupabaseAdminOverview,
  getStoredAdminSession,
  saveSupabaseGalleryItem,
  saveSupabaseSettings,
  saveSupabaseTestimonial,
  updateSupabaseOrder,
  updateSupabaseService,
} from '../lib/supabaseAdmin';
import { getSupabaseClient } from '../lib/supabaseClient';
import type {
  AdminOverviewData,
  AdminUser,
  GalleryItem,
  OrderRecordClient,
  TestimonialItem,
} from '../types';
import { AdminDashboardCharts } from './admin/AdminDashboardCharts';
import { AdminLoginPage } from './admin/AdminLoginPage';
import { DataPakaianView } from './admin/DataPakaianView';
import { ManualOrderPage } from './admin/ManualOrderPage';
import { OrderDetailModal } from './admin/OrderDetailModal';
import { OrdersListPanel } from './admin/OrdersListPanel';
import { ProsesLaundryKanban } from './admin/ProsesLaundryKanban';

type AdminTab =
  | 'dashboard'
  | 'incoming'
  | 'clothing'
  | 'manual'
  | 'process'
  | 'pickup'
  | 'delivery'
  | 'customers'
  | 'history'
  | 'finance'
  | 'settings';

const TAB_ROUTES: Record<AdminTab, string> = {
  dashboard: '/admin/dashboard',
  incoming: '/admin/pesanan-masuk',
  clothing: '/admin/data-pakaian',
  manual: '/admin/tambah-pesanan',
  process: '/admin/proses-laundry',
  pickup: '/admin/penjemputan',
  delivery: '/admin/pengantaran',
  customers: '/admin/pelanggan',
  history: '/admin/riwayat-pesanan',
  finance: '/admin/laporan-keuangan',
  settings: '/admin/pengaturan',
};

function parseTabFromPathname(pathname: string): AdminTab {
  const clean = pathname.replace(/\/+$/, '');
  const match = (Object.entries(TAB_ROUTES) as Array<[AdminTab, string]>).find(
    ([, route]) => route === clean
  );
  return match ? match[0] : 'dashboard';
}

const SIDEBAR_MENU: Array<{
  id: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'incoming', label: 'Pesanan Masuk', icon: Inbox },
  { id: 'clothing', label: 'Data Pakaian', icon: Shirt },
  { id: 'manual', label: 'Tambah Pesanan Manual', icon: FilePlus2 },
  { id: 'process', label: 'Proses Laundry', icon: WashingMachine },
  { id: 'pickup', label: 'Penjemputan', icon: Truck },
  { id: 'delivery', label: 'Pengantaran', icon: Send },
  { id: 'customers', label: 'Data Pelanggan', icon: Users },
  { id: 'history', label: 'Riwayat Pesanan', icon: History },
  { id: 'finance', label: 'Laporan Keuangan', icon: TrendingUp },
  { id: 'settings', label: 'Pengaturan Akun', icon: Settings },
];

export function AdminPortal() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => getStoredAdminSession());

  // URL-synced route state
  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    parseTabFromPathname(window.location.pathname)
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Dashboard data & notifications
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [liveIncomingAlert, setLiveIncomingAlert] = useState<string | null>(null);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);

  // Process Laundry sub-views (Kanban + Service Prices + Gallery + Testimonials)
  const [processViewTab, setProcessViewTab] = useState<
    'kanban' | 'services' | 'gallery' | 'testimonials'
  >('kanban');

  // Search, Filters & Modals
  const [incomingSearch, setIncomingSearch] = useState('');
  const [incomingStatusFilter, setIncomingStatusFilter] = useState('ALL');
  const [incomingDateFilter, setIncomingDateFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<OrderRecordClient | null>(null);
  const [rejectModalOrder, setRejectModalOrder] = useState<OrderRecordClient | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

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

  const navigateToTab = useCallback((tab: AdminTab, replace = false) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
    setNotifPopoverOpen(false);
    if (tab === 'incoming') setLiveIncomingAlert(null);

    const targetPath = TAB_ROUTES[tab];
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ tab }, '', targetPath);
      } else {
        window.history.pushState({ tab }, '', targetPath);
      }
    }
  }, []);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname.replace(/\/+$/, '');
      if (!adminUser) {
        if (path !== '/admin/login') {
          window.history.replaceState({}, '', '/admin/login');
        }
        return;
      }
      if (path === '/admin' || path === '/admin/login') {
        window.history.replaceState({ tab: 'dashboard' }, '', '/admin/dashboard');
        setActiveTab('dashboard');
        return;
      }
      setActiveTab(parseTabFromPathname(path));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [adminUser]);

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoadingData(true);
    try {
      const data = await fetchSupabaseAdminOverview();
      setOverview(data);
      setSettingsForm({
        businessName: data.settings.businessName,
        sloganMain: data.settings.sloganMain,
        sloganSecondary: data.settings.sloganSecondary,
        address: data.settings.address,
        whatsappDisplay: data.settings.whatsappDisplay,
      });
    } catch (err) {
      if (!silent) {
        showToast(
          'error',
          err instanceof Error ? err.message : 'Gagal memuat data dashboard admin dari Supabase.'
        );
      }
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const localAdmin = getStoredAdminSession();
    if (!localAdmin) {
      setAdminUser(null);
      if (window.location.pathname !== '/admin/login') {
        window.history.replaceState({}, '', '/admin/login');
      }
      return;
    }

    setAdminUser(localAdmin);
    const clean = window.location.pathname.replace(/\/+$/, '');
    if (clean === '/admin' || clean === '/admin/login') {
      window.history.replaceState({ tab: 'dashboard' }, '', '/admin/dashboard');
      setActiveTab('dashboard');
    } else {
      setActiveTab(parseTabFromPathname(clean));
    }
    void loadOverview();
  }, [loadOverview]);

  // Live Supabase Realtime incoming order alerts
  useEffect(() => {
    if (!adminUser) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as { order_code?: string; customer_name?: string } | null;
          if (newOrder?.order_code) {
            setLiveIncomingAlert(
              `Pesanan baru masuk: ${newOrder.order_code} (${newOrder.customer_name ?? 'Pelanggan'})`
            );
          } else {
            setLiveIncomingAlert('Ada pesanan baru masuk!');
          }
          loadOverview(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          loadOverview(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminUser, loadOverview]);

  async function handleLoginSuccess(admin: AdminUser) {
    setAdminUser(admin);
    window.history.replaceState({ tab: 'dashboard' }, '', '/admin/dashboard');
    setActiveTab('dashboard');
    await loadOverview();
  }

  async function handleLogout() {
    clearAdminSession();
    setAdminUser(null);
    setOverview(null);
    setMobileDrawerOpen(false);
    window.history.replaceState({}, '', '/admin/login');
  }

  async function handleQuickAccept(order: OrderRecordClient) {
    const nextStatus: OrderStatusCode =
      order.status === 'ORDER_DITERIMA' ? 'MENUNGGU_PENJEMPUTAN' : order.status;
    try {
      await updateSupabaseOrder(order.id, {
        adminDecision: 'diterima',
        status: nextStatus,
        statusNote: 'Pesanan diterima oleh admin Laundry Huzavin.',
      });
      showToast('success', `Pesanan ${order.orderCode} diterima & dijadwalkan.`);
      await loadOverview(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menerima pesanan.');
    }
  }

  async function handleConfirmReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectModalOrder) return;
    const reason = rejectReasonInput.trim() || 'Di luar area layanan / dibatalkan';
    try {
      await updateSupabaseOrder(rejectModalOrder.id, {
        adminDecision: 'ditolak',
        rejectionReason: reason,
        statusNote: `Pesanan ditolak: ${reason}`,
      });
      showToast('success', `Pesanan ${rejectModalOrder.orderCode} ditolak.`);
      setRejectModalOrder(null);
      setRejectReasonInput('');
      await loadOverview(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menolak pesanan.');
    }
  }

  async function handleMoveKanbanStage(order: OrderRecordClient, targetStatus: OrderStatusCode) {
    try {
      await updateSupabaseOrder(order.id, {
        status: targetStatus,
        adminDecision: 'diterima',
      });
      showToast('success', `Status ${order.orderCode} diperbarui.`);
      await loadOverview(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memindahkan status.');
    }
  }

  async function handleQuickAdvance(order: OrderRecordClient) {
    const visibleStages = ORDER_STAGES.filter((s) => order.includesIroning || !s.ironingOnly);
    const currIdx = visibleStages.findIndex((s) => s.code === order.status);
    if (currIdx === -1 || currIdx >= visibleStages.length - 1) return;
    const nextStage = visibleStages[currIdx + 1];

    try {
      await updateSupabaseOrder(order.id, {
        status: nextStage.code,
        adminDecision: 'diterima',
      });
      showToast('success', `${order.orderCode} lanjut ke: ${nextStage.label}`);
      await loadOverview(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui status.');
    }
  }

  async function handleTogglePaid(order: OrderRecordClient) {
    const nextPay = order.paymentStatus === 'lunas' ? 'belum_dibayar' : 'lunas';
    try {
      await updateSupabaseOrder(order.id, {
        paymentStatus: nextPay,
        statusNote:
          nextPay === 'lunas'
            ? 'Pembayaran ditandai LUNAS oleh admin.'
            : 'Status pembayaran dikembalikan ke Belum Dibayar.',
      });
      showToast(
        'success',
        `Pembayaran ${order.orderCode}: ${nextPay === 'lunas' ? 'Lunas' : 'Belum Dibayar'}`
      );
      await loadOverview(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengubah status pembayaran.');
    }
  }

  async function handleDeleteOrder() {
    if (!confirmDeleteOrder) return;
    try {
      await deleteSupabaseOrder(confirmDeleteOrder.id);
      showToast('success', `Pesanan ${confirmDeleteOrder.orderCode} dihapus.`);
      setConfirmDeleteOrder(null);
      await loadOverview();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus pesanan.');
    }
  }

  async function handleUpdateService(
    serviceId: string,
    name: string,
    pricePerKg: number,
    description: string
  ) {
    try {
      await updateSupabaseService(serviceId, {
        name,
        pricePerKg,
        description,
        estimatedDuration: '1–2 hari',
      });
      showToast('success', `Tarif ${name} berhasil diperbarui.`);
      await loadOverview();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui tarif layanan.');
    }
  }

  async function handleSaveGallery(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveSupabaseGalleryItem(galleryForm);
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
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan galeri.');
    }
  }

  async function handleDeleteGallery(id: string) {
    try {
      await deleteSupabaseGalleryItem(id);
      showToast('success', 'Item galeri dihapus.');
      await loadOverview();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus galeri.');
    }
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
        setGalleryForm((prev) => ({
          ...prev,
          imageUrl: reader.result as string,
          isIllustration: false,
        }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveTestimonial(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveSupabaseTestimonial(testimonialForm);
      setTestimonialForm({ id: null, customerName: '', rating: 5, comment: '' });
      showToast('success', 'Testimoni pelanggan berhasil disimpan.');
      await loadOverview();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan testimoni.');
    }
  }

  async function handleDeleteTestimonial(id: string) {
    try {
      await deleteSupabaseTestimonial(id);
      showToast('success', 'Testimoni dihapus.');
      await loadOverview();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menghapus testimoni.');
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveSupabaseSettings(settingsForm);
      showToast('success', 'Informasi kontak & bisnis berhasil diperbarui.');
      await loadOverview();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal memperbarui pengaturan.');
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!adminUser) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('error', 'Konfirmasi password baru tidak cocok.');
      return;
    }
    const result = await changeSupabaseAdminPassword(
      adminUser.id,
      passwordForm.currentPassword,
      passwordForm.newPassword
    );
    if (!result.ok) {
      showToast('error', result.error || 'Gagal mengganti password.');
      return;
    }
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setAdminUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
    showToast('success', 'Password admin berhasil diperbarui di tabel admin_profiles.');
  }

  // Unauthenticated route -> Dedicated /admin/login page
  if (!adminUser) {
    return <AdminLoginPage onSuccess={handleLoginSuccess} />;
  }

  // Derived collections from real DB overview
  const allOrders = overview?.orders ?? [];
  const unreadIncomingCount = allOrders.filter(
    (o) => o.orderSource === 'website' && o.adminDecision === 'menunggu'
  ).length;

  const filteredIncomingOrders = allOrders.filter((o) => {
    const matchesStatus = incomingStatusFilter === 'ALL' || o.status === incomingStatusFilter;
    const matchesDate = !incomingDateFilter || o.createdAt.slice(0, 10) === incomingDateFilter;
    const q = incomingSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      o.orderCode.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.pickupAddress.toLowerCase().includes(q);
    return matchesStatus && matchesDate && matchesSearch;
  });

  const pickupOrders = allOrders.filter(
    (o) =>
      o.adminDecision !== 'ditolak' &&
      ['ORDER_DITERIMA', 'MENUNGGU_PENJEMPUTAN', 'CUCIAN_TELAH_DIJEMPUT'].includes(o.status)
  );
  const deliveryOrders = allOrders.filter(
    (o) =>
      o.adminDecision !== 'ditolak' &&
      ['SIAP_DIANTAR', 'DALAM_PENGANTARAN'].includes(o.status)
  );
  const historyOrders = allOrders.filter(
    (o) => o.status === 'PESANAN_SELESAI' || o.adminDecision === 'ditolak'
  );
  const filteredCustomers = (overview?.customers ?? []).filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.whatsapp.includes(q) ||
      c.lastAddress.toLowerCase().includes(q)
    );
  });

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const activeNavTitle =
    SIDEBAR_MENU.find((m) => m.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F3F8FF] text-[#0F2744] flex overflow-x-hidden">
      {/* COLLAPSIBLE DESKTOP SIDEBAR (12 Menu Items) */}
      <aside
        aria-label="Sidebar Admin Desktop"
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-sky-100 z-30 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div className="h-16 px-4 border-b border-sky-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <WashingMachine className="w-5 h-5" />
            </span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="font-display font-extrabold text-sm text-[#0F2744] truncate">
                  HUZAVIN ADMIN
                </p>
                <p className="text-[11px] text-slate-500 truncate">Dashboard Sistem</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Perlebar sidebar' : 'Ciutkan sidebar'}
            className="w-8 h-8 rounded-lg hover:bg-sky-50 text-slate-500 hover:text-sky-700 flex items-center justify-center shrink-0"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav aria-label="Menu utama admin" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {SIDEBAR_MENU.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => navigateToTab(item.id)}
                className={`w-full min-h-[42px] px-3 py-2.5 rounded-2xl flex items-center ${
                  sidebarCollapsed ? 'justify-center' : 'justify-between'
                } gap-2 text-xs sm:text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
                    : 'text-slate-600 hover:bg-sky-50 hover:text-[#0F2744]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!sidebarCollapsed && item.id === 'incoming' && unreadIncomingCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                      active ? 'bg-white text-sky-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {unreadIncomingCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* Menu #12: Logout */}
          <div className="pt-2 mt-2 border-t border-sky-100">
            <button
              type="button"
              title={sidebarCollapsed ? 'Logout' : undefined}
              onClick={handleLogout}
              className={`w-full min-h-[42px] px-3 py-2.5 rounded-2xl flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'justify-start'
              } gap-2.5 text-xs sm:text-sm font-bold text-red-600 hover:bg-red-50 transition-colors`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </nav>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-sky-100 shrink-0">
            <a
              href="/"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-semibold text-sky-700 hover:bg-sky-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Buka Website Pelanggan
            </a>
          </div>
        )}
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl z-10">
            <div className="h-16 px-4 border-b border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                  <WashingMachine className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-display font-extrabold text-sm text-[#0F2744]">HUZAVIN ADMIN</p>
                  <p className="text-[11px] text-slate-500">@{adminUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Tutup menu admin"
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {SIDEBAR_MENU.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateToTab(item.id)}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 text-sm font-semibold ${
                      active ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-sky-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {item.id === 'incoming' && unreadIncomingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        {unreadIncomingCount}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-2 mt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </nav>

            <div className="p-3 border-t border-sky-100">
              <a
                href="/"
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-sky-700 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Website Pelanggan
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT SHELL */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* TOP SaaS HEADER */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-sky-100 h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Buka menu navigasi admin"
              className="lg:hidden w-10 h-10 rounded-xl bg-sky-50 text-[#0F2744] flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-sm sm:text-lg text-[#0F2744] truncate">
                Selamat datang, Huzavin!
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {todayFormatted} · <span className="font-semibold text-sky-700">{activeNavTitle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell + Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifPopoverOpen((o) => !o)}
                aria-label="Notifikasi pesanan baru"
                className="relative w-10 h-10 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                {unreadIncomingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                    {unreadIncomingCount}
                  </span>
                )}
              </button>

              {notifPopoverOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-sky-200 shadow-xl p-3.5 z-40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#0F2744]">Notifikasi Pesanan Baru</p>
                    <button
                      type="button"
                      onClick={() => setNotifPopoverOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Tutup
                    </button>
                  </div>
                  {unreadIncomingCount === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      Tidak ada pesanan website baru yang menunggu konfirmasi.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-sky-800 font-semibold">
                        Ada {unreadIncomingCount} pesanan masuk menunggu konfirmasi admin.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateToTab('incoming')}
                        className="w-full py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                      >
                        Buka Manajemen Pesanan →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => loadOverview()}
              disabled={loadingData}
              aria-label="Muat ulang data dashboard"
              className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>

            {/* Admin Profile Chip */}
            <button
              type="button"
              onClick={() => navigateToTab('settings')}
              className="hidden sm:inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-100 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-sky-600 text-white text-xs font-extrabold flex items-center justify-center">
                H
              </span>
              <span className="text-left">
                <span className="block text-xs font-bold text-[#0F2744] leading-none">
                  {adminUser.username}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Admin</span>
              </span>
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 max-w-sm">
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

        {/* MAIN VIEWPORT CONTENT */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Live Incoming Order Notification Banner */}
          {liveIncomingAlert && (
            <div className="rounded-2xl bg-sky-600 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
                <Bell className="w-4 h-4 shrink-0" />
                <span>{liveIncomingAlert}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateToTab('incoming')}
                  className="px-3 py-1.5 rounded-xl bg-white text-sky-700 text-xs font-bold"
                >
                  Lihat Pesanan Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setLiveIncomingAlert(null)}
                  className="p-1 rounded-lg hover:bg-white/15"
                  aria-label="Tutup notifikasi"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Initial Password Security Notice */}
          {adminUser.mustChangePassword && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-900">
                  <p className="font-bold">Ganti Password Awal Demi Keamanan</p>
                  <p>
                    Akun masih menggunakan password awal konfigurasi. Ubah password di menu Pengaturan Akun.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateToTab('settings')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold whitespace-nowrap shrink-0"
              >
                Pengaturan Akun
              </button>
            </div>
          )}

          {!overview && (
            <div className="rounded-3xl bg-white border border-sky-100 p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-600">
                {loadingData ? 'Memuat data operasional Laundry Huzavin...' : 'Data dashboard belum termuat.'}
              </p>
              {!loadingData && (
                <button
                  type="button"
                  onClick={() => loadOverview(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                >
                  Muat Ulang Dashboard
                </button>
              )}
            </div>
          )}

          {/* 1. DASHBOARD UTAMA (/admin/dashboard) */}
          {activeTab === 'dashboard' && overview && (
            <div className="space-y-6">
              {/* Top Quick Action Bar */}
              <div className="rounded-3xl bg-gradient-to-r from-sky-600 to-sky-700 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md shadow-sky-600/15">
                <div>
                  <h2 className="font-display font-extrabold text-xl sm:text-2xl">
                    Ringkasan Operasional Laundry Huzavin
                  </h2>
                  <p className="text-xs sm:text-sm text-sky-100 mt-1">
                    Pantau status pesanan, pendapatan harian &amp; bulanan, serta antrean cucian secara langsung.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToTab('manual')}
                  className="min-h-[46px] px-5 py-3 rounded-2xl bg-white text-sky-800 hover:bg-sky-50 font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shrink-0 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  TAMBAH PESANAN MANUAL
                </button>
              </div>

              {/* 6 KARTU STATISTIK */}
              <section aria-label="Kartu Statistik Pesanan" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Pesanan', val: overview.summary.totalOrders, cls: 'text-[#0F2744]', bg: 'bg-white' },
                  { label: 'Pesanan Baru', val: overview.summary.newOrders, cls: 'text-sky-700', bg: 'bg-white' },
                  { label: 'Menunggu Pickup', val: overview.summary.waitingPickup, cls: 'text-amber-700', bg: 'bg-white' },
                  { label: 'Sedang Dicuci', val: overview.summary.washingNow, cls: 'text-blue-700', bg: 'bg-white' },
                  { label: 'Siap Diantar', val: overview.summary.readyToDeliver, cls: 'text-indigo-700', bg: 'bg-white' },
                  { label: 'Pesanan Selesai', val: overview.summary.completedOrders, cls: 'text-emerald-700', bg: 'bg-white' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl ${stat.bg} border border-sky-100 p-4 shadow-2xs`}
                  >
                    <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                    <p className={`font-display font-extrabold text-2xl mt-1 tabular-nums ${stat.cls}`}>
                      {stat.val}
                    </p>
                  </div>
                ))}
              </section>

              {/* 4 KARTU KEUANGAN */}
              <section aria-label="Kartu Ringkasan Keuangan" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="rounded-2xl bg-white border border-sky-100 p-4 sm:p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">Pendapatan Hari Ini</p>
                  <p className="font-display font-extrabold text-xl sm:text-2xl text-emerald-700 mt-1 tabular-nums">
                    {formatRupiah(overview.summary.todayRevenue)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Transaksi lunas hari ini</p>
                </div>
                <div className="rounded-2xl bg-white border border-sky-100 p-4 sm:p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">Pendapatan Bulan Ini</p>
                  <p className="font-display font-extrabold text-xl sm:text-2xl text-sky-700 mt-1 tabular-nums">
                    {formatRupiah(overview.summary.monthRevenue)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Akumulasi lunas bulan ini</p>
                </div>
                <div className="rounded-2xl bg-white border border-sky-100 p-4 sm:p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">Total Transaksi</p>
                  <p className="font-display font-extrabold text-xl sm:text-2xl text-[#0F2744] mt-1 tabular-nums">
                    {overview.summary.totalTransactions}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Omzet total {formatRupiah(overview.summary.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-4 sm:p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-amber-900">Belum Dibayar</p>
                  <p className="font-display font-extrabold text-xl sm:text-2xl text-amber-700 mt-1 tabular-nums">
                    {formatRupiah(overview.summary.unpaidAmount)}
                  </p>
                  <p className="text-[11px] text-amber-800/80 mt-1 tabular-nums">
                    {overview.summary.unpaidOrdersCount} pesanan menanti pelunasan
                  </p>
                </div>
              </section>

              {/* GRAFIK PESANAN & PENDAPATAN */}
              <AdminDashboardCharts orders={allOrders} />

              {/* TABEL PESANAN TERBARU */}
              <section className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-[#0F2744]">
                      PESANAN TERBARU
                    </h3>
                    <p className="text-xs text-slate-500">
                      Seluruh data pesanan terbaru langsung dari database aktif
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTab('incoming')}
                    className="text-xs font-bold text-sky-700 hover:underline"
                  >
                    Buka Manajemen Pesanan →
                  </button>
                </div>

                <OrdersListPanel
                  orders={allOrders.slice(0, 8)}
                  emptyTitle="Belum ada pesanan tercatat di database."
                  emptySubtitle="Pesanan pelanggan dari website maupun input manual akan otomatis tampil di tabel ini."
                  showQuickAccept
                  showQuickAdvance
                  onOpenDetail={(id) => setSelectedOrderId(id)}
                  onQuickAccept={handleQuickAccept}
                  onQuickAdvance={handleQuickAdvance}
                  onTogglePaid={handleTogglePaid}
                />
              </section>
            </div>
          )}

          {/* 2. PESANAN MASUK — MANAJEMEN PESANAN */}
          {activeTab === 'incoming' && overview && (
            <section className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-extrabold text-lg sm:text-2xl text-[#0F2744]">
                    MANAJEMEN PESANAN
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Daftar pesanan masuk dari website dan workshop. Terima, tolak, atau kelola detail pesanan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToTab('manual')}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0"
                >
                  <Plus className="w-4 h-4" /> Tambah Pesanan Manual
                </button>
              </div>

              {/* Search, Status Filter, Date Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={incomingSearch}
                    onChange={(e) => setIncomingSearch(e.target.value)}
                    placeholder="Cari kode order, nama, WA, alamat..."
                    className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl border border-slate-200 focus:border-sky-500 outline-none text-sm"
                  />
                </div>

                <select
                  aria-label="Filter status pesanan"
                  value={incomingStatusFilter}
                  onChange={(e) => setIncomingStatusFilter(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="ALL">Semua Status Pesanan</option>
                  {ORDER_STAGES.map((stage) => (
                    <option key={stage.code} value={stage.code}>
                      {stage.label}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Filter tanggal pesanan"
                    value={incomingDateFilter}
                    onChange={(e) => setIncomingDateFilter(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums"
                  />
                  {(incomingSearch || incomingStatusFilter !== 'ALL' || incomingDateFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIncomingSearch('');
                        setIncomingStatusFilter('ALL');
                        setIncomingDateFilter('');
                      }}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs font-semibold shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <OrdersListPanel
                orders={filteredIncomingOrders}
                emptyTitle="Belum ada pesanan yang sesuai filter."
                emptySubtitle="Pesanan baru dari pelanggan website akan otomatis masuk di sini."
                showQuickAccept
                showQuickReject
                onOpenDetail={(id) => setSelectedOrderId(id)}
                onQuickAccept={handleQuickAccept}
                onQuickReject={(o) => {
                  setRejectModalOrder(o);
                  setRejectReasonInput('');
                }}
                onTogglePaid={handleTogglePaid}
                onRequestDelete={(o) => setConfirmDeleteOrder(o)}
              />
            </section>
          )}

          {/* 3. DATA PAKAIAN */}
          {activeTab === 'clothing' && overview && (
            <DataPakaianView
              clothingItems={overview.clothingItems}
              orders={allOrders}
              onOpenOrderDetail={(orderId) => setSelectedOrderId(orderId)}
              onGoToManualOrder={() => navigateToTab('manual')}
              onChanged={async (msg) => {
                showToast('success', msg);
                await loadOverview(true);
              }}
            />
          )}

          {/* 4. TAMBAH PESANAN MANUAL (Dedicated Page) */}
          {activeTab === 'manual' && overview && (
            <ManualOrderPage
              services={overview.services}
              onOrderSaved={async (created) => {
                showToast('success', `Pesanan ${created.orderCode} berhasil disimpan!`);
                await loadOverview(true);
              }}
              onOpenOrderDetail={(orderId) => setSelectedOrderId(orderId)}
            />
          )}

          {/* 5. PROSES LAUNDRY (Kanban Board + Tarif/Galeri/Testimoni Sub-Tabs) */}
          {activeTab === 'process' && overview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'kanban', label: 'Kanban Proses Laundry', icon: WashingMachine },
                  { id: 'services', label: 'Harga Layanan', icon: Tag },
                  { id: 'gallery', label: 'Galeri Before/After', icon: ImageIcon },
                  { id: 'testimonials', label: 'Testimoni', icon: MessageSquareHeart },
                ].map((sub) => {
                  const Icon = sub.icon;
                  const active = processViewTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setProcessViewTab(sub.id as typeof processViewTab)}
                      className={`inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold ${
                        active
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white border border-sky-100 text-slate-600 hover:border-sky-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              {processViewTab === 'kanban' && (
                <ProsesLaundryKanban
                  orders={allOrders}
                  onMoveStage={handleMoveKanbanStage}
                  onOpenDetail={(id) => setSelectedOrderId(id)}
                />
              )}

              {processViewTab === 'services' && (
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

              {processViewTab === 'gallery' && (
                <section className="grid lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={handleSaveGallery}
                    className="lg:col-span-5 rounded-3xl bg-white border border-sky-100 p-5 sm:p-6 space-y-4 h-fit"
                  >
                    <h2 className="font-display font-bold text-lg text-[#0F2744]">
                      {galleryForm.id ? 'Edit Foto Galeri' : 'Tambah Foto Galeri'}
                    </h2>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Judul Foto
                      </label>
                      <input
                        type="text"
                        required
                        value={galleryForm.title}
                        onChange={(e) => setGalleryForm((p) => ({ ...p, title: e.target.value }))}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kategori
                      </label>
                      <select
                        value={galleryForm.category}
                        onChange={(e) => setGalleryForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm"
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
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm mb-2"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGalleryFileUpload}
                        className="text-xs text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Keterangan
                      </label>
                      <textarea
                        rows={2}
                        value={galleryForm.caption}
                        onChange={(e) => setGalleryForm((p) => ({ ...p, caption: e.target.value }))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" />
                      {galleryForm.id ? 'Simpan Perubahan' : 'Tambah ke Galeri'}
                    </button>
                  </form>

                  <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
                    {overview.gallery.map((item: GalleryItem) => (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-white border border-sky-100 overflow-hidden"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-[4/3] object-cover bg-sky-50"
                        />
                        <div className="p-4 space-y-2">
                          <p className="text-[11px] text-slate-500">{item.category}</p>
                          <h3 className="font-display font-bold text-sm text-[#0F2744]">
                            {item.title}
                          </h3>
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

              {processViewTab === 'testimonials' && (
                <section className="grid lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={handleSaveTestimonial}
                    className="lg:col-span-5 rounded-3xl bg-white border border-sky-100 p-5 sm:p-6 space-y-4 h-fit"
                  >
                    <h2 className="font-display font-bold text-lg text-[#0F2744]">
                      {testimonialForm.id ? 'Edit Testimoni Pelanggan' : 'Tambah Testimoni Asli'}
                    </h2>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Pelanggan
                      </label>
                      <input
                        type="text"
                        required
                        value={testimonialForm.customerName}
                        onChange={(e) =>
                          setTestimonialForm((p) => ({ ...p, customerName: e.target.value }))
                        }
                        placeholder="Contoh: Ibu Dewi (Pasir Putih)"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Rating Bintang
                      </label>
                      <select
                        value={testimonialForm.rating}
                        onChange={(e) =>
                          setTestimonialForm((p) => ({ ...p, rating: Number(e.target.value) }))
                        }
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} Bintang
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Komentar Pelanggan
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={testimonialForm.comment}
                        onChange={(e) =>
                          setTestimonialForm((p) => ({ ...p, comment: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[44px] py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                    >
                      {testimonialForm.id ? 'Simpan Perubahan' : 'Publikasikan Testimoni'}
                    </button>
                  </form>

                  <div className="lg:col-span-7 space-y-3">
                    {overview.testimonials.length === 0 ? (
                      <div className="rounded-3xl bg-white border border-sky-100 p-8 text-center text-sm text-slate-500">
                        Belum ada testimoni yang ditambahkan.
                      </div>
                    ) : (
                      overview.testimonials.map((t: TestimonialItem) => (
                        <div
                          key={t.id}
                          className="rounded-2xl bg-white border border-sky-100 p-5 flex items-start justify-between gap-4"
                        >
                          <div>
                            <p className="font-display font-bold text-sm text-[#0F2744]">
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
            </div>
          )}

          {/* 6. PENJEMPUTAN */}
          {activeTab === 'pickup' && overview && (
            <section className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4 shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[#0F2744]">
                  Jadwal &amp; Antrean Penjemputan Cucian
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Cucian yang menunggu penjemputan atau sedang diambil oleh kurir Laundry Huzavin.
                </p>
              </div>
              <OrdersListPanel
                orders={pickupOrders}
                emptyTitle="Tidak ada antrean penjemputan saat ini."
                emptySubtitle="Pesanan pickup baru dari website akan langsung tampil di sini."
                showQuickAccept
                showQuickAdvance
                onOpenDetail={(id) => setSelectedOrderId(id)}
                onQuickAccept={handleQuickAccept}
                onQuickAdvance={handleQuickAdvance}
              />
            </section>
          )}

          {/* 7. PENGANTARAN */}
          {activeTab === 'delivery' && overview && (
            <section className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4 shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[#0F2744]">
                  Antrean Pengantaran Cucian Bersih
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Cucian yang sudah rapi dan siap diantar atau sedang dalam perjalanan ke pelanggan.
                </p>
              </div>
              <OrdersListPanel
                orders={deliveryOrders}
                emptyTitle="Belum ada cucian siap diantar saat ini."
                emptySubtitle="Pesanan dengan status Siap Diantar atau Dalam Pengantaran akan tampil di sini."
                showQuickAdvance
                onOpenDetail={(id) => setSelectedOrderId(id)}
                onQuickAdvance={handleQuickAdvance}
                onTogglePaid={handleTogglePaid}
              />
            </section>
          )}

          {/* 8. DATA PELANGGAN */}
          {activeTab === 'customers' && overview && (
            <section className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-lg sm:text-xl text-[#0F2744]">
                    Data Pelanggan Laundry Huzavin ({overview.customers.length})
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Direktori otomatis dari pesanan website dan pesanan manual.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Cari nama atau nomor WA..."
                    className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-sky-200 rounded-2xl bg-sky-50/40">
                  <Users className="w-10 h-10 text-sky-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700 text-sm">
                    Belum ada data pelanggan tercatat.
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCustomers.map((cust) => (
                    <article
                      key={cust.id}
                      className="rounded-2xl border border-sky-100 bg-[#F8FBFF] p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-base text-[#0F2744] truncate">
                            {cust.name}
                          </h3>
                          <p className="text-xs font-mono text-slate-500 tabular-nums">
                            {cust.whatsapp}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-xs font-bold text-sky-800 tabular-nums shrink-0">
                          {cust.ordersCount} order
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{cust.lastAddress || '-'}</p>
                      <div className="pt-2 border-t border-sky-100 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-700 tabular-nums">
                          Total: {formatRupiah(cust.totalSpent)}
                        </span>
                        <a
                          href={buildGeneralWhatsappUrl(
                            cust.whatsapp,
                            `Halo Kak ${cust.name}, terima kasih sudah mempercayakan cucian di Laundry Huzavin!`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 9. RIWAYAT PESANAN */}
          {activeTab === 'history' && overview && (
            <section className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4 shadow-2xs">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[#0F2744]">
                  Riwayat Pesanan Selesai &amp; Arsip
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Arsip seluruh pesanan yang sudah selesai atau dibatalkan.
                </p>
              </div>
              <OrdersListPanel
                orders={historyOrders}
                emptyTitle="Belum ada riwayat pesanan selesai."
                emptySubtitle="Pesanan yang telah mencapai tahap Selesai akan otomatis tercatat di sini."
                onOpenDetail={(id) => setSelectedOrderId(id)}
                onTogglePaid={handleTogglePaid}
                onRequestDelete={(o) => setConfirmDeleteOrder(o)}
              />
            </section>
          )}

          {/* 10. LAPORAN KEUANGAN */}
          {activeTab === 'finance' && overview && (
            <section className="space-y-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white border border-sky-100 p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">Pendapatan Hari Ini</p>
                  <p className="font-display font-extrabold text-2xl text-emerald-700 mt-1 tabular-nums">
                    {formatRupiah(overview.summary.todayRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white border border-sky-100 p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">Pendapatan Bulan Ini</p>
                  <p className="font-display font-extrabold text-2xl text-sky-700 mt-1 tabular-nums">
                    {formatRupiah(overview.summary.monthRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white border border-sky-100 p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">Total Transaksi</p>
                  <p className="font-display font-extrabold text-2xl text-[#0F2744] mt-1 tabular-nums">
                    {overview.summary.totalTransactions}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    Omzet {formatRupiah(overview.summary.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-5 shadow-2xs">
                  <p className="text-xs font-semibold text-amber-800">Belum Dibayar</p>
                  <p className="font-display font-extrabold text-2xl text-amber-700 mt-1 tabular-nums">
                    {formatRupiah(overview.summary.unpaidAmount)}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    {overview.summary.unpaidOrdersCount} order menunggu pelunasan
                  </p>
                </div>
              </div>

              <AdminDashboardCharts orders={allOrders} />

              <div className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-sky-600" />
                  <h2 className="font-display font-bold text-lg text-[#0F2744]">
                    Daftar Transaksi &amp; Status Pembayaran
                  </h2>
                </div>
                <OrdersListPanel
                  orders={allOrders.filter((o) => o.adminDecision !== 'ditolak')}
                  emptyTitle="Belum ada transaksi tercatat."
                  emptySubtitle="Transaksi akan muncul setelah ada pesanan masuk atau manual."
                  onOpenDetail={(id) => setSelectedOrderId(id)}
                  onTogglePaid={handleTogglePaid}
                />
              </div>
            </section>
          )}

          {/* 11. PENGATURAN AKUN */}
          {activeTab === 'settings' && overview && (
            <div className="space-y-6">
              {/* Supabase Direct Database Banner */}
              <div className="rounded-2xl bg-white border border-sky-100 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Database className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>
                    Koneksi Autentikasi &amp; Database:{' '}
                    <strong
                      className={
                        overview.databaseStatus.supabaseConfigured
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }
                    >
                      {overview.databaseStatus.supabaseConfigured
                        ? 'Terhubung langsung ke Supabase (tabel admin_profiles)'
                        : 'Konfigurasi Supabase belum lengkap di Cloudflare'}
                    </strong>
                  </span>
                </div>
              </div>

              <section className="grid md:grid-cols-2 gap-6">
                {/* Account Security & Password */}
                <div className="rounded-3xl bg-white border border-sky-100 p-5 sm:p-6 space-y-5 shadow-2xs">
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-sky-100">
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </span>
                      <div>
                        <h2 className="font-display font-bold text-lg text-[#0F2744]">
                          Pengaturan Akun Admin
                        </h2>
                        <p className="text-xs text-slate-500">
                          Username aktif:{' '}
                          <strong className="font-mono text-sky-800">{adminUser.username}</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Logout
                    </button>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Username Admin
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={adminUser.username}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password Lama
                      </label>
                      <input
                        type="password"
                        required
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Ubah Password (min. 6 karakter)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Konfirmasi Password Baru
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[46px] px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold"
                    >
                      Simpan Perubahan
                    </button>
                  </form>
                </div>

                {/* Business Info Settings */}
                <form
                  onSubmit={handleSaveSettings}
                  className="rounded-3xl bg-white border border-sky-100 p-5 sm:p-6 space-y-4 shadow-2xs h-fit"
                >
                  <h2 className="font-display font-bold text-lg text-[#0F2744]">
                    Informasi Bisnis &amp; Kontak WhatsApp
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Bisnis
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.businessName}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, businessName: e.target.value }))
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor WhatsApp Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.whatsappDisplay}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, whatsappDisplay: e.target.value }))
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Lengkap
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={settingsForm.address}
                      onChange={(e) => setSettingsForm((p) => ({ ...p, address: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Slogan Utama
                    </label>
                    <input
                      type="text"
                      value={settingsForm.sloganMain}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, sloganMain: e.target.value }))
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#0F2744] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold"
                  >
                    Simpan Pengaturan Kontak
                  </button>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Navigasi cepat mobile admin"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-sky-100 px-2 py-1.5 flex items-center justify-around shadow-lg"
      >
        {[
          { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard },
          { id: 'incoming' as AdminTab, label: 'Pesanan', icon: Inbox },
          { id: 'manual' as AdminTab, label: 'Tambah', icon: FilePlus2 },
          { id: 'process' as AdminTab, label: 'Proses', icon: WashingMachine },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateToTab(item.id)}
              className={`min-h-[44px] px-3 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                active ? 'text-sky-700 bg-sky-50' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="min-h-[44px] px-3 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-slate-600"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>

      {/* ORDER DETAIL & CLOTHING / PHOTO MANAGEMENT MODAL */}
      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={async (message) => {
          showToast('success', message);
          await loadOverview(true);
        }}
      />

      {/* REJECT REASON MODAL */}
      {rejectModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="w-full max-w-md rounded-3xl bg-white p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display font-bold text-lg text-[#0F2744]">
              Tolak Pesanan {rejectModalOrder.orderCode}?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Tuliskan alasan penolakan agar tercatat di riwayat pesanan atas nama{' '}
              <strong>{rejectModalOrder.customerName}</strong>.
            </p>
            <input
              type="text"
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
              placeholder="Contoh: Di luar area layanan Sawangan / dibatalkan pelanggan"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <div className="flex gap-2.5">
              <button
                type="submit"
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                Konfirmasi Tolak
              </button>
              <button
                type="button"
                onClick={() => setRejectModalOrder(null)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeleteOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-4 shadow-2xl">
            <h3 className="font-display font-bold text-lg text-[#0F2744]">Hapus Pesanan?</h3>
            <p className="text-sm text-slate-600">
              Pesanan <strong className="font-mono">{confirmDeleteOrder.orderCode}</strong> atas nama{' '}
              <strong>{confirmDeleteOrder.customerName}</strong> beserta rincian pakaiannya akan dihapus permanen.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleDeleteOrder}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
              >
                Ya, Hapus
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOrder(null)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
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
      className="rounded-3xl bg-white border border-sky-100 p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-[#0F2744]">{service.name}</h3>
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
          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Harga per Kg (Rp)
        </label>
        <input
          type="number"
          min={1000}
          step={500}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
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
        className="min-h-[42px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
      >
        {saving ? 'Menyimpan...' : 'Simpan Harga'}
      </button>
    </form>
  );
}

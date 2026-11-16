import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  MessageCircle,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildGeneralWhatsappUrl,
  calculateEstimatedPrice,
  CLOTHING_CATEGORIES,
  CLOTHING_CONDITIONS,
  formatRupiah,
  formatWeightKg,
  getAdminDecisionLabel,
  getOrderSourceLabel,
  getPaymentStatusLabel,
  getStageLabel,
  ORDER_STAGES,
  parseWeightInput,
} from '../../lib/laundryRules';
import type {
  AdminDecision,
  OrderStatusCode,
  PaymentStatus,
  PhotoStage,
} from '../../lib/laundryRules';
import { adminFetch, getAdminProtectedAssetUrl } from '../../lib/adminAuthClient';
import type {
  ClothingPhotoClient,
  OrderHistoryItem,
  OrderItemClient,
  OrderRecordClient,
} from '../../types';

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
  onUpdated: (message: string) => void;
}

export function OrderDetailModal({ orderId, onClose, onUpdated }: OrderDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderRecordClient | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [items, setItems] = useState<OrderItemClient[]>([]);
  const [photos, setPhotos] = useState<ClothingPhotoClient[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Order Update State
  const [status, setStatus] = useState<OrderStatusCode>('ORDER_DITERIMA');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('belum_dibayar');
  const [adminDecision, setAdminDecision] = useState<AdminDecision>('menunggu');
  const [rejectionReason, setRejectionReason] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  // Add / Edit Item State
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    category: CLOTHING_CATEGORIES[0] as string,
    quantity: 1,
    weightStr: '0.5',
    conditionNote: CLOTHING_CONDITIONS[0] as string,
    specialNote: '',
  });
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

  // Photo Upload State
  const [photoStage, setPhotoStage] = useState<PhotoStage>('sebelum');
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal memuat detail pesanan.');
        return;
      }
      const o = data.order as OrderRecordClient;
      setOrder(o);
      setHistory(data.history ?? []);
      setItems(data.items ?? []);
      setPhotos(data.photos ?? []);

      setStatus(o.status);
      setPaymentStatus(o.paymentStatus);
      setAdminDecision(o.adminDecision);
      setRejectionReason(o.rejectionReason ?? '');
      setFinalWeight(o.finalWeight !== null ? String(o.finalWeight) : String(o.estimatedWeight));
      setFinalPrice(o.finalPrice !== null ? String(o.finalPrice) : String(o.estimatedPrice));
      setStatusNote('');
    } catch {
      setErrorMsg('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderId) {
      loadDetail(orderId);
    } else {
      setOrder(null);
    }
  }, [orderId, loadDetail]);

  if (!orderId) return null;

  async function handleSaveOrderChanges(e?: React.FormEvent, overridePatch?: Partial<{
    adminDecision: AdminDecision;
    status: OrderStatusCode;
    paymentStatus: PaymentStatus;
    rejectionReason: string;
    statusNote: string;
  }>) {
    if (e) e.preventDefault();
    if (!order) return;
    setSavingOrder(true);
    setErrorMsg('');

    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: overridePatch?.status ?? status,
          paymentStatus: overridePatch?.paymentStatus ?? paymentStatus,
          adminDecision: overridePatch?.adminDecision ?? adminDecision,
          rejectionReason: overridePatch?.rejectionReason ?? rejectionReason,
          finalWeight: finalWeight === '' ? null : finalWeight,
          finalPrice: finalPrice === '' ? null : Number(finalPrice),
          statusNote: overridePatch?.statusNote ?? statusNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menyimpan perubahan pesanan.');
        return;
      }
      setOrder(data.order);
      setHistory(data.history ?? []);
      setStatus(data.order.status);
      setPaymentStatus(data.order.paymentStatus);
      setAdminDecision(data.order.adminDecision);
      setStatusNote('');
      onUpdated(`Pesanan ${data.order.orderCode} berhasil diperbarui.`);
    } catch {
      setErrorMsg('Terjadi kendala koneksi saat menyimpan pesanan.');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleSaveClothingItem(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;

    const payload = {
      category: itemForm.category,
      quantity: Math.max(1, itemForm.quantity),
      weightKg: parseWeightInput(itemForm.weightStr),
      conditionNote: itemForm.conditionNote,
      specialNote: itemForm.specialNote.trim(),
    };

    const url = editingItemId
      ? `/api/admin/order-items/${editingItemId}`
      : `/api/admin/orders/${order.id}/items`;
    const method = editingItemId ? 'PUT' : 'POST';

    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Gagal menyimpan item pakaian.');
      return;
    }

    setItems(data.items ?? []);
    setShowAddItem(false);
    setEditingItemId(null);
    setItemForm({
      category: CLOTHING_CATEGORIES[0],
      quantity: 1,
      weightStr: '0.5',
      conditionNote: CLOTHING_CONDITIONS[0],
      specialNote: '',
    });
    onUpdated('Daftar pakaian pesanan berhasil diperbarui.');
  }

  async function handleDeleteItem(itemId: string) {
    const res = await adminFetch(`/api/admin/order-items/${itemId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setItems(data.items ?? []);
      setConfirmDeleteItemId(null);
      onUpdated('Item pakaian dihapus.');
    }
  }

  function handleUploadClothingPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran foto maksimal 5 MB.');
      return;
    }

    setUploadingPhoto(true);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result !== 'string') return;
        const res = await adminFetch(`/api/admin/orders/${order.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: reader.result,
            photoStage,
            caption:
              photoCaption.trim() ||
              (photoStage === 'sesudah' ? 'Hasil cucian bersih & rapi' : 'Kondisi pakaian masuk'),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Gagal mengunggah foto.');
          return;
        }
        setPhotos(data.photos ?? []);
        setPhotoCaption('');
        onUpdated('Foto dokumentasi pakaian tersimpan.');
      } catch {
        setErrorMsg('Gagal mengunggah foto pakaian.');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleDeletePhoto(photoId: string) {
    const res = await adminFetch(`/api/admin/clothing-photos/${photoId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setPhotos(data.photos ?? []);
      setConfirmDeletePhotoId(null);
      onUpdated('Foto dokumentasi dihapus.');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="w-full sm:max-w-4xl bg-white sm:rounded-3xl rounded-t-3xl border border-sky-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 bg-white border-b border-sky-100 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="order-detail-title" className="font-mono font-extrabold text-lg sm:text-xl text-sky-800">
                {order ? order.orderCode : 'Memuat Detail Pesanan...'}
              </h2>
              {order && (
                <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-800">
                  {getOrderSourceLabel(order.orderSource)}
                </span>
              )}
            </div>
            {order && (
              <p className="text-xs text-slate-500 mt-0.5">
                Masuk: {new Date(order.createdAt).toLocaleString('id-ID')} · Keputusan Admin:{' '}
                <strong className="text-slate-800">{getAdminDecisionLabel(order.adminDecision)}</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail pesanan"
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div role="alert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          {loading || !order ? (
            <div className="py-12 text-center text-sm font-semibold text-sky-700">
              Memuat informasi lengkap pesanan...
            </div>
          ) : (
            <>
              {/* Quick Decision Banner for Website Incoming Orders */}
              {order.adminDecision !== 'diterima' && (
                <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
                        Tindakan Konfirmasi Pesanan
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                        Terima pesanan untuk memproses penjemputan/pencucian, atau konfirmasi ulang ke pelanggan.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingOrder}
                      onClick={() =>
                        handleSaveOrderChanges(undefined, {
                          adminDecision: 'diterima',
                          status:
                            order.status === 'ORDER_DITERIMA'
                              ? 'MENUNGGU_PENJEMPUTAN'
                              : order.status,
                          statusNote: 'Pesanan diterima oleh admin Laundry Huzavin.',
                        })
                      }
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Terima Pesanan
                    </button>

                    <button
                      type="button"
                      disabled={savingOrder}
                      onClick={() =>
                        handleSaveOrderChanges(undefined, {
                          adminDecision: 'perlu_konfirmasi',
                          statusNote: 'Menunggu konfirmasi detail cucian dari pelanggan.',
                        })
                      }
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
                    >
                      <Clock className="w-4 h-4" />
                      Minta Konfirmasi
                    </button>

                    <button
                      type="button"
                      disabled={savingOrder}
                      onClick={() => {
                        const reason = rejectionReason.trim() || 'Di luar jangkauan layanan / dibatalkan pelanggan';
                        setRejectionReason(reason);
                        handleSaveOrderChanges(undefined, {
                          adminDecision: 'ditolak',
                          rejectionReason: reason,
                          statusNote: `Pesanan ditolak: ${reason}`,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Tolak Pesanan
                    </button>
                  </div>
                </div>
              )}

              {/* Customer & Pickup Info Card */}
              <div className="grid sm:grid-cols-2 gap-4 rounded-2xl bg-[#F8FBFF] border border-sky-100 p-4 text-xs sm:text-sm">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Data Pelanggan
                  </p>
                  <p className="font-display font-bold text-base text-slate-900">{order.customerName}</p>
                  <p className="font-mono text-slate-600 tabular-nums">{order.customerPhone}</p>
                  <a
                    href={buildGeneralWhatsappUrl(
                      order.customerPhone,
                      `Halo Kak ${order.customerName}, ini Admin Laundry Huzavin mengenai pesanan ${order.orderCode} (${getStageLabel(order.status)}).`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Chat Pelanggan via WhatsApp
                  </a>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Alamat &amp; Jadwal Penjemputan
                  </p>
                  <p className="font-semibold text-slate-800">{order.pickupAddress}</p>
                  {order.pickupLandmark && (
                    <p className="text-xs text-slate-600">Patokan: {order.pickupLandmark}</p>
                  )}
                  <p className="text-xs font-semibold text-sky-800 tabular-nums">
                    Jadwal: {order.pickupDate} · {order.pickupTime}
                  </p>
                  <p className="text-xs text-slate-600">
                    Layanan: <strong>{order.serviceName}</strong> ({formatRupiah(order.pricePerKg)}/kg)
                  </p>
                  {order.notes && <p className="text-xs text-slate-500">Catatan: {order.notes}</p>}
                </div>
              </div>

              {/* Status, Weight, Price & Payment Form */}
              <form
                onSubmit={(e) => handleSaveOrderChanges(e)}
                className="rounded-2xl border border-sky-200 bg-white p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-sm sm:text-base text-slate-900">
                    Update Status Pengerjaan &amp; Pembayaran
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      paymentStatus === 'lunas'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {getPaymentStatusLabel(paymentStatus)}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Proses Laundry (10 Tahap)
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as OrderStatusCode)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      {ORDER_STAGES.map((stage) => (
                        <option key={stage.code} value={stage.code}>
                          {stage.stepNumber}. {stage.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Pembayaran
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      <option value="belum_dibayar">Belum Dibayar</option>
                      <option value="lunas">Sudah Lunas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Keputusan Admin
                    </label>
                    <select
                      value={adminDecision}
                      onChange={(e) => setAdminDecision(e.target.value as AdminDecision)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      <option value="menunggu">Menunggu</option>
                      <option value="diterima">Diterima</option>
                      <option value="perlu_konfirmasi">Perlu Konfirmasi</option>
                      <option value="ditolak">Ditolak</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Berat Timbangan Aktual (kg)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={finalWeight}
                        onChange={(e) => setFinalWeight(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const w = parseWeightInput(finalWeight);
                          if (w >= 1) {
                            setFinalPrice(String(calculateEstimatedPrice(w, order.pricePerKg)));
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold whitespace-nowrap"
                      >
                        Hitung Harga
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Biaya Final (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Update Status (tampil di tracking pelanggan)
                  </label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Contoh: Sudah ditimbang 3.5 kg dan masuk mesin cuci"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingOrder}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white text-xs sm:text-sm font-bold"
                  >
                    <Check className="w-4 h-4" />
                    {savingOrder ? 'Menyimpan...' : 'Simpan Status & Pembayaran'}
                  </button>
                </div>
              </form>

              {/* Clothing Items Section */}
              <div className="rounded-2xl border border-sky-200 bg-white p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-sm sm:text-base text-slate-900">
                      Rincian Data Pakaian ({items.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Catat jenis pakaian, jumlah, kondisi, dan catatan pencucian khusus
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItemId(null);
                      setItemForm({
                        category: CLOTHING_CATEGORIES[0],
                        quantity: 1,
                        weightStr: '0.5',
                        conditionNote: CLOTHING_CONDITIONS[0],
                        specialNote: '',
                      });
                      setShowAddItem((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Pakaian
                  </button>
                </div>

                {showAddItem && (
                  <form
                    onSubmit={handleSaveClothingItem}
                    className="rounded-2xl bg-[#F8FBFF] border border-sky-200 p-3.5 space-y-3"
                  >
                    <div className="grid sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Jenis Pakaian
                        </label>
                        <select
                          value={itemForm.category}
                          onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm"
                        >
                          {CLOTHING_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Jumlah (pcs)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={itemForm.quantity}
                          onChange={(e) =>
                            setItemForm((p) => ({
                              ...p,
                              quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            }))
                          }
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Berat (kg)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={itemForm.weightStr}
                          onChange={(e) => setItemForm((p) => ({ ...p, weightStr: e.target.value }))}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kondisi
                        </label>
                        <select
                          value={itemForm.conditionNote}
                          onChange={(e) => setItemForm((p) => ({ ...p, conditionNote: e.target.value }))}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm"
                        >
                          {CLOTHING_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>
                              {cond}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={itemForm.specialNote}
                      onChange={(e) => setItemForm((p) => ({ ...p, specialNote: e.target.value }))}
                      placeholder="Catatan khusus item pakaian..."
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddItem(false);
                          setEditingItemId(null);
                        }}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                      >
                        {editingItemId ? 'Simpan Perubahan Item' : 'Tambahkan Item'}
                      </button>
                    </div>
                  </form>
                )}

                {items.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                    Belum ada rincian item pakaian. Klik &ldquo;Tambah Pakaian&rdquo; untuk mencatat jenis pakaian yang dicuci.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{item.category}</span>
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 text-xs font-semibold tabular-nums">
                              {item.quantity} pcs · {formatWeightKg(item.weightKg)}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">
                              {item.conditionNote}
                            </span>
                          </div>
                          {item.specialNote && (
                            <p className="text-xs text-slate-500 mt-1">Catatan: {item.specialNote}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setItemForm({
                                category: item.category,
                                quantity: item.quantity,
                                weightStr: String(item.weightKg),
                                conditionNote: item.conditionNote,
                                specialNote: item.specialNote,
                              });
                              setShowAddItem(true);
                            }}
                            className="p-2 rounded-lg bg-sky-50 text-sky-800 hover:bg-sky-100"
                            aria-label="Edit item pakaian"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteItemId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteItemId(null)}
                                className="px-2 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-[11px]"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteItemId(item.id)}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                              aria-label="Hapus item pakaian"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Protected Clothing Photos Documentation */}
              <div className="rounded-2xl border border-sky-200 bg-white p-4 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-slate-900">
                    Dokumentasi Foto Pakaian (Khusus Admin)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Foto tersimpan aman dan hanya dapat diakses melalui sesi admin Laundry Huzavin.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F8FBFF] border border-sky-100 p-3.5 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <select
                      value={photoStage}
                      onChange={(e) => setPhotoStage(e.target.value as PhotoStage)}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold"
                    >
                      <option value="sebelum">Foto Sebelum Dicuci</option>
                      <option value="sesudah">Foto Setelah Selesai</option>
                    </select>
                    <input
                      type="text"
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder="Keterangan foto (mis. kondisi noda / hasil lipatan)"
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer">
                      <Camera className="w-4 h-4" />
                      {uploadingPhoto ? 'Mengunggah...' : 'Ambil Foto Kamera'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={uploadingPhoto}
                        onChange={handleUploadClothingPhoto}
                        className="hidden"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Pilih File Foto
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingPhoto}
                        onChange={handleUploadClothingPhoto}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {photos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    Belum ada foto dokumentasi untuk pesanan ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="rounded-2xl border border-sky-100 bg-white overflow-hidden"
                      >
                        <div className="relative aspect-[4/3] bg-slate-100">
                          <img
                            src={getAdminProtectedAssetUrl(photo.imageUrl)}
                            alt={photo.caption || 'Foto pakaian pelanggan'}
                            className="w-full h-full object-cover"
                          />
                          <span
                            className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              photo.photoStage === 'sesudah'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-sky-700 text-white'
                            }`}
                          >
                            {photo.photoStage === 'sesudah' ? 'Sesudah' : 'Sebelum'}
                          </span>
                        </div>
                        <div className="p-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">
                              {photo.caption || 'Tanpa keterangan'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(photo.createdAt).toLocaleString('id-ID')}
                            </p>
                          </div>
                          {confirmDeletePhotoId === photo.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold shrink-0"
                            >
                              Hapus!
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePhotoId(photo.id)}
                              aria-label="Hapus foto pakaian"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status History Log */}
              <div className="rounded-2xl border border-sky-100 bg-[#F8FBFF] p-4 space-y-3">
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Riwayat Perubahan Status
                </h3>
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-xl bg-white border border-sky-100 px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <div>
                        <span className="font-bold text-sky-800">{getStageLabel(h.status)}</span>
                        <span className="text-slate-600"> — {h.description}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {new Date(h.createdAt).toLocaleString('id-ID')} · {h.updatedBy}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

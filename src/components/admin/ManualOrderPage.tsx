import { useEffect, useState } from 'react';
import {
  Calculator,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Minus,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  calculateEstimatedPrice,
  CLOTHING_CATEGORIES,
  CLOTHING_CONDITIONS,
  formatRupiah,
  formatWeightKg,
  parseWeightInput,
  sumOrderItemsWeight,
} from '../../lib/laundryRules';
import type {
  OrderSource,
  OrderStatusCode,
  PaymentStatus,
  PhotoStage,
  ServiceItem,
} from '../../lib/laundryRules';
import { createSupabaseManualOrder } from '../../lib/supabaseAdmin';
import type { OrderRecordClient } from '../../types';

interface ManualOrderPageProps {
  services: ServiceItem[];
  onOrderSaved: (order: OrderRecordClient) => void;
  onOpenOrderDetail: (orderId: string) => void;
}

interface DraftClothingRow {
  localId: string;
  category: string;
  quantity: number;
  weightStr: string;
  conditionNote: string;
  specialNote: string;
}

interface DraftPhotoRow {
  localId: string;
  dataUrl: string;
  photoStage: PhotoStage;
  caption: string;
}

const PICKUP_SLOTS = [
  'Workshop / Langsung',
  '08:00 - 10:00 WIB',
  '10:00 - 13:00 WIB',
  '13:00 - 16:00 WIB',
  '16:00 - 19:00 WIB',
];

function createBlankRow(): DraftClothingRow {
  return {
    localId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: CLOTHING_CATEGORIES[0],
    quantity: 1,
    weightStr: '1',
    conditionNote: CLOTHING_CONDITIONS[0],
    specialNote: '',
  };
}

export function ManualOrderPage({
  services,
  onOrderSaved,
  onOpenOrderDetail,
}: ManualOrderPageProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [orderSource, setOrderSource] = useState<OrderSource>('manual');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('belum_dibayar');
  const [initialStatus, setInitialStatus] = useState<OrderStatusCode>('CUCIAN_DITERIMA_DI_HUZAVIN');
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pickupTime, setPickupTime] = useState(PICKUP_SLOTS[0]);
  const [totalWeightStr, setTotalWeightStr] = useState('1');
  const [manualWeightOverride, setManualWeightOverride] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftClothingRow[]>([createBlankRow()]);
  const [photos, setPhotos] = useState<DraftPhotoRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedOrder, setSavedOrder] = useState<OrderRecordClient | null>(null);

  useEffect(() => {
    if (!serviceId && services.length > 0) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  const itemWeightSum = sumOrderItemsWeight(
    items.map((item) => ({ weightKg: parseWeightInput(item.weightStr) }))
  );

  useEffect(() => {
    if (!manualWeightOverride) {
      setTotalWeightStr(String(itemWeightSum >= 1 ? itemWeightSum : 1));
    }
  }, [itemWeightSum, manualWeightOverride]);

  const selectedService = services.find((s) => s.id === serviceId) ?? services[0];
  const parsedWeight = parseWeightInput(totalWeightStr);
  const calculatedTotal = selectedService
    ? calculateEstimatedPrice(parsedWeight, selectedService.pricePerKg)
    : 0;
  const totalPieceCount = items.reduce((s, r) => s + Math.max(1, r.quantity), 0);

  function handleUpdateItem(idx: number, patch: Partial<DraftClothingRow>) {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(`Ukuran foto "${file.name}" melebihi 5 MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos((prev) => [
            ...prev,
            {
              localId: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              dataUrl: reader.result as string,
              photoStage: 'sebelum',
              caption: 'Foto pakaian masuk',
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg('Nama pelanggan dan nomor WhatsApp wajib diisi.');
      return;
    }
    if (parsedWeight < 1) {
      setErrorMsg('Berat cucian minimal 1 kg.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSupabaseManualOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pickupAddress: pickupAddress.trim(),
        serviceId: selectedService?.id ?? serviceId,
        orderSource,
        paymentStatus,
        initialStatus,
        pickupDate,
        pickupTime,
        totalWeightKg: parsedWeight,
        notes: notes.trim(),
        items: items.map((item) => ({
          category: item.category,
          quantity: Math.max(1, item.quantity),
          weightKg: parseWeightInput(item.weightStr),
          conditionNote: item.conditionNote,
          specialNote: item.specialNote.trim(),
        })),
        photos: photos.map((p) => ({
          dataUrl: p.dataUrl,
          photoStage: p.photoStage,
          caption: p.caption.trim(),
        })),
      });

      setSavedOrder(created);
      onOrderSaved(created);

      setCustomerName('');
      setCustomerPhone('');
      setPickupAddress('');
      setNotes('');
      setManualWeightOverride(false);
      setItems([createBlankRow()]);
      setPhotos([]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan pesanan ke Supabase.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6">
        <h2 className="font-display font-bold text-lg sm:text-2xl text-[#0F2744]">
          Tambah Pesanan Manual
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Formulir khusus admin untuk mencatat cucian pelanggan yang datang langsung ke workshop atau memesan via WhatsApp. Kode order unik otomatis dibuat dan dapat langsung dilacak pelanggan.
        </p>
      </div>

      {savedOrder && (
        <div
          role="status"
          className="rounded-3xl bg-emerald-50 border border-emerald-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-base text-emerald-950">
                Pesanan {savedOrder.orderCode} Berhasil Disimpan!
              </p>
              <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                Pelanggan: <strong>{savedOrder.customerName}</strong> · {savedOrder.serviceName} ({formatWeightKg(savedOrder.estimatedWeight)}) ·{' '}
                <strong>{formatRupiah(savedOrder.estimatedPrice)}</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenOrderDetail(savedOrder.id)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Lihat Detail Order
            </button>
            <button
              type="button"
              onClick={() => setSavedOrder(null)}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-800 text-xs font-semibold"
            >
              Tutup Info
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-12 gap-5 items-start">
        {/* Left Main Form */}
        <div className="lg:col-span-8 rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
              1. Informasi Pelanggan
            </h3>

            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="page-manual-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  id="page-manual-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Ibu Rina / Bapak Ahmad"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="page-manual-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  id="page-manual-phone"
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label htmlFor="page-manual-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Lengkap
              </label>
              <textarea
                id="page-manual-address"
                rows={2}
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Isi alamat penjemputan/pengantaran (atau kosongkan bila datang & ambil di workshop)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
              />
            </div>
          </div>

          {/* Service & Schedule */}
          <div className="space-y-4 pt-4 border-t border-sky-100">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
              2. Layanan, Berat &amp; Jadwal Pickup
            </h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="page-manual-service" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jenis Layanan <span className="text-red-500">*</span>
                </label>
                <select
                  id="page-manual-service"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full min-h-[46px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatRupiah(s.pricePerKg)}/kg)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="page-manual-weight" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Berat Cucian (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  id="page-manual-weight"
                  type="text"
                  inputMode="decimal"
                  value={totalWeightStr}
                  onChange={(e) => {
                    setManualWeightOverride(true);
                    setTotalWeightStr(e.target.value);
                  }}
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-200 font-bold text-sm tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="page-manual-source" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sumber Order
                </label>
                <select
                  id="page-manual-source"
                  value={orderSource}
                  onChange={(e) => setOrderSource(e.target.value as OrderSource)}
                  className="w-full min-h-[46px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="manual">Datang Langsung</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label htmlFor="page-manual-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal Pickup / Masuk
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <input
                    id="page-manual-date"
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full min-h-[46px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="page-manual-time" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jadwal Jam
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <select
                    id="page-manual-time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full min-h-[46px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    {PICKUP_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="page-manual-pay" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pembayaran
                </label>
                <select
                  id="page-manual-pay"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full min-h-[46px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="belum_dibayar">Belum Dibayar</option>
                  <option value="lunas">Sudah Lunas</option>
                </select>
              </div>

              <div>
                <label htmlFor="page-manual-status" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status Awal
                </label>
                <select
                  id="page-manual-status"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as OrderStatusCode)}
                  className="w-full min-h-[46px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="CUCIAN_DITERIMA_DI_HUZAVIN">Cucian Diterima</option>
                  <option value="SEDANG_DICUCI">Sedang Dicuci</option>
                  <option value="MENUNGGU_PENJEMPUTAN">Menunggu Pickup</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clothing Items */}
          <div className="space-y-3 pt-4 border-t border-sky-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
                3. Jenis &amp; Jumlah Pakaian ({items.length} baris)
              </h3>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, createBlankRow()])}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                Tambah Jenis Pakaian
              </button>
            </div>

            <div className="space-y-3">
              {items.map((row, idx) => (
                <div
                  key={row.localId}
                  className="rounded-2xl bg-[#F8FBFF] border border-sky-200/80 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-900">Item Pakaian #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Jenis Pakaian
                      </label>
                      <select
                        value={row.category}
                        onChange={(e) => handleUpdateItem(idx, { category: e.target.value })}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        {CLOTHING_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Jumlah Pakaian (pcs)
                      </label>
                      <div className="flex items-center h-[44px] rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItem(idx, { quantity: Math.max(1, row.quantity - 1) })
                          }
                          aria-label="Kurangi jumlah"
                          className="w-10 h-full flex items-center justify-center text-slate-600 hover:bg-sky-50"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, {
                              quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="w-full text-center text-sm font-bold tabular-nums outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItem(idx, { quantity: row.quantity + 1 })}
                          aria-label="Tambah jumlah"
                          className="w-10 h-full flex items-center justify-center text-slate-600 hover:bg-sky-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Berat (kg)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.weightStr}
                        onChange={(e) => handleUpdateItem(idx, { weightStr: e.target.value })}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kondisi
                      </label>
                      <select
                        value={row.conditionNote}
                        onChange={(e) => handleUpdateItem(idx, { conditionNote: e.target.value })}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        {CLOTHING_CONDITIONS.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes & Photo */}
          <div className="space-y-4 pt-4 border-t border-sky-100">
            <div>
              <label htmlFor="page-manual-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan Pesanan
              </label>
              <input
                id="page-manual-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pisahkan baju putih, pewangi ekstra lembut"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold cursor-pointer">
                <Camera className="w-4 h-4" />
                Ambil Foto Kamera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer">
                <Upload className="w-4 h-4" />
                Pilih Foto Pakaian
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((ph, idx) => (
                  <div key={ph.localId} className="relative rounded-xl overflow-hidden border border-sky-200 aspect-[4/3]">
                    <img src={ph.dataUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((x) => x.localId !== ph.localId))}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Auto Price Calculator + Submit */}
        <aside className="lg:col-span-4 rounded-3xl bg-white border border-sky-200 p-5 sm:p-6 space-y-5 shadow-xs lg:sticky lg:top-20">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-base text-[#0F2744]">
                Kalkulator Harga Otomatis
              </h3>
              <p className="text-xs text-slate-500">Hitung otomatis biaya cucian</p>
            </div>
          </div>

          <dl className="rounded-2xl bg-[#F8FBFF] border border-sky-100 p-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Layanan</dt>
              <dd className="font-bold text-[#0F2744]">{selectedService?.name ?? '-'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Tarif per kg</dt>
              <dd className="font-semibold tabular-nums">
                {formatRupiah(selectedService?.pricePerKg ?? 0)}/kg
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Total item pakaian</dt>
              <dd className="font-semibold tabular-nums">{totalPieceCount} pcs</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Berat cucian</dt>
              <dd className="font-bold tabular-nums">{formatWeightKg(parsedWeight)}</dd>
            </div>
            <div className="pt-2.5 border-t border-sky-200 flex items-baseline justify-between gap-2">
              <dt className="font-bold text-slate-800">Total Harga</dt>
              <dd className="font-display font-extrabold text-2xl text-sky-700 tabular-nums">
                {formatRupiah(calculatedTotal)}
              </dd>
            </div>
          </dl>

          {manualWeightOverride && (
            <button
              type="button"
              onClick={() => setManualWeightOverride(false)}
              className="w-full py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold"
            >
              Sinkronkan berat dari item ({itemWeightSum} kg)
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-extrabold text-sm shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            {submitting ? 'MENYIMPAN PESANAN...' : 'SIMPAN PESANAN'}
          </button>
        </aside>
      </form>
    </section>
  );
}

import { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
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

interface ManualOrderModalProps {
  open: boolean;
  services: ServiceItem[];
  onClose: () => void;
  onCreated: (order: OrderRecordClient) => void;
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

export function ManualOrderModal({
  open,
  services,
  onClose,
  onCreated,
}: ManualOrderModalProps) {
  const defaultServiceId = services[0]?.id ?? '';

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [serviceId, setServiceId] = useState(defaultServiceId);
  const [orderSource, setOrderSource] = useState<OrderSource>('manual');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('belum_dibayar');
  const [initialStatus, setInitialStatus] = useState<OrderStatusCode>('CUCIAN_DITERIMA_DI_HUZAVIN');
  const [totalWeightStr, setTotalWeightStr] = useState('1');
  const [manualWeightOverride, setManualWeightOverride] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftClothingRow[]>([createBlankRow()]);
  const [photos, setPhotos] = useState<DraftPhotoRow[]>([]);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      setServiceId((prev) => prev || services[0]?.id || '');
    }
  }, [open, services]);

  const itemWeightSum = sumOrderItemsWeight(
    items.map((item) => ({ weightKg: parseWeightInput(item.weightStr) }))
  );

  useEffect(() => {
    if (!manualWeightOverride) {
      const nextWeight = itemWeightSum >= 1 ? itemWeightSum : 1;
      setTotalWeightStr(String(nextWeight));
    }
  }, [itemWeightSum, manualWeightOverride]);

  if (!open) return null;

  const selectedService = services.find((s) => s.id === serviceId) ?? services[0];
  const finalWeight = parseWeightInput(totalWeightStr);
  const calculatedPrice = selectedService
    ? calculateEstimatedPrice(finalWeight, selectedService.pricePerKg)
    : 0;

  function resetForm() {
    setCustomerName('');
    setCustomerPhone('');
    setPickupAddress('');
    setServiceId(services[0]?.id ?? '');
    setOrderSource('manual');
    setPaymentStatus('belum_dibayar');
    setInitialStatus('CUCIAN_DITERIMA_DI_HUZAVIN');
    setTotalWeightStr('1');
    setManualWeightOverride(false);
    setNotes('');
    setItems([createBlankRow()]);
    setPhotos([]);
    setConfirmDeleteIdx(null);
    setErrorMsg('');
  }

  function handleUpdateItem(idx: number, patch: Partial<DraftClothingRow>) {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function handleRemoveItem(idx: number) {
    if (items.length <= 1) {
      setErrorMsg('Minimal harus terdapat 1 item pakaian dalam pesanan.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

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
              caption: 'Kondisi pakaian sebelum dicuci',
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

    if (finalWeight < 1) {
      setErrorMsg('Total berat cucian minimal 1 kg.');
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
        totalWeightKg: finalWeight,
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

      resetForm();
      onCreated(created);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pesanan manual ke Supabase.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-order-title"
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="w-full sm:max-w-3xl bg-white sm:rounded-3xl rounded-t-3xl border border-sky-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-600 to-sky-700 text-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 id="manual-order-title" className="font-display font-bold text-lg sm:text-xl">
              + Tambah Pesanan Manual
            </h2>
            <p className="text-xs text-sky-100 mt-0.5">
              Input order pelanggan datang langsung atau via WhatsApp lengkap dengan rincian pakaian &amp; foto
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form pesanan manual"
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div role="alert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
              1. Data Pelanggan &amp; Sumber Order
            </h3>

            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="manual-cust-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  id="manual-cust-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Pak Budi / Ibu Sari"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="manual-cust-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  id="manual-cust-phone"
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="manual-source" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sumber Pesanan
                </label>
                <select
                  id="manual-source"
                  value={orderSource}
                  onChange={(e) => setOrderSource(e.target.value as OrderSource)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-sky-500 outline-none text-sm"
                >
                  <option value="manual">Datang Langsung ke Workshop</option>
                  <option value="whatsapp">Order via WhatsApp</option>
                </select>
              </div>

              <div>
                <label htmlFor="manual-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Pengantaran / Asal
                </label>
                <input
                  id="manual-address"
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Opsional (kosongkan jika ambil di tempat)"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Service & Payment */}
          <div className="space-y-4 pt-2 border-t border-sky-100">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
              2. Layanan &amp; Pembayaran
            </h3>

            <div className="grid sm:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="manual-service" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jenis Layanan <span className="text-red-500">*</span>
                </label>
                <select
                  id="manual-service"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-sky-500 outline-none text-sm"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatRupiah(s.pricePerKg)}/kg)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manual-payment" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status Pembayaran
                </label>
                <select
                  id="manual-payment"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-sky-500 outline-none text-sm"
                >
                  <option value="belum_dibayar">Belum Dibayar</option>
                  <option value="lunas">Sudah Lunas</option>
                </select>
              </div>

              <div>
                <label htmlFor="manual-initial-status" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status Awal Pengerjaan
                </label>
                <select
                  id="manual-initial-status"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as OrderStatusCode)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-sky-500 outline-none text-sm"
                >
                  <option value="CUCIAN_DITERIMA_DI_HUZAVIN">Cucian Diterima di Huzavin</option>
                  <option value="SEDANG_DICUCI">Langsung Sedang Dicuci</option>
                  <option value="MENUNGGU_PENJEMPUTAN">Menunggu Penjemputan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clothing Items List */}
          <div className="space-y-3 pt-2 border-t border-sky-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
                3. Daftar Jenis Pakaian ({items.length} item)
              </h3>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, createBlankRow()])}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tambah Jenis Pakaian
              </button>
            </div>

            <div className="space-y-3">
              {items.map((row, idx) => (
                <div
                  key={row.localId}
                  className="rounded-2xl bg-[#F8FBFF] border border-sky-200/80 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-sky-900">Item #{idx + 1}</span>
                    {confirmDeleteIdx === idx ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-red-700 font-semibold">Hapus item?</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteIdx(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-semibold"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIdx(idx)}
                        disabled={items.length <= 1}
                        aria-label={`Hapus item ${idx + 1}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
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
                        Jumlah (pcs)
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
                        placeholder="0.5"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kondisi Pakaian
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

                  <div>
                    <input
                      type="text"
                      value={row.specialNote}
                      onChange={(e) => handleUpdateItem(idx, { specialNote: e.target.value })}
                      placeholder="Catatan khusus item ini (opsional, misal: luntur / jangan pakai pemutih)"
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Weight & Price Summary */}
          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3.5 items-end">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="manual-total-weight" className="text-xs font-bold text-slate-800">
                    Total Berat Timbangan (kg) <span className="text-red-500">*</span>
                  </label>
                  {manualWeightOverride && (
                    <button
                      type="button"
                      onClick={() => setManualWeightOverride(false)}
                      className="text-[11px] font-semibold text-sky-700 hover:underline"
                    >
                      Hitung ulang otomatis ({itemWeightSum} kg)
                    </button>
                  )}
                </div>
                <input
                  id="manual-total-weight"
                  type="text"
                  inputMode="decimal"
                  value={totalWeightStr}
                  onChange={(e) => {
                    setManualWeightOverride(true);
                    setTotalWeightStr(e.target.value);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-sky-300 bg-white font-bold text-base tabular-nums outline-none focus:border-sky-600"
                />
              </div>

              <div className="rounded-xl bg-white border border-sky-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Harga Otomatis:</span>
                <span className="font-display font-extrabold text-xl text-sky-700 tabular-nums">
                  {formatRupiah(calculatedPrice)}
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="manual-order-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Pesanan Umum
              </label>
              <input
                id="manual-order-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Pelanggan minta parfum ekstra lembut"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-sky-200 bg-white text-sm"
              />
            </div>
          </div>

          {/* Photo Documentation Upload */}
          <div className="space-y-3 pt-2 border-t border-sky-100">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-sky-800">
              4. Foto Dokumentasi Sebelum Dicuci (Opsional)
            </h3>

            <div className="flex flex-wrap gap-2.5">
              <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer transition-colors">
                <Camera className="w-4 h-4" />
                Ambil Foto Kamera HP
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>

              <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Pilih dari Galeri
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
                {photos.map((photo, idx) => (
                  <div
                    key={photo.localId}
                    className="rounded-2xl border border-sky-200 bg-white overflow-hidden"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <img
                        src={photo.dataUrl}
                        alt={`Foto pakaian ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.filter((p) => p.localId !== photo.localId))
                        }
                        aria-label="Hapus foto"
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-2">
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) =>
                          setPhotos((prev) =>
                            prev.map((p) =>
                              p.localId === photo.localId ? { ...p, caption: e.target.value } : p
                            )
                          )
                        }
                        placeholder="Keterangan foto..."
                        className="w-full text-[11px] px-2 py-1 rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-sky-100 flex flex-col-reverse sm:flex-row gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white text-sm font-bold shadow-md shadow-sky-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Menyimpan Pesanan...' : 'SIMPAN PESANAN MANUAL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

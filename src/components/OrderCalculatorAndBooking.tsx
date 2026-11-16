import { useEffect, useState } from 'react';
import {
  BookmarkCheck,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  buildCalculatorWhatsappUrl,
  buildOrderWhatsappUrl,
  calculateEstimatedPrice,
  formatRupiah,
  formatWeightKg,
  getLastFourDigits,
  parseWeightInput,
  validateOrderInput,
} from '../lib/laundryRules';
import type { ServiceItem, SiteSettings } from '../lib/laundryRules';
import type { LocalSavedOrder, OrderRecordClient } from '../types';

interface OrderCalculatorAndBookingProps {
  services: ServiceItem[];
  settings: SiteSettings;
  preselectedServiceId: string | null;
  onOrderCreated: (saved: LocalSavedOrder) => void;
  onJumpToTracker: (orderCode: string) => void;
}

const PICKUP_SLOTS = [
  '08:00 - 10:00 WIB',
  '10:00 - 13:00 WIB',
  '13:00 - 16:00 WIB',
  '16:00 - 19:00 WIB',
];

function getDefaultPickupDate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function OrderCalculatorAndBooking({
  services,
  settings,
  preselectedServiceId,
  onOrderCreated,
  onJumpToTracker,
}: OrderCalculatorAndBookingProps) {
  const defaultServiceId = services[0]?.id ?? 'cuci-kering';

  // Calculator state
  const [calcServiceId, setCalcServiceId] = useState(defaultServiceId);
  const [calcWeightStr, setCalcWeightStr] = useState('3');
  const [calcCustomerName, setCalcCustomerName] = useState('');

  // Order / Pickup Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLandmark, setPickupLandmark] = useState('');
  const [orderServiceId, setOrderServiceId] = useState(defaultServiceId);
  const [orderWeightStr, setOrderWeightStr] = useState('2');
  const [pickupDate, setPickupDate] = useState(getDefaultPickupDate);
  const [pickupTime, setPickupTime] = useState(PICKUP_SLOTS[0]);
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<OrderRecordClient | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (services.length > 0 && !services.some((s) => s.id === calcServiceId)) {
      setCalcServiceId(services[0].id);
    }
    if (services.length > 0 && !services.some((s) => s.id === orderServiceId)) {
      setOrderServiceId(services[0].id);
    }
  }, [services, calcServiceId, orderServiceId]);

  useEffect(() => {
    if (preselectedServiceId && services.some((s) => s.id === preselectedServiceId)) {
      setOrderServiceId(preselectedServiceId);
      setCalcServiceId(preselectedServiceId);
    }
  }, [preselectedServiceId, services]);

  const activeCalcService = services.find((s) => s.id === calcServiceId) ?? services[0];
  const calcWeight = parseWeightInput(calcWeightStr);
  const calcEstimatedTotal = activeCalcService
    ? calculateEstimatedPrice(calcWeight, activeCalcService.pricePerKg)
    : 0;

  const activeOrderService = services.find((s) => s.id === orderServiceId) ?? services[0];
  const orderWeight = parseWeightInput(orderWeightStr);
  const orderEstimatedTotal = activeOrderService
    ? calculateEstimatedPrice(orderWeight, activeOrderService.pricePerKg)
    : 0;

  const calcWhatsappUrl = activeCalcService
    ? buildCalculatorWhatsappUrl({
        whatsappRaw: settings.whatsappRaw,
        customerName: calcCustomerName,
        serviceName: activeCalcService.name,
        weightKg: calcWeight >= 1 ? calcWeight : 1,
        estimatedPrice:
          calcWeight >= 1
            ? calcEstimatedTotal
            : calculateEstimatedPrice(1, activeCalcService.pricePerKg),
      })
    : '#';

  function handleSyncCalculatorToForm() {
    setOrderServiceId(calcServiceId);
    setOrderWeightStr(calcWeight >= 1 ? String(calcWeight) : '1');
    if (calcCustomerName.trim()) {
      setCustomerName(calcCustomerName.trim());
    }
    const formEl = document.getElementById('form-booking-pickup');
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const parsedWeight = parseWeightInput(orderWeightStr);
    const validation = validateOrderInput({
      customerName,
      customerPhone,
      pickupAddress,
      pickupLandmark,
      serviceId: orderServiceId,
      estimatedWeight: parsedWeight,
      pickupDate,
      pickupTime,
      notes,
    });

    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setSubmitError('Mohon periksa kembali data yang wajib diisi di formulir.');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          pickupAddress: pickupAddress.trim(),
          pickupLandmark: pickupLandmark.trim(),
          serviceId: orderServiceId,
          estimatedWeight: parsedWeight,
          pickupDate,
          pickupTime,
          notes: notes.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.errors) setFieldErrors(data.errors);
        setSubmitError(data.error || 'Gagal menyimpan pesanan. Silakan coba lagi.');
        return;
      }

      const order = data.order as OrderRecordClient;
      setCreatedOrder(order);
      onOrderCreated({
        orderCode: order.orderCode,
        last4Phone: getLastFourDigits(order.customerPhone),
        serviceName: order.serviceName,
        createdAt: order.createdAt,
      });
    } catch {
      setSubmitError('Terjadi kendala koneksi saat menyimpan pesanan. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyOrderCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setCopiedCode(false);
    }
  }

  return (
    <section id="kalkulator" className="scroll-mt-16 py-14 sm:py-20 bg-[#F8FBFF] border-t border-sky-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold text-sky-600 mb-2">Hitung &amp; Pesan Online</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight text-balance">
            Kalkulator Harga Otomatis &amp; Booking Penjemputan Gratis
          </h2>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: KALKULATOR HARGA OTOMATIS */}
          <div className="lg:col-span-5 rounded-3xl bg-white border border-sky-200 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-slate-900">Kalkulator Harga Laundry</h3>
                <p className="text-xs sm:text-sm text-slate-500">Hitung estimasi biaya secara real-time</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Pilih Jenis Layanan</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {services.map((service) => {
                    const selected = service.id === calcServiceId;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setCalcServiceId(service.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          selected
                            ? 'bg-sky-50 border-sky-500 text-sky-950 ring-1 ring-sky-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
                        }`}
                      >
                        <div className="font-display font-bold text-sm">{service.name}</div>
                        <div className="text-xs text-sky-700 font-semibold mt-0.5 tabular-nums">
                          {formatRupiah(service.pricePerKg)}/kg
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="calc-weight-input" className="block text-sm font-semibold text-slate-800 mb-2">
                  Perkiraan Berat Cucian (kg)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="calc-weight-input"
                    type="text"
                    inputMode="decimal"
                    value={calcWeightStr}
                    onChange={(e) => setCalcWeightStr(e.target.value)}
                    placeholder="Contoh: 2.5"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-base font-semibold text-slate-900 tabular-nums"
                  />
                  <span className="px-3.5 py-3 rounded-xl bg-sky-50 text-sky-800 font-bold text-sm border border-sky-100">
                    kg
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {['1', '1.5', '2.5', '3', '5'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCalcWeightStr(preset)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 transition-colors tabular-nums"
                    >
                      {preset.replace('.', ',')} kg
                    </button>
                  ))}
                </div>
                {calcWeight > 0 && calcWeight < 1 && (
                  <p className="text-xs text-amber-700 mt-2">Minimal berat order adalah 1 kg.</p>
                )}
              </div>

              <div>
                <label htmlFor="calc-name-input" className="block text-sm font-semibold text-slate-800 mb-2">
                  Nama Anda (Opsional)
                </label>
                <input
                  id="calc-name-input"
                  type="text"
                  value={calcCustomerName}
                  onChange={(e) => setCalcCustomerName(e.target.value)}
                  placeholder="Contoh: Ibu Rina"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm text-slate-900"
                />
              </div>

              {/* Live Calculation Display */}
              <div className="rounded-2xl bg-sky-50 border border-sky-200 p-5">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>{activeCalcService?.name ?? 'Layanan'}</span>
                  <span className="tabular-nums">
                    {calcWeight >= 1 ? formatWeightKg(calcWeight) : 'Min. 1 kg'} ×{' '}
                    {formatRupiah(activeCalcService?.pricePerKg ?? 0)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">Estimasi Total:</span>
                  <span
                    data-testid="calculator-total"
                    className="font-display font-extrabold text-3xl text-sky-700 tabular-nums"
                  >
                    {formatRupiah(calcEstimatedTotal)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  * Hasil merupakan estimasi harga sebelum penimbangan akhir oleh tim Laundry Huzavin.
                </p>
              </div>

              <div className="space-y-2.5">
                <a
                  href={calcWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  LANJUT ORDER VIA WHATSAPP
                </a>

                <button
                  type="button"
                  onClick={handleSyncCalculatorToForm}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-yellow-100/80 hover:bg-yellow-200/80 text-slate-900 font-semibold text-sm border border-yellow-300/70 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-amber-700" aria-hidden="true" />
                  Gunakan Estimasi Ini untuk Booking Pickup
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: FORM ORDER & BOOKING PICKUP LANGSUNG */}
          <div
            id="form-booking-pickup"
            className="scroll-mt-20 lg:col-span-7 rounded-3xl bg-white border border-sky-200 p-6 sm:p-8 shadow-xs"
          >
            <div className="mb-6">
              <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900">
                Buat Pesanan &amp; Booking Jemput Cucian
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Pesanan Anda otomatis tercatat ke sistem untuk mendapatkan <strong>Kode Order</strong> dan diteruskan ke WhatsApp admin.
              </p>
            </div>

            {createdOrder ? (
              <div
                data-testid="order-success-card"
                className="rounded-2xl bg-sky-50/70 border border-sky-200 p-6 space-y-5"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-lg text-slate-900">
                      Pesanan Berhasil Dicatat di Sistem!
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Pesanan Anda berstatus <strong>Order Diterima</strong>. Silakan tekan tombol WhatsApp di bawah untuk mengirim detail pesanan ini agar admin Huzavin segera menjadwalkan penjemputan.
                    </p>
                  </div>
                </div>

                {/* Order Code Highlight */}
                <div className="rounded-2xl bg-white border border-sky-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Kode Order Unik Anda</p>
                    <p
                      data-testid="created-order-code"
                      className="font-mono font-bold text-2xl text-sky-700 tracking-wide mt-0.5"
                    >
                      {createdOrder.orderCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyOrderCode(createdOrder.orderCode)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedCode ? (
                      <>
                        <BookmarkCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        KODE DISALIN!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        SIMPAN KODE ORDER
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs font-medium text-sky-800 bg-sky-100/70 px-3.5 py-2.5 rounded-xl">
                  Simpan kode pesanan Anda untuk memudahkan pengecekan status laundry secara real-time.
                </p>

                {/* Order Summary Grid */}
                <dl className="grid sm:grid-cols-2 gap-3 text-sm bg-white rounded-2xl border border-sky-100 p-4">
                  <div>
                    <dt className="text-xs text-slate-500">Nama Pelanggan</dt>
                    <dd className="font-semibold text-slate-900">{createdOrder.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Layanan &amp; Berat Perkiraan</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">
                      {createdOrder.serviceName} · {formatWeightKg(createdOrder.estimatedWeight)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Jadwal Penjemputan</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">
                      {createdOrder.pickupDate} ({createdOrder.pickupTime})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Estimasi Biaya</dt>
                    <dd className="font-bold text-sky-700 tabular-nums">
                      {formatRupiah(createdOrder.estimatedPrice)}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={buildOrderWhatsappUrl({
                      whatsappRaw: settings.whatsappRaw,
                      orderCode: createdOrder.orderCode,
                      customerName: createdOrder.customerName,
                      customerPhone: createdOrder.customerPhone,
                      serviceName: createdOrder.serviceName,
                      estimatedWeight: createdOrder.estimatedWeight,
                      estimatedPrice: createdOrder.estimatedPrice,
                      pickupAddress: createdOrder.pickupAddress,
                      pickupLandmark: createdOrder.pickupLandmark,
                      pickupDate: createdOrder.pickupDate,
                      pickupTime: createdOrder.pickupTime,
                      notes: createdOrder.notes,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    KIRIM KONFIRMASI VIA WHATSAPP
                  </a>

                  <button
                    type="button"
                    onClick={() => onJumpToTracker(createdOrder.orderCode)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 font-bold text-sm transition-colors"
                  >
                    <Search className="w-4 h-4" aria-hidden="true" />
                    LACAK PESANAN
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCreatedOrder(null)}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  + Buat pesanan laundry lainnya
                </button>
              </div>
            ) : (
              <form onSubmit={handleOrderSubmit} noValidate className="space-y-4">
                {submitError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium"
                  >
                    {submitError}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="order-name" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="order-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Masukkan nama Anda"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                    />
                    {fieldErrors.customerName && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.customerName}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="order-phone" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Nomor WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="order-phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm tabular-nums"
                    />
                    {fieldErrors.customerPhone && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.customerPhone}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="order-address" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Alamat Penjemputan Lengkap <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="order-address"
                    rows={2}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Jalan, nomor rumah, RT/RW, kelurahan (contoh: Kampung Kupu RT 02/04, Pasir Putih)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                  />
                  {fieldErrors.pickupAddress && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.pickupAddress}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="order-landmark" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Patokan Lokasi
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" aria-hidden="true" />
                    <input
                      id="order-landmark"
                      type="text"
                      value={pickupLandmark}
                      onChange={(e) => setPickupLandmark(e.target.value)}
                      placeholder="Contoh: Pagar biru depan warung / dekat masjid"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="order-service" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Pilihan Layanan <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="order-service"
                      value={orderServiceId}
                      onChange={(e) => setOrderServiceId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatRupiah(s.pricePerKg)}/kg)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="order-weight" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Perkiraan Berat Cucian (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="order-weight"
                      type="text"
                      inputMode="decimal"
                      value={orderWeightStr}
                      onChange={(e) => setOrderWeightStr(e.target.value)}
                      placeholder="Minimal 1 kg (bisa desimal, mis. 2.5)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm tabular-nums"
                    />
                    {fieldErrors.estimatedWeight && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.estimatedWeight}</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="order-date" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Tanggal Penjemputan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" aria-hidden="true" />
                      <input
                        id="order-date"
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm tabular-nums"
                      />
                    </div>
                    {fieldErrors.pickupDate && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.pickupDate}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="order-time" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Jam Penjemputan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" aria-hidden="true" />
                      <select
                        id="order-time"
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                      >
                        {PICKUP_SLOTS.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="order-notes" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Catatan Tambahan
                  </label>
                  <input
                    id="order-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Pisahkan pakaian putih, pewangi lembut"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                  />
                </div>

                <div className="rounded-2xl bg-sky-50/80 border border-sky-100 px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm text-slate-600">
                    Estimasi biaya ({activeOrderService?.name ?? 'Layanan'},{' '}
                    {orderWeight >= 1 ? formatWeightKg(orderWeight) : 'min. 1 kg'}):
                  </span>
                  <span className="font-display font-extrabold text-lg text-sky-700 tabular-nums">
                    {formatRupiah(orderEstimatedTotal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold text-sm sm:text-base transition-colors shadow-md shadow-sky-600/15"
                >
                  {submitting ? 'MENYIMPAN PESANAN...' : 'BUAT PESANAN SEKARANG'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

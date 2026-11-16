import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  buildGeneralWhatsappUrl,
  formatRupiah,
  formatWeightKg,
  getAdminDecisionLabel,
  getPaymentStatusLabel,
  getStageIndex,
  getVisibleStagesForService,
} from '../lib/laundryRules';
import type { SiteSettings } from '../lib/laundryRules';
import type { LocalSavedOrder, TrackedOrderPayload } from '../types';

interface OrderTrackerProps {
  settings: SiteSettings;
  savedOrders: LocalSavedOrder[];
  requestedOrderCode: string | null;
}

function formatDateTimeId(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderTracker({ settings, savedOrders, requestedOrderCode }: OrderTrackerProps) {
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tracked, setTracked] = useState<TrackedOrderPayload | null>(null);

  const [last4Input, setLast4Input] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const fetchOrder = useCallback(
    async (codeToFetch: string, silent = false) => {
      const normalized = codeToFetch.trim().toUpperCase();
      if (!normalized) {
        setErrorMsg('Silakan masukkan kode order Anda.');
        return;
      }

      if (!silent) {
        setLoading(true);
        setErrorMsg('');
      }

      try {
        const localMatch = savedOrders.find((o) => o.orderCode.toUpperCase() === normalized);
        const query = localMatch?.last4Phone ? `?last4=${encodeURIComponent(localMatch.last4Phone)}` : '';
        const res = await fetch(`/api/orders/track/${encodeURIComponent(normalized)}${query}`);
        const data = await res.json();

        if (!res.ok) {
          setTracked(null);
          setErrorMsg(
            data.error ||
              'Maaf, kode order tidak ditemukan. Silakan periksa kembali kode pesanan atau hubungi admin Huzavin.'
          );
          return;
        }

        setTracked(data as TrackedOrderPayload);
        setErrorMsg('');
      } catch {
        if (!silent) {
          setErrorMsg('Gagal memuat status pesanan. Silakan periksa koneksi Anda.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [savedOrders]
  );

  // Jump automatically when user clicks "Lacak Pesanan" right after creating an order
  useEffect(() => {
    if (requestedOrderCode) {
      setSearchCode(requestedOrderCode);
      fetchOrder(requestedOrderCode);
    }
  }, [requestedOrderCode, fetchOrder]);

  // Live Real-time Updates via SSE + safety poll when an order is open
  useEffect(() => {
    const activeCode = tracked?.order.orderCode;
    if (!activeCode) return;

    const es = new EventSource(`/api/orders/track/${encodeURIComponent(activeCode)}/stream`);
    es.addEventListener('status-update', () => {
      fetchOrder(activeCode, true);
    });

    const interval = setInterval(() => {
      fetchOrder(activeCode, true);
    }, 10000);

    return () => {
      es.close();
      clearInterval(interval);
    };
  }, [tracked?.order.orderCode, fetchOrder]);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError('');
    setLast4Input('');
    await fetchOrder(searchCode);
  }

  async function handleVerifyPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!tracked) return;
    setVerifyError('');
    setVerifying(true);

    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(tracked.order.orderCode)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4: last4Input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || 'Verifikasi gagal.');
        return;
      }

      setTracked((prev) =>
        prev
          ? {
              ...prev,
              verified: true,
              order: {
                ...prev.order,
                customerNameDisplay: data.customerName,
                pickupAddress: data.pickupAddress,
                pickupLandmark: data.pickupLandmark,
                notes: data.notes,
              },
            }
          : prev
      );
    } catch {
      setVerifyError('Terjadi kendala saat memverifikasi nomor.');
    } finally {
      setVerifying(false);
    }
  }

  const visibleStages = tracked ? getVisibleStagesForService(tracked.order.includesIroning) : [];
  const currentStageOrderIdx = tracked ? getStageIndex(tracked.order.status) : 0;

  return (
    <section id="lacak" className="scroll-mt-16 py-14 sm:py-20 bg-white border-t border-sky-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-9">
          <p className="text-sm font-semibold text-sky-600 mb-2">Tracking Real-Time</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
            LACAK CUCIAN KAMU
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Masukkan kode order Anda untuk memantau perkembangan proses laundry secara langsung tanpa perlu memuat ulang halaman.
          </p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto mb-6">
          <div className="flex flex-col sm:flex-row gap-2.5 p-2 rounded-2xl bg-sky-50 border border-sky-200">
            <label htmlFor="track-order-input" className="sr-only">
              Kode Order Laundry
            </label>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-sky-600 absolute left-4 top-3.5" aria-hidden="true" />
              <input
                id="track-order-input"
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Masukkan Kode Order (contoh: HZV-202611-0001)"
                className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-xl bg-white border border-sky-100 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none text-sm font-mono uppercase text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold text-sm transition-colors whitespace-nowrap shrink-0"
            >
              {loading ? 'Mencari...' : 'CEK STATUS'}
            </button>
          </div>
        </form>

        {/* Recent Saved Orders in This Browser */}
        {savedOrders.length > 0 && (
          <div className="max-w-2xl mx-auto mb-8 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Riwayat pesanan di perangkat ini:</span>
            {savedOrders.slice(0, 4).map((item) => (
              <button
                key={item.orderCode}
                type="button"
                onClick={() => {
                  setSearchCode(item.orderCode);
                  fetchOrder(item.orderCode);
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 font-mono font-semibold text-sky-800 transition-colors"
              >
                {item.orderCode}
              </button>
            ))}
          </div>
        )}

        {/* Friendly Not-Found / Validation Error */}
        {errorMsg && (
          <div
            role="alert"
            className="max-w-2xl mx-auto rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center space-y-3"
          >
            <p className="text-sm font-medium text-amber-900">{errorMsg}</p>
            <a
              href={buildGeneralWhatsappUrl(
                settings.whatsappRaw,
                `Halo Admin Laundry Huzavin, saya ingin menanyakan status cucian dengan kode: ${searchCode || '-'}`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              HUBUNGI ADMIN VIA WHATSAPP
            </a>
          </div>
        )}

        {/* Tracking Result & 10-Stage Visual Progress Timeline */}
        {tracked && (
          <div
            data-testid="tracking-result-card"
            className="rounded-3xl border border-sky-200 bg-[#F8FBFF] p-5 sm:p-8 space-y-8"
          >
            {/* Header Summary */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-sky-200/80">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                  <span className="font-mono font-bold text-sky-800">{tracked.order.orderCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>Masuk {formatDateTimeId(tracked.order.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Estimasi selesai 1–2 hari</span>
                </div>
                <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900">
                  {tracked.order.serviceName} — {tracked.order.customerNameDisplay}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border ${
                    tracked.order.status === 'PESANAN_SELESAI'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-sky-100 border-sky-300 text-sky-900'
                  }`}
                >
                  {visibleStages.find((s) => s.code === tracked.order.status)?.label ?? tracked.order.status}
                </div>
                <div
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
                    tracked.order.paymentStatus === 'lunas'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {getPaymentStatusLabel(tracked.order.paymentStatus)}
                </div>
                {tracked.order.adminDecision !== 'menunggu' && (
                  <div className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-sky-200 text-slate-700">
                    Admin: {getAdminDecisionLabel(tracked.order.adminDecision)}
                  </div>
                )}
              </div>
            </div>

            {/* Key Order Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-sky-100">
                <p className="text-xs text-slate-500">Berat Cucian</p>
                <p className="font-display font-bold text-base sm:text-lg text-slate-900 mt-0.5 tabular-nums">
                  {tracked.order.finalWeight !== null
                    ? `${formatWeightKg(tracked.order.finalWeight)} (Aktual)`
                    : `${formatWeightKg(tracked.order.estimatedWeight)} (Perkiraan)`}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-sky-100">
                <p className="text-xs text-slate-500">Total Pembayaran</p>
                <p className="font-display font-bold text-base sm:text-lg text-sky-700 mt-0.5 tabular-nums">
                  {tracked.order.finalPrice !== null
                    ? formatRupiah(tracked.order.finalPrice)
                    : `${formatRupiah(tracked.order.estimatedPrice)} (Est.)`}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-sky-100">
                <p className="text-xs text-slate-500">Jadwal Pickup</p>
                <p className="font-semibold text-sm text-slate-900 mt-0.5 tabular-nums">
                  {tracked.order.pickupDate}
                </p>
                <p className="text-xs text-slate-500">{tracked.order.pickupTime}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-sky-100">
                <p className="text-xs text-slate-500">Terakhir Diperbarui</p>
                <p className="font-semibold text-xs sm:text-sm text-slate-900 mt-0.5 tabular-nums">
                  {formatDateTimeId(tracked.order.updatedAt)}
                </p>
              </div>
            </div>

            {/* Privacy Verification Gate for Sensitive Personal Address */}
            {!tracked.verified ? (
              <div className="rounded-2xl bg-white border border-sky-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Informasi pribadi pelanggan dilindungi
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Masukkan 4 digit terakhir nomor WhatsApp pemesan untuk membuka nama lengkap &amp; alamat penjemputan.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleVerifyPhone} className="flex items-center gap-2 shrink-0">
                  <label htmlFor="verify-last4" className="sr-only">
                    4 digit terakhir nomor WhatsApp
                  </label>
                  <input
                    id="verify-last4"
                    type="text"
                    maxLength={4}
                    inputMode="numeric"
                    value={last4Input}
                    onChange={(e) => setLast4Input(e.target.value.replace(/\D/g, ''))}
                    placeholder="4 digit WA"
                    className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-center focus:border-sky-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    {verifying ? 'Cek...' : 'Verifikasi'}
                  </button>
                </form>
                {verifyError && <p className="text-xs text-red-600 font-medium">{verifyError}</p>}
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-emerald-200 p-4 text-sm flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">Detail Alamat Terverifikasi</p>
                  <p className="text-slate-600">
                    {tracked.order.pickupAddress}
                    {tracked.order.pickupLandmark ? ` (Patokan: ${tracked.order.pickupLandmark})` : ''}
                  </p>
                  {tracked.order.notes && (
                    <p className="text-xs text-slate-500">Catatan: {tracked.order.notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* 10-Stage Visual Progress Timeline */}
            <div>
              <h4 className="font-display font-bold text-base sm:text-lg text-slate-900 mb-4">
                Progres Pengerjaan Laundry
              </h4>
              <ol className="space-y-3">
                {visibleStages.map((stage) => {
                  const stageIdx = getStageIndex(stage.code);
                  const isCompleted =
                    tracked.order.status === 'PESANAN_SELESAI'
                      ? stageIdx <= currentStageOrderIdx
                      : stageIdx < currentStageOrderIdx;
                  const isCurrent =
                    tracked.order.status !== 'PESANAN_SELESAI' && stageIdx === currentStageOrderIdx;
                  const historyEntry = [...tracked.history]
                    .reverse()
                    .find((h) => h.status === stage.code);

                  return (
                    <li
                      key={stage.code}
                      className={`rounded-2xl border p-4 flex items-start gap-3.5 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : isCurrent
                          ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300'
                          : 'bg-white border-slate-200/80 opacity-75'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        ) : isCurrent ? (
                          <PackageCheck className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          stage.stepNumber
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p
                            className={`font-display font-bold text-sm sm:text-base ${
                              isCompleted
                                ? 'text-emerald-950'
                                : isCurrent
                                ? 'text-sky-950'
                                : 'text-slate-700'
                            }`}
                          >
                            {stage.label}
                          </p>

                          {historyEntry ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              {formatDateTimeId(historyEntry.createdAt)}
                            </span>
                          ) : isCurrent ? (
                            <span className="text-xs font-semibold text-sky-700">Sedang Berlangsung</span>
                          ) : null}
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                          {historyEntry?.description || stage.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-sky-200/70">
              <p className="text-xs text-slate-500">
                Ada pertanyaan mengenai cucian Anda? Hubungi admin langsung dengan menyertakan kode{' '}
                <span className="font-mono font-semibold text-slate-700">{tracked.order.orderCode}</span>.
              </p>
              <a
                href={buildGeneralWhatsappUrl(
                  settings.whatsappRaw,
                  `Halo Admin Laundry Huzavin, saya ingin menanyakan update pesanan dengan Kode Order: ${tracked.order.orderCode}. Terima kasih.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                HUBUNGI ADMIN VIA WHATSAPP
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

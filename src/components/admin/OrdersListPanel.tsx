import {
  CheckCircle2,
  Eye,
  MessageCircle,
  Package,
  Trash2,
} from 'lucide-react';
import {
  buildGeneralWhatsappUrl,
  formatRupiah,
  formatWeightKg,
  getAdminDecisionLabel,
  getOrderSourceLabel,
  getPaymentStatusLabel,
  getStageLabel,
} from '../../lib/laundryRules';
import type { OrderRecordClient } from '../../types';

interface OrdersListPanelProps {
  orders: OrderRecordClient[];
  emptyTitle: string;
  emptySubtitle: string;
  showQuickAccept?: boolean;
  showQuickReject?: boolean;
  showQuickAdvance?: boolean;
  onOpenDetail: (orderId: string) => void;
  onQuickAccept?: (order: OrderRecordClient) => void;
  onQuickReject?: (order: OrderRecordClient) => void;
  onQuickAdvance?: (order: OrderRecordClient) => void;
  onTogglePaid?: (order: OrderRecordClient) => void;
  onRequestDelete?: (order: OrderRecordClient) => void;
}

export function OrdersListPanel({
  orders,
  emptyTitle,
  emptySubtitle,
  showQuickAccept = false,
  showQuickReject = false,
  showQuickAdvance = false,
  onOpenDetail,
  onQuickAccept,
  onQuickReject,
  onQuickAdvance,
  onTogglePaid,
  onRequestDelete,
}: OrdersListPanelProps) {
  if (orders.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-sky-200 rounded-2xl bg-sky-50/40 px-4">
        <Package className="w-10 h-10 text-sky-300 mx-auto mb-2" aria-hidden="true" />
        <p className="font-semibold text-slate-700 text-sm">{emptyTitle}</p>
        <p className="text-xs text-slate-500 mt-1">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile-First Card List */}
      <div className="grid gap-3 md:hidden">
        {orders.map((order) => {
          const displayWeight =
            order.finalWeight !== null ? order.finalWeight : order.estimatedWeight;
          const displayPrice =
            order.finalPrice !== null ? order.finalPrice : order.estimatedPrice;
          const isNewWebsite =
            order.orderSource === 'website' && order.adminDecision === 'menunggu';

          return (
            <article
              key={order.id}
              className="rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-extrabold text-sm text-sky-800">
                      {order.orderCode}
                    </span>
                    {isNewWebsite && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Baru
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-semibold">
                      {getOrderSourceLabel(order.orderSource)}
                    </span>
                  </div>
                  <p className="font-display font-bold text-base text-slate-900 mt-1 truncate">
                    {order.customerName}
                  </p>
                  <p className="text-xs font-mono text-slate-500 tabular-nums">
                    {order.customerPhone}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      order.status === 'PESANAN_SELESAI'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    {getStageLabel(order.status)}
                  </span>
                  <p className="font-display font-extrabold text-sm text-slate-900 mt-1.5 tabular-nums">
                    {formatRupiah(displayPrice)}
                  </p>
                  <p
                    className={`text-[11px] font-bold ${
                      order.paymentStatus === 'lunas' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {getPaymentStatusLabel(order.paymentStatus)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-[#F8FBFF] rounded-xl p-2.5 space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-slate-800">{order.serviceName}</span>
                  <span className="tabular-nums font-semibold">{formatWeightKg(displayWeight)}</span>
                </div>
                <p className="text-slate-500 line-clamp-2">{order.pickupAddress}</p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {order.pickupDate} · {order.pickupTime}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenDetail(order.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Detail &amp; Kelola
                </button>

                {showQuickAccept && isNewWebsite && onQuickAccept && (
                  <button
                    type="button"
                    onClick={() => onQuickAccept(order)}
                    className="inline-flex items-center justify-center gap-1 min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terima
                  </button>
                )}

                {showQuickReject && isNewWebsite && onQuickReject && (
                  <button
                    type="button"
                    onClick={() => onQuickReject(order)}
                    className="inline-flex items-center justify-center gap-1 min-h-[42px] px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold"
                  >
                    Tolak
                  </button>
                )}

                {showQuickAdvance && onQuickAdvance && order.status !== 'PESANAN_SELESAI' && (
                  <button
                    type="button"
                    onClick={() => onQuickAdvance(order)}
                    className="inline-flex items-center justify-center gap-1 min-h-[42px] px-3 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-bold"
                  >
                    Tahap Berikutnya
                  </button>
                )}

                <a
                  href={buildGeneralWhatsappUrl(
                    order.customerPhone,
                    `Halo Kak ${order.customerName}, ini Admin Laundry Huzavin menginformasikan status pesanan ${order.orderCode}: ${getStageLabel(order.status)}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Chat WhatsApp ${order.customerName}`}
                  className="inline-flex items-center justify-center w-[42px] h-[42px] rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>

                {onRequestDelete && (
                  <button
                    type="button"
                    onClick={() => onRequestDelete(order)}
                    aria-label={`Hapus pesanan ${order.orderCode}`}
                    className="inline-flex items-center justify-center w-[42px] h-[42px] rounded-xl bg-red-50 text-red-600 border border-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop Structured Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-sky-100 text-slate-500 text-xs font-semibold">
              <th className="py-3 px-2.5">Kode Order</th>
              <th className="py-3 px-2.5">Pelanggan</th>
              <th className="py-3 px-2.5">Layanan &amp; Berat</th>
              <th className="py-3 px-2.5">Pembayaran</th>
              <th className="py-3 px-2.5">Alamat &amp; Jadwal</th>
              <th className="py-3 px-2.5">Status</th>
              <th className="py-3 px-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const isNewWebsite =
                order.orderSource === 'website' && order.adminDecision === 'menunggu';
              const displayWeight =
                order.finalWeight !== null ? order.finalWeight : order.estimatedWeight;
              const displayPrice =
                order.finalPrice !== null ? order.finalPrice : order.estimatedPrice;

              return (
                <tr key={order.id} className="hover:bg-sky-50/40">
                  <td className="py-3 px-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sky-800">{order.orderCode}</span>
                      {isNewWebsite && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Baru
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {getOrderSourceLabel(order.orderSource)} ·{' '}
                      {new Date(order.createdAt).toLocaleDateString('id-ID')}
                    </div>
                  </td>

                  <td className="py-3 px-2.5">
                    <div className="font-semibold text-slate-900">{order.customerName}</div>
                    <div className="text-xs font-mono text-slate-500 tabular-nums">
                      {order.customerPhone}
                    </div>
                  </td>

                  <td className="py-3 px-2.5 whitespace-nowrap">
                    <div className="font-medium text-slate-800">{order.serviceName}</div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {formatWeightKg(displayWeight)}{' '}
                      {order.finalWeight !== null ? '(Aktual)' : '(Est.)'}
                      {(order.itemsCount ?? 0) > 0 ? ` · ${order.itemsCount} item` : ''}
                    </div>
                  </td>

                  <td className="py-3 px-2.5 whitespace-nowrap">
                    <div className="font-bold text-slate-900 tabular-nums">
                      {formatRupiah(displayPrice)}
                    </div>
                    {onTogglePaid ? (
                      <button
                        type="button"
                        onClick={() => onTogglePaid(order)}
                        className={`mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                          order.paymentStatus === 'lunas'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        {getPaymentStatusLabel(order.paymentStatus)}
                      </button>
                    ) : (
                      <span
                        className={`inline-block mt-0.5 text-[11px] font-bold ${
                          order.paymentStatus === 'lunas' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {getPaymentStatusLabel(order.paymentStatus)}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-2.5 max-w-[165px]">
                    <div className="truncate text-slate-700" title={order.pickupAddress}>
                      {order.pickupAddress}
                    </div>
                    <div className="text-xs text-slate-400 tabular-nums">
                      {order.pickupDate} · {order.pickupTime}
                    </div>
                  </td>

                  <td className="py-3 px-2.5 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        order.adminDecision === 'ditolak'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : order.status === 'PESANAN_SELESAI'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}
                    >
                      {order.adminDecision === 'ditolak'
                        ? getAdminDecisionLabel('ditolak')
                        : getStageLabel(order.status)}
                    </span>
                  </td>

                  <td className="py-3 px-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {showQuickAccept && isNewWebsite && onQuickAccept && (
                        <button
                          type="button"
                          onClick={() => onQuickAccept(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          Terima
                        </button>
                      )}
                      {showQuickReject && isNewWebsite && onQuickReject && (
                        <button
                          type="button"
                          onClick={() => onQuickReject(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold"
                        >
                          Tolak
                        </button>
                      )}
                      {showQuickAdvance && onQuickAdvance && order.status !== 'PESANAN_SELESAI' && (
                        <button
                          type="button"
                          onClick={() => onQuickAdvance(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold"
                        >
                          Lanjut
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenDetail(order.id)}
                        aria-label={`Detail pesanan ${order.orderCode}`}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
                      >
                        Detail
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
                      {onRequestDelete && (
                        <button
                          type="button"
                          onClick={() => onRequestDelete(order)}
                          aria-label={`Hapus pesanan ${order.orderCode}`}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

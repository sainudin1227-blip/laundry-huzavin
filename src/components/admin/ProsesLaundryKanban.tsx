import { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, WashingMachine } from 'lucide-react';
import {
  formatRupiah,
  formatWeightKg,
  getPaymentStatusLabel,
  type OrderStatusCode,
} from '../../lib/laundryRules';
import type { OrderRecordClient } from '../../types';

interface ProsesLaundryKanbanProps {
  orders: OrderRecordClient[];
  onMoveStage: (order: OrderRecordClient, targetStatus: OrderStatusCode) => Promise<void>;
  onOpenDetail: (orderId: string) => void;
}

const KANBAN_COLUMNS: Array<{
  status: OrderStatusCode;
  title: string;
  accentBg: string;
  accentText: string;
  nextStatus?: OrderStatusCode;
  nextLabel?: string;
}> = [
  {
    status: 'CUCIAN_DITERIMA_DI_HUZAVIN',
    title: 'Cucian Diterima',
    accentBg: 'bg-sky-100 border-sky-200',
    accentText: 'text-sky-900',
    nextStatus: 'SEDANG_DICUCI',
    nextLabel: 'Mulai Cuci',
  },
  {
    status: 'SEDANG_DICUCI',
    title: 'Sedang Dicuci',
    accentBg: 'bg-blue-100 border-blue-200',
    accentText: 'text-blue-900',
    nextStatus: 'SEDANG_DIKERINGKAN',
    nextLabel: 'Keringkan',
  },
  {
    status: 'SEDANG_DIKERINGKAN',
    title: 'Sedang Dikeringkan',
    accentBg: 'bg-cyan-100 border-cyan-200',
    accentText: 'text-cyan-900',
    nextStatus: 'SEDANG_DISETRIKA',
    nextLabel: 'Lanjut Setrika',
  },
  {
    status: 'SEDANG_DISETRIKA',
    title: 'Sedang Disetrika',
    accentBg: 'bg-indigo-100 border-indigo-200',
    accentText: 'text-indigo-900',
    nextStatus: 'SIAP_DIANTAR',
    nextLabel: 'Siap Diantar',
  },
  {
    status: 'SIAP_DIANTAR',
    title: 'Siap Diantar',
    accentBg: 'bg-amber-100 border-amber-200',
    accentText: 'text-amber-900',
    nextStatus: 'PESANAN_SELESAI',
    nextLabel: 'Tandai Selesai',
  },
  {
    status: 'PESANAN_SELESAI',
    title: 'Selesai',
    accentBg: 'bg-emerald-100 border-emerald-200',
    accentText: 'text-emerald-900',
  },
];

export function ProsesLaundryKanban({
  orders,
  onMoveStage,
  onOpenDetail,
}: ProsesLaundryKanbanProps) {
  const [mobileColumn, setMobileColumn] = useState<OrderStatusCode>('CUCIAN_DITERIMA_DI_HUZAVIN');
  const [movingId, setMovingId] = useState<string | null>(null);

  const activeNonRejected = orders.filter((o) => o.adminDecision !== 'ditolak');
  const intakePendingOrders = activeNonRejected.filter((o) =>
    ['ORDER_DITERIMA', 'MENUNGGU_PENJEMPUTAN', 'CUCIAN_TELAH_DIJEMPUT'].includes(o.status)
  );

  async function handleMove(order: OrderRecordClient, target: OrderStatusCode) {
    // If service does not include ironing and target is SEDANG_DISETRIKA, skip directly to SIAP_DIANTAR
    const resolvedTarget =
      target === 'SEDANG_DISETRIKA' && !order.includesIroning ? 'SIAP_DIANTAR' : target;
    setMovingId(order.id);
    try {
      await onMoveStage(order, resolvedTarget);
    } finally {
      setMovingId(null);
    }
  }

  function renderOrderCard(order: OrderRecordClient, col: (typeof KANBAN_COLUMNS)[number]) {
    const weight = order.finalWeight ?? order.estimatedWeight;
    const price = order.finalPrice ?? order.estimatedPrice;
    const targetNext =
      col.nextStatus === 'SEDANG_DISETRIKA' && !order.includesIroning
        ? ('SIAP_DIANTAR' as OrderStatusCode)
        : col.nextStatus;
    const btnLabel =
      col.nextStatus === 'SEDANG_DISETRIKA' && !order.includesIroning
        ? 'Siap Diantar'
        : col.nextLabel;

    return (
      <article
        key={order.id}
        className="rounded-2xl bg-white border border-sky-100 p-3.5 shadow-xs space-y-2.5"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono font-extrabold text-xs text-sky-700 whitespace-nowrap">
              {order.orderCode}
            </p>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 ${
                order.paymentStatus === 'lunas'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {getPaymentStatusLabel(order.paymentStatus)}
            </span>
          </div>
          <h4 className="font-display font-bold text-sm text-[#0F2744] truncate">
            {order.customerName}
          </h4>
        </div>

        <div className="text-xs text-slate-600 flex items-center justify-between gap-2 bg-[#F8FBFF] px-2.5 py-1.5 rounded-xl">
          <span className="font-semibold truncate">{order.serviceName}</span>
          <span className="tabular-nums font-bold shrink-0">{formatWeightKg(weight)}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#0F2744] tabular-nums">{formatRupiah(price)}</span>
          <button
            type="button"
            onClick={() => onOpenDetail(order.id)}
            className="inline-flex items-center gap-1 text-sky-700 font-bold hover:underline"
          >
            <Eye className="w-3.5 h-3.5" /> Detail
          </button>
        </div>

        {targetNext && btnLabel && (
          <button
            type="button"
            disabled={movingId === order.id}
            onClick={() => handleMove(order, targetNext)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            {movingId === order.id ? 'Memindahkan...' : btnLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </article>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-2">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <WashingMachine className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-display font-bold text-lg sm:text-xl text-[#0F2744]">
              Manajemen Proses Laundry (Kanban Board)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Pindahkan cucian antar tahap secara langsung; status tracking pelanggan diperbarui seketika.
            </p>
          </div>
        </div>
      </div>

      {/* Intake strip for orders still in pickup phase */}
      {intakePendingOrders.length > 0 && (
        <div className="rounded-3xl bg-sky-50 border border-sky-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs sm:text-sm font-bold text-sky-950">
              Menunggu Masuk Workshop ({intakePendingOrders.length} pesanan)
            </p>
            <span className="text-[11px] text-sky-700">
              Klik terima di workshop untuk memasukkan ke papan proses laundry
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {intakePendingOrders.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl bg-white border border-sky-200 p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-mono font-bold text-xs text-sky-800">{o.orderCode}</p>
                  <p className="font-semibold text-xs text-slate-900 truncate">{o.customerName}</p>
                </div>
                <button
                  type="button"
                  disabled={movingId === o.id}
                  onClick={() => handleMove(o, 'CUCIAN_DITERIMA_DI_HUZAVIN')}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold whitespace-nowrap shrink-0"
                >
                  Masuk Workshop →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Stage Switcher (< lg) */}
      <div className="lg:hidden space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {KANBAN_COLUMNS.map((col) => {
            const count = activeNonRejected.filter((o) => o.status === col.status).length;
            const active = mobileColumn === col.status;
            return (
              <button
                key={col.status}
                type="button"
                onClick={() => setMobileColumn(col.status)}
                className={`min-h-[42px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-700 border-sky-100'
                }`}
              >
                <span>{col.title}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    active ? 'bg-white text-sky-800' : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {(() => {
          const col =
            KANBAN_COLUMNS.find((c) => c.status === mobileColumn) ?? KANBAN_COLUMNS[0];
          const colOrders = activeNonRejected.filter((o) => o.status === col.status);
          return (
            <div className="rounded-3xl bg-[#F0F7FF] border border-sky-100 p-3.5 space-y-3">
              {colOrders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Belum ada pesanan di tahap <strong>{col.title}</strong>.
                </div>
              ) : (
                colOrders.map((o) => renderOrderCard(o, col))
              )}
            </div>
          );
        })()}
      </div>

      {/* Desktop 6-Column Kanban Board (lg+) */}
      <div className="hidden lg:flex lg:gap-3.5 lg:overflow-x-auto lg:pb-2 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = activeNonRejected.filter((o) => o.status === col.status);
          return (
            <div
              key={col.status}
              className="w-[244px] shrink-0 xl:flex-1 xl:min-w-[230px] rounded-3xl bg-[#F2F7FE] border border-sky-100 p-3 space-y-3 min-h-[260px]"
            >
              <div
                className={`rounded-2xl border px-3 py-2 flex items-center justify-between gap-2 ${col.accentBg}`}
              >
                <span className={`font-display font-bold text-xs ${col.accentText}`}>
                  {col.title}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white text-[11px] font-extrabold text-[#0F2744] tabular-nums">
                  {colOrders.length}
                </span>
              </div>

              {colOrders.length === 0 ? (
                <div className="py-10 text-center text-[11px] text-slate-400">
                  Kosong
                </div>
              ) : (
                <div className="space-y-2.5">
                  {colOrders.map((o) => renderOrderCard(o, col))}
                </div>
              )}

              {col.status === 'PESANAN_SELESAI' && colOrders.length > 0 && (
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Siap / Selesai
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  buildOrdersAndRevenueSeries,
  type ChartGranularity,
} from '../../lib/adminAnalytics';
import { formatRupiah } from '../../lib/laundryRules';
import type { OrderRecordClient } from '../../types';

interface AdminDashboardChartsProps {
  orders: OrderRecordClient[];
}

const FILTER_OPTIONS: Array<{ id: ChartGranularity; label: string }> = [
  { id: 'harian', label: 'Harian' },
  { id: 'mingguan', label: 'Mingguan' },
  { id: 'bulanan', label: 'Bulanan' },
];

export function AdminDashboardCharts({ orders }: AdminDashboardChartsProps) {
  const [granularity, setGranularity] = useState<ChartGranularity>('harian');
  const series = buildOrdersAndRevenueSeries(orders, granularity);

  const maxOrders = Math.max(1, ...series.map((p) => p.ordersCount));
  const maxRevenue = Math.max(1000, ...series.map((p) => p.revenue));
  const totalOrdersInWindow = series.reduce((s, p) => s + p.ordersCount, 0);
  const totalRevenueInWindow = series.reduce((s, p) => s + p.revenue, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base sm:text-lg text-[#0F2744]">
            Analitik Pesanan &amp; Pendapatan
          </h3>
          <p className="text-xs text-slate-500">
            Data riil langsung dari database Laundry Huzavin
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Filter periode grafik"
          className="inline-flex items-center p-1 rounded-2xl bg-sky-50 border border-sky-100 self-start sm:self-auto"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = granularity === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setGranularity(opt.id)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  active
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-sky-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Grafik Jumlah Pesanan */}
        <article className="rounded-3xl bg-white border border-sky-100 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base text-[#0F2744]">
                  Grafik Jumlah Pesanan
                </h4>
                <p className="text-[11px] text-slate-500">
                  Total periode: <strong className="tabular-nums">{totalOrdersInWindow}</strong> order
                </p>
              </div>
            </div>
          </div>

          {totalOrdersInWindow === 0 ? (
            <div className="h-44 rounded-2xl border border-dashed border-sky-200 bg-sky-50/30 flex flex-col items-center justify-center px-4 text-center">
              <p className="text-xs font-semibold text-slate-600">
                Belum ada pesanan pada periode ini
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Grafik akan terisi otomatis saat pesanan masuk atau dicatat manual.
              </p>
            </div>
          ) : (
            <div className="h-44 flex items-end gap-2 sm:gap-3 pt-4 border-b border-sky-100 pb-2">
              {series.map((point) => {
                const heightPct = Math.max(
                  point.ordersCount > 0 ? 12 : 3,
                  Math.round((point.ordersCount / maxOrders) * 100)
                );
                return (
                  <div
                    key={point.key}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full min-w-0"
                  >
                    <span className="text-[11px] font-bold text-sky-800 tabular-nums">
                      {point.ordersCount}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        title={`${point.label}: ${point.ordersCount} pesanan`}
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[34px] rounded-t-xl transition-all duration-300 ${
                          point.ordersCount > 0
                            ? 'bg-gradient-to-t from-sky-600 to-sky-400'
                            : 'bg-sky-100'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 truncate w-full text-center">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {/* Grafik Pendapatan */}
        <article className="rounded-3xl bg-white border border-sky-100 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base text-[#0F2744]">
                  Grafik Pendapatan
                </h4>
                <p className="text-[11px] text-slate-500">
                  Total periode:{' '}
                  <strong className="tabular-nums text-emerald-700">
                    {formatRupiah(totalRevenueInWindow)}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {totalRevenueInWindow === 0 ? (
            <div className="h-44 rounded-2xl border border-dashed border-sky-200 bg-sky-50/30 flex flex-col items-center justify-center px-4 text-center">
              <p className="text-xs font-semibold text-slate-600">
                Belum ada pendapatan pada periode ini
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Grafik dihitung dari nominal pesanan aktual/estimasi pada database.
              </p>
            </div>
          ) : (
            <div className="h-44 flex items-end gap-2 sm:gap-3 pt-4 border-b border-sky-100 pb-2">
              {series.map((point) => {
                const heightPct = Math.max(
                  point.revenue > 0 ? 12 : 3,
                  Math.round((point.revenue / maxRevenue) * 100)
                );
                const compactRp =
                  point.revenue >= 1000
                    ? `${Math.round(point.revenue / 1000)}rb`
                    : point.revenue > 0
                    ? String(point.revenue)
                    : '0';
                return (
                  <div
                    key={point.key}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full min-w-0"
                  >
                    <span className="text-[10px] font-bold text-emerald-700 tabular-nums">
                      {compactRp}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        title={`${point.label}: ${formatRupiah(point.revenue)}`}
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[34px] rounded-t-xl transition-all duration-300 ${
                          point.revenue > 0
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                            : 'bg-slate-100'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 truncate w-full text-center">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

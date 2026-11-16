import type { OrderRecordClient } from '../types';

export type ChartGranularity = 'harian' | 'mingguan' | 'bulanan';

export interface ChartBucketPoint {
  key: string;
  label: string;
  ordersCount: number;
  revenue: number;
}

function getOrderRevenueValue(order: OrderRecordClient): number {
  return order.finalPrice ?? order.estimatedPrice ?? 0;
}

export function buildOrdersAndRevenueSeries(
  orders: OrderRecordClient[],
  granularity: ChartGranularity,
  referenceDate: Date = new Date()
): ChartBucketPoint[] {
  const validOrders = orders.filter((o) => o.adminDecision !== 'ditolak');

  if (granularity === 'harian') {
    const buckets: ChartBucketPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(
        Date.UTC(
          referenceDate.getUTCFullYear(),
          referenceDate.getUTCMonth(),
          referenceDate.getUTCDate() - offset
        )
      );
      const isoDay = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      buckets.push({ key: isoDay, label, ordersCount: 0, revenue: 0 });
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));
    for (const order of validOrders) {
      const dayKey = order.createdAt.slice(0, 10);
      const bucket = bucketMap.get(dayKey);
      if (bucket) {
        bucket.ordersCount += 1;
        bucket.revenue += getOrderRevenueValue(order);
      }
    }
    return buckets;
  }

  if (granularity === 'mingguan') {
    const buckets: ChartBucketPoint[] = [];
    for (let w = 3; w >= 0; w--) {
      const end = new Date(
        Date.UTC(
          referenceDate.getUTCFullYear(),
          referenceDate.getUTCMonth(),
          referenceDate.getUTCDate() - w * 7
        )
      );
      const start = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 6)
      );

      const label =
        w === 0
          ? 'Minggu Ini'
          : `${start.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            })}`;
      buckets.push({
        key: `${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}`,
        label,
        ordersCount: 0,
        revenue: 0,
      });
    }

    for (const order of validOrders) {
      const created = new Date(order.createdAt);
      if (Number.isNaN(created.getTime())) continue;
      const createdDay = created.toISOString().slice(0, 10);
      for (const bucket of buckets) {
        const [startStr, endStr] = bucket.key.split('..');
        if (createdDay >= startStr && createdDay <= endStr) {
          bucket.ordersCount += 1;
          bucket.revenue += getOrderRevenueValue(order);
          break;
        }
      }
    }
    return buckets;
  }

  // bulanan: last 6 months
  const buckets: ChartBucketPoint[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - m, 1)
    );
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    const label = d.toLocaleDateString('id-ID', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
    buckets.push({ key, label, ordersCount: 0, revenue: 0 });
  }

  const monthMap = new Map(buckets.map((b) => [b.key, b]));
  for (const order of validOrders) {
    const monthKey = order.createdAt.slice(0, 7);
    const bucket = monthMap.get(monthKey);
    if (bucket) {
      bucket.ordersCount += 1;
      bucket.revenue += getOrderRevenueValue(order);
    }
  }
  return buckets;
}

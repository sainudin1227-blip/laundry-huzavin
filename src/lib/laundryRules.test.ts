import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderWhatsappUrl,
  calculateEstimatedPrice,
  DEFAULT_SITE_SETTINGS,
  formatRupiah,
  generateOrderCode,
  getAdminDecisionLabel,
  getPaymentStatusLabel,
  getVisibleStagesForService,
  maskCustomerName,
  matchFaqFallbackAnswer,
  normalizeWhatsappNumber,
  parseWeightInput,
  sumOrderItemsWeight,
  validateManualOrderInput,
  validateOrderInput,
} from './laundryRules';
import { buildOrdersAndRevenueSeries } from './adminAnalytics';
import type { OrderRecordClient } from '../types';

test('price calculation supports integers and decimals with minimum 1 kg', () => {
  assert.equal(calculateEstimatedPrice(3, 7000), 21000);
  assert.equal(calculateEstimatedPrice(3, 10000), 30000);
  assert.equal(calculateEstimatedPrice(2.5, 10000), 25000);
  assert.equal(calculateEstimatedPrice(0.5, 10000), 0);
  assert.equal(parseWeightInput('2,5'), 2.5);
  assert.equal(formatRupiah(25000), 'Rp25.000');
});

test('order code generation formats sequence properly', () => {
  const sampleDate = new Date('2026-11-16T08:00:00Z');
  assert.equal(generateOrderCode(sampleDate, 1), 'HZV-202611-0001');
  assert.equal(generateOrderCode(sampleDate, 42), 'HZV-202611-0042');
});

test('phone normalization and customer name masking protect PII', () => {
  assert.equal(normalizeWhatsappNumber('089515559477'), '6289515559477');
  assert.equal(normalizeWhatsappNumber('+62 895-1555-9477'), '6289515559477');
  assert.equal(maskCustomerName('Siti Aminah'), 'S*** A****');
});

test('order input validation catches missing fields and invalid weight', () => {
  const invalid = validateOrderInput({
    customerName: '',
    customerPhone: '123',
    pickupAddress: 'abc',
    serviceId: '',
    estimatedWeight: 0.5,
    pickupDate: '',
    pickupTime: '',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.customerName);
  assert.ok(invalid.errors.customerPhone);
  assert.ok(invalid.errors.pickupAddress);
  assert.ok(invalid.errors.estimatedWeight);

  const valid = validateOrderInput({
    customerName: 'Budi Santoso',
    customerPhone: '081234567890',
    pickupAddress: 'Jl. Pasir Putih No. 12, Sawangan, Depok',
    pickupLandmark: 'Dekat Masjid Al-Ikhlas',
    serviceId: 'cuci-setrika',
    estimatedWeight: 2.5,
    pickupDate: '2026-11-17',
    pickupTime: '10:00',
    notes: 'Pisahkan baju putih',
  });
  assert.equal(valid.valid, true);
});

test('manual order validation and clothing item weight summing work accurately', () => {
  const weightSum = sumOrderItemsWeight([
    { weightKg: 1.2 },
    { weightKg: 0.8 },
  ]);
  assert.equal(weightSum, 2);

  const invalidManual = validateManualOrderInput({
    customerName: 'A',
    customerPhone: '08',
    pickupAddress: '',
    serviceId: '',
    orderSource: 'manual',
    paymentStatus: 'belum_dibayar',
    totalWeightKg: 0.5,
    items: [],
  });
  assert.equal(invalidManual.valid, false);
  assert.ok(invalidManual.errors.items);
  assert.ok(invalidManual.errors.totalWeightKg);

  const validManual = validateManualOrderInput({
    customerName: 'Andi Wijaya',
    customerPhone: '081298765432',
    pickupAddress: 'Datang langsung ke workshop',
    serviceId: 'cuci-setrika',
    orderSource: 'manual',
    paymentStatus: 'lunas',
    totalWeightKg: 2,
    items: [
      { category: 'Kaos', quantity: 4, weightKg: 1.2, conditionNote: 'Normal' },
      { category: 'Jaket', quantity: 1, weightKg: 0.8, conditionNote: 'Bernoda', specialNote: 'Noda kopi di lengan' },
    ],
  });
  assert.equal(validManual.valid, true);
  assert.equal(getPaymentStatusLabel('lunas'), 'Lunas');
  assert.equal(getAdminDecisionLabel('diterima'), 'Diterima');
});

test('visible stages skip ironing step for Cuci Kering', () => {
  const dryStages = getVisibleStagesForService(false);
  const ironStages = getVisibleStagesForService(true);
  assert.equal(dryStages.some((s) => s.code === 'SEDANG_DISETRIKA'), false);
  assert.equal(ironStages.some((s) => s.code === 'SEDANG_DISETRIKA'), true);
});

test('WhatsApp order link contains order code and target number 6289515559477', () => {
  const url = buildOrderWhatsappUrl({
    whatsappRaw: '6289515559477',
    orderCode: 'HZV-202611-0001',
    customerName: 'Rina',
    customerPhone: '081234567890',
    serviceName: 'Cuci Setrika',
    estimatedWeight: 2,
    estimatedPrice: 20000,
    pickupAddress: 'Kampung Kupu No 5',
    pickupDate: '2026-11-17',
    pickupTime: '09:00',
  });
  assert.ok(url.startsWith('https://wa.me/6289515559477?text='));
  assert.ok(decodeURIComponent(url).includes('HZV-202611-0001'));
});

test('FAQ fallback answers pricing and location accurately', () => {
  const services = [
    {
      id: 'cuci-kering',
      slug: 'cuci-kering',
      name: 'Cuci Kering',
      pricePerKg: 7000,
      description: 'Cuci bersih dan kering',
      estimatedDuration: '1-2 hari',
      includesIroning: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 'cuci-setrika',
      slug: 'cuci-setrika',
      name: 'Cuci Setrika',
      pricePerKg: 10000,
      description: 'Cuci bersih, kering, dan setrika',
      estimatedDuration: '1-2 hari',
      includesIroning: true,
      isActive: true,
      sortOrder: 2,
    },
  ];
  const priceReply = matchFaqFallbackAnswer('Berapa harga cuci setrika?', services, DEFAULT_SITE_SETTINGS);
  assert.ok(priceReply.includes('Rp10.000/kg'));
  const locReply = matchFaqFallbackAnswer('Dimana lokasi huzavin?', services, DEFAULT_SITE_SETTINGS);
  assert.ok(locReply.includes('Sawangan'));
});

function makeMockOrder(overrides: Partial<OrderRecordClient>): OrderRecordClient {
  return {
    id: 'ord-1',
    orderCode: 'HZV-202611-0001',
    customerId: null,
    customerName: 'Test User',
    customerPhone: '081234567890',
    pickupAddress: 'Sawangan, Depok',
    pickupLandmark: '',
    serviceId: 'cuci-setrika',
    serviceName: 'Cuci Setrika',
    includesIroning: true,
    pricePerKg: 10000,
    estimatedWeight: 2,
    finalWeight: null,
    estimatedPrice: 20000,
    finalPrice: null,
    pickupDate: '2026-11-16',
    pickupTime: '09:00',
    notes: '',
    status: 'MENUNGGU_PENJEMPUTAN',
    adminDecision: 'menunggu',
    rejectionReason: '',
    orderSource: 'website',
    paymentStatus: 'belum_dibayar',
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T08:00:00.000Z',
    ...overrides,
  };
}

test('admin analytics series aggregates harian, mingguan, bulanan and excludes rejected orders', () => {
  const ref = new Date('2026-11-16T12:00:00.000Z');
  const orders: OrderRecordClient[] = [
    makeMockOrder({
      id: '1',
      createdAt: '2026-11-16T07:00:00.000Z',
      estimatedPrice: 20000,
      finalPrice: 25000,
      adminDecision: 'diterima',
    }),
    makeMockOrder({
      id: '2',
      createdAt: '2026-11-15T09:00:00.000Z',
      estimatedPrice: 14000,
      adminDecision: 'menunggu',
    }),
    makeMockOrder({
      id: '3',
      createdAt: '2026-11-16T10:00:00.000Z',
      estimatedPrice: 99000,
      adminDecision: 'ditolak',
    }),
    makeMockOrder({
      id: '4',
      createdAt: '2026-10-05T10:00:00.000Z',
      estimatedPrice: 30000,
      adminDecision: 'diterima',
    }),
  ];

  const daily = buildOrdersAndRevenueSeries(orders, 'harian', ref);
  assert.equal(daily.length, 7);
  const todayBucket = daily.find((b) => b.key === '2026-11-16');
  const yestBucket = daily.find((b) => b.key === '2026-11-15');
  assert.equal(todayBucket?.ordersCount, 1);
  assert.equal(todayBucket?.revenue, 25000);
  assert.equal(yestBucket?.ordersCount, 1);
  assert.equal(yestBucket?.revenue, 14000);

  const weekly = buildOrdersAndRevenueSeries(orders, 'mingguan', ref);
  assert.equal(weekly.length, 4);
  assert.equal(weekly[3].label, 'Minggu Ini');
  assert.equal(weekly[3].ordersCount, 2);
  assert.equal(weekly[3].revenue, 39000);

  const monthly = buildOrdersAndRevenueSeries(orders, 'bulanan', ref);
  assert.equal(monthly.length, 6);
  const novBucket = monthly.find((b) => b.key === '2026-11');
  const octBucket = monthly.find((b) => b.key === '2026-10');
  assert.equal(novBucket?.ordersCount, 2);
  assert.equal(novBucket?.revenue, 39000);
  assert.equal(octBucket?.ordersCount, 1);
  assert.equal(octBucket?.revenue, 30000);
});

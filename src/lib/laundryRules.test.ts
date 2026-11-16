import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderWhatsappUrl,
  calculateEstimatedPrice,
  DEFAULT_SITE_SETTINGS,
  formatRupiah,
  generateOrderCode,
  getVisibleStagesForService,
  maskCustomerName,
  matchFaqFallbackAnswer,
  normalizeWhatsappNumber,
  parseWeightInput,
  validateOrderInput,
} from './laundryRules';

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

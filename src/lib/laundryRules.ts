export type OrderStatusCode =
  | 'ORDER_DITERIMA'
  | 'MENUNGGU_PENJEMPUTAN'
  | 'CUCIAN_TELAH_DIJEMPUT'
  | 'CUCIAN_DITERIMA_DI_HUZAVIN'
  | 'SEDANG_DICUCI'
  | 'SEDANG_DIKERINGKAN'
  | 'SEDANG_DISETRIKA'
  | 'SIAP_DIANTAR'
  | 'DALAM_PENGANTARAN'
  | 'PESANAN_SELESAI';

export interface OrderStageDefinition {
  code: OrderStatusCode;
  stepNumber: number;
  label: string;
  description: string;
  ironingOnly?: boolean;
}

export const ORDER_STAGES: OrderStageDefinition[] = [
  {
    code: 'ORDER_DITERIMA',
    stepNumber: 1,
    label: 'Order Diterima',
    description: 'Pesanan pelanggan berhasil diterima oleh sistem dan menunggu konfirmasi admin.',
  },
  {
    code: 'MENUNGGU_PENJEMPUTAN',
    stepNumber: 2,
    label: 'Menunggu Penjemputan',
    description: 'Kurir Huzavin dijadwalkan menjemput pakaian ke alamat Anda.',
  },
  {
    code: 'CUCIAN_TELAH_DIJEMPUT',
    stepNumber: 3,
    label: 'Cucian Telah Dijemput',
    description: 'Pakaian sudah diambil oleh kurir dari alamat pelanggan.',
  },
  {
    code: 'CUCIAN_DITERIMA_DI_HUZAVIN',
    stepNumber: 4,
    label: 'Cucian Diterima di Huzavin',
    description: 'Pakaian sudah sampai di workshop Laundry Huzavin dan ditimbang.',
  },
  {
    code: 'SEDANG_DICUCI',
    stepNumber: 5,
    label: 'Sedang Dicuci',
    description: 'Pakaian sedang menjalani proses pencucian higienis.',
  },
  {
    code: 'SEDANG_DIKERINGKAN',
    stepNumber: 6,
    label: 'Sedang Dikeringkan',
    description: 'Pakaian sedang dalam proses pengeringan menyeluruh.',
  },
  {
    code: 'SEDANG_DISETRIKA',
    stepNumber: 7,
    label: 'Sedang Disetrika',
    description: 'Pakaian sedang disetrika dan dirapikan (khusus layanan Cuci Setrika).',
    ironingOnly: true,
  },
  {
    code: 'SIAP_DIANTAR',
    stepNumber: 8,
    label: 'Siap Diantar',
    description: 'Pakaian sudah selesai diproses, terlipat rapi, dan siap dikirim kembali.',
  },
  {
    code: 'DALAM_PENGANTARAN',
    stepNumber: 9,
    label: 'Dalam Pengantaran',
    description: 'Kurir sedang dalam perjalanan mengantar cucian bersih ke alamat Anda.',
  },
  {
    code: 'PESANAN_SELESAI',
    stepNumber: 10,
    label: 'Pesanan Selesai',
    description: 'Pakaian telah diterima pelanggan. Terima kasih telah menggunakan Laundry Huzavin!',
  },
];

export interface ServiceItem {
  id: string;
  slug: string;
  name: string;
  pricePerKg: number;
  description: string;
  estimatedDuration: string;
  includesIroning: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface SiteSettings {
  businessName: string;
  sloganMain: string;
  sloganSecondary: string;
  address: string;
  whatsappRaw: string;
  whatsappDisplay: string;
}

export interface OrderInput {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupLandmark?: string;
  serviceId: string;
  estimatedWeight: number;
  pickupDate: string;
  pickupTime: string;
  notes?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  businessName: 'LAUNDRY HUZAVIN',
  sloganMain: 'Bersih Higienis, Rapi Maksimal bersama Huzavin.',
  sloganSecondary: 'Tinggal Duduk Manis, Huzavin Antar Cucian Bersih.',
  address: 'Kampung Kupu, Kelurahan Pasir Putih, Kecamatan Sawangan, Kota Depok, Jawa Barat.',
  whatsappRaw: '6289515559477',
  whatsappDisplay: '089515559477',
};

export function parseWeightInput(raw: string | number): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
  }
  const normalized = raw.replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100) / 100;
}

export function calculateEstimatedPrice(weightKg: number, pricePerKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg < 1 || !Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    return 0;
  }
  return Math.round(weightKg * pricePerKg);
}

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return 'Rp' + safe.toLocaleString('id-ID');
}

export function formatWeightKg(weight: number): string {
  if (!Number.isFinite(weight)) return '0 kg';
  const formatted = weight.toLocaleString('id-ID', {
    minimumFractionDigits: Number.isInteger(weight) ? 0 : 1,
    maximumFractionDigits: 2,
  });
  return `${formatted} kg`;
}

export function normalizeWhatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function maskCustomerName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'Pelanggan';
  return cleaned
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) return part;
      if (part.length === 2) return `${part[0]}*`;
      return `${part[0]}${'*'.repeat(Math.min(part.length - 1, 4))}`;
    })
    .join(' ');
}

export function getLastFourDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4);
}

export function generateOrderCode(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seqStr = String(Math.max(1, sequence)).padStart(4, '0');
  return `HZV-${year}${month}-${seqStr}`;
}

export function validateOrderInput(input: OrderInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.customerName || input.customerName.trim().length < 2) {
    errors.customerName = 'Nama lengkap wajib diisi (minimal 2 karakter).';
  }

  const normalizedPhone = normalizeWhatsappNumber(input.customerPhone || '');
  if (!normalizedPhone || normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    errors.customerPhone = 'Nomor WhatsApp tidak valid (contoh: 089515559477).';
  }

  if (!input.pickupAddress || input.pickupAddress.trim().length < 8) {
    errors.pickupAddress = 'Alamat penjemputan wajib diisi secara lengkap.';
  }

  if (!input.serviceId) {
    errors.serviceId = 'Silakan pilih jenis layanan.';
  }

  if (!Number.isFinite(input.estimatedWeight) || input.estimatedWeight < 1) {
    errors.estimatedWeight = 'Minimal berat cucian adalah 1 kg.';
  }

  if (!input.pickupDate) {
    errors.pickupDate = 'Tanggal penjemputan wajib dipilih.';
  }

  if (!input.pickupTime) {
    errors.pickupTime = 'Jam penjemputan wajib dipilih.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getStageIndex(status: OrderStatusCode): number {
  const idx = ORDER_STAGES.findIndex((stage) => stage.code === status);
  return idx === -1 ? 0 : idx;
}

export function getStageLabel(status: OrderStatusCode): string {
  return ORDER_STAGES.find((stage) => stage.code === status)?.label ?? 'Order Diterima';
}

export function getVisibleStagesForService(includesIroning: boolean): OrderStageDefinition[] {
  return ORDER_STAGES.filter((stage) => includesIroning || !stage.ironingOnly);
}

export function buildGeneralWhatsappUrl(whatsappRaw: string, customMessage?: string): string {
  const cleanNumber = normalizeWhatsappNumber(whatsappRaw) || '6289515559477';
  const defaultMessage =
    customMessage ??
    [
      'Halo Laundry Huzavin, saya ingin memesan layanan laundry.',
      '',
      'Nama:',
      'Jenis layanan:',
      'Berat cucian:',
      'Alamat penjemputan:',
      'Tanggal pickup:',
      'Catatan:',
      '',
      'Mohon informasi lebih lanjut mengenai pemesanan saya.',
      '',
      'Terima kasih.',
    ].join('\n');

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(defaultMessage)}`;
}

export function buildCalculatorWhatsappUrl(params: {
  whatsappRaw: string;
  customerName?: string;
  serviceName: string;
  weightKg: number;
  estimatedPrice: number;
}): string {
  const cleanNumber = normalizeWhatsappNumber(params.whatsappRaw) || '6289515559477';
  const message = [
    'Halo Laundry Huzavin, saya ingin memesan layanan laundry.',
    '',
    `Nama: ${params.customerName?.trim() || '-'}`,
    `Jenis layanan: ${params.serviceName}`,
    `Berat cucian: ${formatWeightKg(params.weightKg)}`,
    `Estimasi total harga: ${formatRupiah(params.estimatedPrice)} (estimasi sebelum penimbangan akhir)`,
    'Permintaan pickup: Mohon info jadwal penjemputan gratis.',
    '',
    'Terima kasih.',
  ].join('\n');

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export function buildOrderWhatsappUrl(params: {
  whatsappRaw: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  estimatedWeight: number;
  estimatedPrice: number;
  pickupAddress: string;
  pickupLandmark?: string;
  pickupDate: string;
  pickupTime: string;
  notes?: string;
}): string {
  const cleanNumber = normalizeWhatsappNumber(params.whatsappRaw) || '6289515559477';
  const message = [
    'Halo Admin Laundry Huzavin!',
    '',
    'Saya ingin memesan layanan laundry.',
    '',
    'DETAIL PESANAN:',
    `Kode Order: ${params.orderCode}`,
    `Nama: ${params.customerName}`,
    `Nomor WhatsApp: ${params.customerPhone}`,
    `Layanan: ${params.serviceName}`,
    `Berat perkiraan: ${formatWeightKg(params.estimatedWeight)}`,
    `Estimasi harga: ${formatRupiah(params.estimatedPrice)}`,
    `Alamat pickup: ${params.pickupAddress}`,
    `Patokan: ${params.pickupLandmark?.trim() || '-'}`,
    `Tanggal pickup: ${params.pickupDate}`,
    `Jam pickup: ${params.pickupTime}`,
    `Catatan: ${params.notes?.trim() || '-'}`,
    '',
    'Mohon konfirmasi pesanan saya.',
    '',
    'Terima kasih.',
  ].join('\n');

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export function matchFaqFallbackAnswer(
  question: string,
  services: ServiceItem[],
  settings: SiteSettings
): string {
  const q = question.toLowerCase();
  const cuciKering = services.find((s) => s.slug === 'cuci-kering') ?? {
    name: 'Cuci Kering',
    pricePerKg: 7000,
  };
  const cuciSetrika = services.find((s) => s.slug === 'cuci-setrika') ?? {
    name: 'Cuci Setrika',
    pricePerKg: 10000,
  };

  if (/(cuci kering|kering saja|tanpa setrika)/.test(q)) {
    return `Harga layanan ${cuciKering.name} di Laundry Huzavin adalah ${formatRupiah(
      cuciKering.pricePerKg
    )}/kg (sudah dicuci bersih dan dikeringkan, estimasi selesai 1–2 hari). Minimal order 1 kg dan antar jemput gratis ya!`;
  }

  if (/(cuci setrika|setrika|komplit|lengkap)/.test(q)) {
    return `Harga layanan ${cuciSetrika.name} di Laundry Huzavin adalah ${formatRupiah(
      cuciSetrika.pricePerKg
    )}/kg (dicuci bersih, dikeringkan, lalu disetrika rapi maksimal). Estimasi selesai 1–2 hari dan antar jemput gratis!`;
  }

  if (/(harga|tarif|biaya|bayar|berapa|price)/.test(q)) {
    return `Daftar harga Laundry Huzavin:\n• ${cuciKering.name}: ${formatRupiah(
      cuciKering.pricePerKg
    )}/kg\n• ${cuciSetrika.name}: ${formatRupiah(
      cuciSetrika.pricePerKg
    )}/kg\n\nMinimal order hanya 1 kg dan sudah gratis antar jemput. Anda juga bisa pakai Kalkulator Harga di website kami!`;
  }

  if (/(minimal|minimum|paling sedikit|kilo|kg)/.test(q)) {
    return 'Minimal order di Laundry Huzavin adalah 1 kg saja, dan mendukung berat desimal seperti 1,5 kg atau 2,5 kg setelah penimbangan akhir.';
  }

  if (/(lama|berapa hari|estimasi|selesai|cepat|durasi|waktu)/.test(q)) {
    return 'Estimasi pengerjaan cucian di Laundry Huzavin adalah 1–2 hari agar hasilnya benar-benar bersih higienis dan rapi maksimal.';
  }

  if (/(antar|jemput|pickup|kurir|ongkir|gratis)/.test(q)) {
    return 'Ya! Laundry Huzavin menyediakan layanan antar jemput GRATIS untuk area layanan kami di Sawangan, Pasir Putih, dan sekitarnya. Tinggal duduk manis, kami jemput dan antar cucian bersih Anda.';
  }

  if (/(lacak|cek status|status|kode order|sudah sampai mana|selesai belum)/.test(q)) {
    return 'Untuk mengecek status cucian secara real-time, silakan masukkan Kode Order Anda (contoh: HZV-202611-0001) di bagian "Lacak Cucian Kamu" pada website ini.';
  }

  if (/(cara order|cara pesan|pesan|order|booking)/.test(q)) {
    return 'Caranya mudah sekali! Anda bisa langsung mengisi formulir "Buat Pesanan Sekarang" di website ini untuk mendapatkan Kode Order otomatis dan terhubung ke WhatsApp admin, atau klik tombol "Chat Admin" di bawah ini.';
  }

  if (/(lokasi|alamat|dimana|di mana|tempat|sawangan|depok|peta|maps)/.test(q)) {
    return `Laundry Huzavin berlokasi di ${settings.address} Anda bisa melihat peta lokasi dan petunjuk arah di bagian Kontak pada website ini.`;
  }

  if (/(halo|hai|hi|pagi|siang|sore|malam|assalamualaikum)/.test(q)) {
    return 'Halo! Selamat datang di Laundry Huzavin. Ada yang bisa Huzavin AI Assistant bantu seputar harga, layanan antar jemput gratis, cara pesan, atau cek status cucian?';
  }

  return `Terima kasih atas pertanyaannya! Untuk informasi lebih detail atau kebutuhan khusus, silakan langsung hubungi admin kami melalui tombol "Chat Admin" ke WhatsApp ${settings.whatsappDisplay}.`;
}

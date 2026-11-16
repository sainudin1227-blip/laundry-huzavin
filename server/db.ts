import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AdminDecision,
  DEFAULT_SITE_SETTINGS,
  generateOrderCode,
  OrderSource,
  OrderStatusCode,
  PaymentStatus,
  PhotoStage,
  ServiceItem,
  SiteSettings,
} from '../src/lib/laundryRules';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const clothingUploadsDir = path.join(dataDir, 'uploads', 'clothing');
if (!fs.existsSync(clothingUploadsDir)) {
  fs.mkdirSync(clothingUploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'huzavin.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export interface OrderRecord {
  id: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupLandmark: string;
  serviceId: string;
  serviceName: string;
  includesIroning: boolean;
  pricePerKg: number;
  estimatedWeight: number;
  finalWeight: number | null;
  estimatedPrice: number;
  finalPrice: number | null;
  pickupDate: string;
  pickupTime: string;
  notes: string;
  status: OrderStatusCode;
  orderSource: OrderSource;
  paymentStatus: PaymentStatus;
  adminDecision: AdminDecision;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
  itemsCount?: number;
  photosCount?: number;
}

export interface OrderHistoryRecord {
  id: string;
  orderId: string;
  status: OrderStatusCode;
  description: string;
  updatedBy: string;
  createdAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  category: string;
  quantity: number;
  weightKg: number;
  conditionNote: string;
  specialNote: string;
  createdAt: string;
  orderCode?: string;
  customerName?: string;
  orderStatus?: OrderStatusCode;
  serviceName?: string;
  orderCreatedAt?: string;
  photoCount?: number;
  firstPhotoUrl?: string | null;
}

export interface ClothingPhotoRecord {
  id: string;
  orderId: string;
  photoStage: PhotoStage;
  fileName: string;
  mimeType: string;
  imageUrl: string;
  caption: string;
  uploadedBy: string;
  createdAt: string;
}

export interface CustomerDirectoryRecord {
  id: string;
  name: string;
  whatsapp: string;
  lastAddress: string;
  lastLandmark: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface GalleryItemRecord {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  beforeImageUrl: string | null;
  caption: string;
  isIllustration: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface TestimonialRecord {
  id: string;
  customerName: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  isPublished: boolean;
  createdAt: string;
}

function ensureOrdersColumns(): void {
  const cols = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has('order_source')) {
    db.exec("ALTER TABLE orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'website'");
  }
  if (!colNames.has('payment_status')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'belum_dibayar'");
  }
  if (!colNames.has('admin_decision')) {
    db.exec("ALTER TABLE orders ADD COLUMN admin_decision TEXT NOT NULL DEFAULT 'menunggu'");
  }
  if (!colNames.has('rejection_reason')) {
    db.exec("ALTER TABLE orders ADD COLUMN rejection_reason TEXT NOT NULL DEFAULT ''");
  }
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price_per_kg INTEGER NOT NULL,
      description TEXT NOT NULL,
      estimated_duration TEXT NOT NULL DEFAULT '1–2 hari',
      includes_ironing INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp TEXT UNIQUE NOT NULL,
      last_address TEXT NOT NULL DEFAULT '',
      last_landmark TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_code TEXT UNIQUE NOT NULL,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      pickup_landmark TEXT NOT NULL DEFAULT '',
      service_id TEXT NOT NULL REFERENCES services(id),
      service_name TEXT NOT NULL,
      includes_ironing INTEGER NOT NULL DEFAULT 0,
      price_per_kg INTEGER NOT NULL,
      estimated_weight REAL NOT NULL,
      final_weight REAL,
      estimated_price INTEGER NOT NULL,
      final_price INTEGER,
      pickup_date TEXT NOT NULL,
      pickup_time TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ORDER_DITERIMA',
      order_source TEXT NOT NULL DEFAULT 'website',
      payment_status TEXT NOT NULL DEFAULT 'belum_dibayar',
      admin_decision TEXT NOT NULL DEFAULT 'menunggu',
      rejection_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      weight_kg REAL NOT NULL DEFAULT 0,
      condition_note TEXT NOT NULL DEFAULT 'Normal',
      special_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clothing_photos (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      photo_stage TEXT NOT NULL DEFAULT 'sebelum',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      caption TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL DEFAULT 'Admin Huzavin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      updated_by TEXT NOT NULL DEFAULT 'Sistem',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      before_image_url TEXT,
      caption TEXT NOT NULL DEFAULT '',
      is_illustration INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      avatar_url TEXT,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_profiles (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT 'Admin Huzavin',
      must_change_password INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chatbot_conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'gemini',
      created_at TEXT NOT NULL
    );
  `);

  ensureOrdersColumns();

  const now = new Date().toISOString();

  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get() as { count: number };
  if (serviceCount.count === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (id, slug, name, price_per_kg, description, estimated_duration, includes_ironing, is_active, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertService.run(
      'cuci-kering',
      'cuci-kering',
      'Cuci Kering',
      7000,
      'Pakaian dicuci hingga bersih higienis dengan deterjen pilihan dan dikeringkan menyeluruh.',
      '1–2 hari',
      0,
      1,
      1,
      now
    );
    insertService.run(
      'cuci-setrika',
      'cuci-setrika',
      'Cuci Setrika',
      10000,
      'Pakaian dicuci bersih higienis, dikeringkan, kemudian disetrika uap dan dilipat hingga rapi maksimal.',
      '1–2 hari',
      1,
      1,
      2,
      now
    );
  }

  const upsertSetting = db.prepare(`
    INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
  `);
  upsertSetting.run('businessName', DEFAULT_SITE_SETTINGS.businessName, now);
  upsertSetting.run('sloganMain', DEFAULT_SITE_SETTINGS.sloganMain, now);
  upsertSetting.run('sloganSecondary', DEFAULT_SITE_SETTINGS.sloganSecondary, now);
  upsertSetting.run('address', DEFAULT_SITE_SETTINGS.address, now);
  upsertSetting.run('whatsappRaw', DEFAULT_SITE_SETTINGS.whatsappRaw, now);
  upsertSetting.run('whatsappDisplay', DEFAULT_SITE_SETTINGS.whatsappDisplay, now);

  const galleryCount = db.prepare('SELECT COUNT(*) as count FROM gallery').get() as { count: number };
  if (galleryCount.count === 0) {
    const insertGallery = db.prepare(`
      INSERT INTO gallery (id, title, category, image_url, before_image_url, caption, is_illustration, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertGallery.run(
      'gal-before',
      'Tumpukan Pakaian Sebelum Dicuci (Ilustrasi)',
      'Pakaian sebelum dicuci',
      '/src/assets/images/before_messy_laundry_1794848015072.jpg',
      null,
      'Ilustrasi kondisi cucian menumpuk sebelum dijemput gratis oleh kurir Laundry Huzavin.',
      1,
      1,
      now
    );
    insertGallery.run(
      'gal-after',
      'Hasil Setrika & Lipatan Rapi (Ilustrasi)',
      'Pakaian terlipat rapi',
      '/src/assets/images/after_neat_laundry_1794848015827.jpg',
      '/src/assets/images/before_messy_laundry_1794848015072.jpg',
      'Ilustrasi hasil akhir pakaian yang bersih higienis, wangi lembut, disetrika dan dilipat rapi.',
      1,
      2,
      now
    );
    insertGallery.run(
      'gal-care',
      'Peralatan & Deterjen Higienis (Ilustrasi)',
      'Peralatan laundry',
      '/src/assets/images/laundry_equipment_care_1794848016294.jpg',
      null,
      'Ilustrasi penggunaan deterjen higienis, pewangi lembut, dan penjemuran terawat.',
      1,
      3,
      now
    );
  }

  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_profiles').get() as { count: number };
  if (adminCount.count === 0) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'abiumi';
    const passwordHash = bcrypt.hashSync(initialPassword, 12);
    db.prepare(`
      INSERT INTO admin_profiles (id, username, password_hash, display_name, must_change_password, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), 'huzavin', passwordHash, 'Pemilik Laundry Huzavin', 1, now);
  }
}

export function getServices(includeInactive = false): ServiceItem[] {
  const rows = db
    .prepare(
      `SELECT id, slug, name, price_per_kg, description, estimated_duration, includes_ironing, is_active, sort_order
       FROM services ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY sort_order ASC`
    )
    .all() as Array<{
    id: string;
    slug: string;
    name: string;
    price_per_kg: number;
    description: string;
    estimated_duration: string;
    includes_ironing: number;
    is_active: number;
    sort_order: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    pricePerKg: row.price_per_kg,
    description: row.description,
    estimatedDuration: row.estimated_duration,
    includesIroning: Boolean(row.includes_ironing),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
  }));
}

export function getSiteSettings(): SiteSettings {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    businessName: map.get('businessName') ?? DEFAULT_SITE_SETTINGS.businessName,
    sloganMain: map.get('sloganMain') ?? DEFAULT_SITE_SETTINGS.sloganMain,
    sloganSecondary: map.get('sloganSecondary') ?? DEFAULT_SITE_SETTINGS.sloganSecondary,
    address: map.get('address') ?? DEFAULT_SITE_SETTINGS.address,
    whatsappRaw: map.get('whatsappRaw') ?? DEFAULT_SITE_SETTINGS.whatsappRaw,
    whatsappDisplay: map.get('whatsappDisplay') ?? DEFAULT_SITE_SETTINGS.whatsappDisplay,
  };
}

export function getGalleryItems(): GalleryItemRecord[] {
  const rows = db
    .prepare(
      `SELECT id, title, category, image_url, before_image_url, caption, is_illustration, sort_order, created_at
       FROM gallery ORDER BY sort_order ASC, created_at DESC`
    )
    .all() as Array<{
    id: string;
    title: string;
    category: string;
    image_url: string;
    before_image_url: string | null;
    caption: string;
    is_illustration: number;
    sort_order: number;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    beforeImageUrl: row.before_image_url,
    caption: row.caption,
    isIllustration: Boolean(row.is_illustration),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

export function getTestimonials(includeUnpublished = false): TestimonialRecord[] {
  const rows = db
    .prepare(
      `SELECT id, customer_name, avatar_url, rating, comment, is_published, created_at
       FROM testimonials ${includeUnpublished ? '' : 'WHERE is_published = 1'} ORDER BY created_at DESC`
    )
    .all() as Array<{
    id: string;
    customer_name: string;
    avatar_url: string | null;
    rating: number;
    comment: string;
    is_published: number;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    avatarUrl: row.avatar_url,
    rating: row.rating,
    comment: row.comment,
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
  }));
}

export function mapOrderRow(row: Record<string, unknown>): OrderRecord {
  return {
    id: String(row.id),
    orderCode: String(row.order_code),
    customerId: row.customer_id ? String(row.customer_id) : null,
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    pickupAddress: String(row.pickup_address),
    pickupLandmark: String(row.pickup_landmark ?? ''),
    serviceId: String(row.service_id),
    serviceName: String(row.service_name),
    includesIroning: Boolean(row.includes_ironing),
    pricePerKg: Number(row.price_per_kg),
    estimatedWeight: Number(row.estimated_weight),
    finalWeight: row.final_weight === null || row.final_weight === undefined ? null : Number(row.final_weight),
    estimatedPrice: Number(row.estimated_price),
    finalPrice: row.final_price === null || row.final_price === undefined ? null : Number(row.final_price),
    pickupDate: String(row.pickup_date),
    pickupTime: String(row.pickup_time),
    notes: String(row.notes ?? ''),
    status: String(row.status) as OrderStatusCode,
    orderSource: (row.order_source ? String(row.order_source) : 'website') as OrderSource,
    paymentStatus: (row.payment_status ? String(row.payment_status) : 'belum_dibayar') as PaymentStatus,
    adminDecision: (row.admin_decision ? String(row.admin_decision) : 'menunggu') as AdminDecision,
    rejectionReason: String(row.rejection_reason ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    itemsCount: row.items_count !== undefined ? Number(row.items_count) : undefined,
    photosCount: row.photos_count !== undefined ? Number(row.photos_count) : undefined,
  };
}

export function getOrderHistory(orderId: string): OrderHistoryRecord[] {
  const rows = db
    .prepare(
      `SELECT id, order_id, status, description, updated_by, created_at
       FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC`
    )
    .all(orderId) as Array<{
    id: string;
    order_id: string;
    status: string;
    description: string;
    updated_by: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    status: r.status as OrderStatusCode,
    description: r.description,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
  }));
}

export function getOrderItems(orderId: string): OrderItemRecord[] {
  const rows = db
    .prepare(
      `SELECT id, order_id, category, quantity, weight_kg, condition_note, special_note, created_at
       FROM order_items WHERE order_id = ? ORDER BY created_at ASC`
    )
    .all(orderId) as Array<{
    id: string;
    order_id: string;
    category: string;
    quantity: number;
    weight_kg: number;
    condition_note: string;
    special_note: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    category: r.category,
    quantity: r.quantity,
    weightKg: r.weight_kg,
    conditionNote: r.condition_note,
    specialNote: r.special_note,
    createdAt: r.created_at,
  }));
}

export function getClothingPhotos(orderId: string): ClothingPhotoRecord[] {
  const rows = db
    .prepare(
      `SELECT id, order_id, photo_stage, file_name, mime_type, caption, uploaded_by, created_at
       FROM clothing_photos WHERE order_id = ? ORDER BY created_at DESC`
    )
    .all(orderId) as Array<{
    id: string;
    order_id: string;
    photo_stage: string;
    file_name: string;
    mime_type: string;
    caption: string;
    uploaded_by: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    photoStage: r.photo_stage as PhotoStage,
    fileName: r.file_name,
    mimeType: r.mime_type,
    imageUrl: `/api/admin/clothing-photos/${r.id}/file`,
    caption: r.caption,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  }));
}

export function getAllClothingItemsWithOrders(): OrderItemRecord[] {
  const rows = db
    .prepare(
      `SELECT
         oi.id, oi.order_id, oi.category, oi.quantity, oi.weight_kg, oi.condition_note, oi.special_note, oi.created_at,
         o.order_code, o.customer_name, o.status AS order_status, o.service_name, o.created_at AS order_created_at,
         (SELECT COUNT(*) FROM clothing_photos cp WHERE cp.order_id = o.id) AS photo_count,
         (SELECT cp.id FROM clothing_photos cp WHERE cp.order_id = o.id ORDER BY cp.created_at DESC LIMIT 1) AS first_photo_id
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       ORDER BY oi.created_at DESC`
    )
    .all() as Array<{
    id: string;
    order_id: string;
    category: string;
    quantity: number;
    weight_kg: number;
    condition_note: string;
    special_note: string;
    created_at: string;
    order_code: string;
    customer_name: string;
    order_status: string;
    service_name: string;
    order_created_at: string;
    photo_count: number;
    first_photo_id: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    category: r.category,
    quantity: r.quantity,
    weightKg: r.weight_kg,
    conditionNote: r.condition_note,
    specialNote: r.special_note,
    createdAt: r.created_at,
    orderCode: r.order_code,
    customerName: r.customer_name,
    orderStatus: r.order_status as OrderStatusCode,
    serviceName: r.service_name,
    orderCreatedAt: r.order_created_at,
    photoCount: r.photo_count,
    firstPhotoUrl: r.first_photo_id ? `/api/admin/clothing-photos/${r.first_photo_id}/file` : null,
  }));
}

export function getCustomersDirectory(): CustomerDirectoryRecord[] {
  const rows = db
    .prepare(
      `SELECT
         c.id, c.name, c.whatsapp, c.last_address, c.last_landmark, c.created_at,
         COUNT(o.id) AS orders_count,
         COALESCE(SUM(COALESCE(o.final_price, o.estimated_price)), 0) AS total_spent,
         MAX(o.created_at) AS last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id
       ORDER BY COALESCE(MAX(o.created_at), c.created_at) DESC`
    )
    .all() as Array<{
    id: string;
    name: string;
    whatsapp: string;
    last_address: string;
    last_landmark: string;
    created_at: string;
    orders_count: number;
    total_spent: number;
    last_order_at: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    whatsapp: r.whatsapp,
    lastAddress: r.last_address,
    lastLandmark: r.last_landmark,
    ordersCount: r.orders_count,
    totalSpent: r.total_spent,
    lastOrderAt: r.last_order_at,
    createdAt: r.created_at,
  }));
}

export function saveClothingPhotoFile(dataUrl: string): { fileName: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i);
  if (!match) return null;

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Ukuran foto maksimal 8 MB.');
  }

  fs.writeFileSync(path.join(clothingUploadsDir, fileName), buffer);
  return { fileName, mimeType };
}

export function deleteClothingPhotoFile(fileName: string): void {
  const safeName = path.basename(fileName);
  const fullPath = path.join(clothingUploadsDir, safeName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

export function createNextOrderCode(now: Date): string {
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `HZV-${yearMonth}-`;
  const lastRow = db
    .prepare(`SELECT order_code FROM orders WHERE order_code LIKE ? ORDER BY order_code DESC LIMIT 1`)
    .get(`${prefix}%`) as { order_code: string } | undefined;

  let nextSeq = 1;
  if (lastRow?.order_code) {
    const tail = Number.parseInt(lastRow.order_code.replace(prefix, ''), 10);
    if (Number.isFinite(tail)) {
      nextSeq = tail + 1;
    }
  }
  return generateOrderCode(now, nextSeq);
}

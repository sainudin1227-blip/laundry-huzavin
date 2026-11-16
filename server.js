// server.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import crypto4 from "crypto";
import path3 from "path";
import { fileURLToPath } from "url";

// server/db.ts
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// src/lib/laundryRules.ts
var ORDER_STAGES = [
  {
    code: "ORDER_DITERIMA",
    stepNumber: 1,
    label: "Order Diterima",
    description: "Pesanan pelanggan berhasil diterima oleh sistem dan menunggu konfirmasi admin."
  },
  {
    code: "MENUNGGU_PENJEMPUTAN",
    stepNumber: 2,
    label: "Menunggu Penjemputan",
    description: "Kurir Huzavin dijadwalkan menjemput pakaian ke alamat Anda."
  },
  {
    code: "CUCIAN_TELAH_DIJEMPUT",
    stepNumber: 3,
    label: "Cucian Telah Dijemput",
    description: "Pakaian sudah diambil oleh kurir dari alamat pelanggan."
  },
  {
    code: "CUCIAN_DITERIMA_DI_HUZAVIN",
    stepNumber: 4,
    label: "Cucian Diterima di Huzavin",
    description: "Pakaian sudah sampai di workshop Laundry Huzavin dan ditimbang."
  },
  {
    code: "SEDANG_DICUCI",
    stepNumber: 5,
    label: "Sedang Dicuci",
    description: "Pakaian sedang menjalani proses pencucian higienis."
  },
  {
    code: "SEDANG_DIKERINGKAN",
    stepNumber: 6,
    label: "Sedang Dikeringkan",
    description: "Pakaian sedang dalam proses pengeringan menyeluruh."
  },
  {
    code: "SEDANG_DISETRIKA",
    stepNumber: 7,
    label: "Sedang Disetrika",
    description: "Pakaian sedang disetrika dan dirapikan (khusus layanan Cuci Setrika).",
    ironingOnly: true
  },
  {
    code: "SIAP_DIANTAR",
    stepNumber: 8,
    label: "Siap Diantar",
    description: "Pakaian sudah selesai diproses, terlipat rapi, dan siap dikirim kembali."
  },
  {
    code: "DALAM_PENGANTARAN",
    stepNumber: 9,
    label: "Dalam Pengantaran",
    description: "Kurir sedang dalam perjalanan mengantar cucian bersih ke alamat Anda."
  },
  {
    code: "PESANAN_SELESAI",
    stepNumber: 10,
    label: "Pesanan Selesai",
    description: "Pakaian telah diterima pelanggan. Terima kasih telah menggunakan Laundry Huzavin!"
  }
];
var DEFAULT_SITE_SETTINGS = {
  businessName: "LAUNDRY HUZAVIN",
  sloganMain: "Bersih Higienis, Rapi Maksimal bersama Huzavin.",
  sloganSecondary: "Tinggal Duduk Manis, Huzavin Antar Cucian Bersih.",
  address: "Kampung Kupu, Kelurahan Pasir Putih, Kecamatan Sawangan, Kota Depok, Jawa Barat.",
  whatsappRaw: "6289515559477",
  whatsappDisplay: "089515559477"
};
function parseWeightInput(raw) {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
  }
  const normalized = raw.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100) / 100;
}
function calculateEstimatedPrice(weightKg, pricePerKg) {
  if (!Number.isFinite(weightKg) || weightKg < 1 || !Number.isFinite(pricePerKg) || pricePerKg <= 0) {
    return 0;
  }
  return Math.round(weightKg * pricePerKg);
}
function formatRupiah(amount) {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return "Rp" + safe.toLocaleString("id-ID");
}
function normalizeWhatsappNumber(phone) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith("62")) {
    return digits;
  }
  if (digits.startsWith("8")) {
    return `62${digits}`;
  }
  return digits;
}
function maskCustomerName(name) {
  const cleaned = name.trim();
  if (!cleaned) return "Pelanggan";
  return cleaned.split(/\s+/).map((part) => {
    if (part.length <= 1) return part;
    if (part.length === 2) return `${part[0]}*`;
    return `${part[0]}${"*".repeat(Math.min(part.length - 1, 4))}`;
  }).join(" ");
}
function getLastFourDigits(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}
function generateOrderCode(date, sequence) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const seqStr = String(Math.max(1, sequence)).padStart(4, "0");
  return `HZV-${year}${month}-${seqStr}`;
}
function validateOrderInput(input) {
  const errors = {};
  if (!input.customerName || input.customerName.trim().length < 2) {
    errors.customerName = "Nama lengkap wajib diisi (minimal 2 karakter).";
  }
  const normalizedPhone = normalizeWhatsappNumber(input.customerPhone || "");
  if (!normalizedPhone || normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    errors.customerPhone = "Nomor WhatsApp tidak valid (contoh: 089515559477).";
  }
  if (!input.pickupAddress || input.pickupAddress.trim().length < 8) {
    errors.pickupAddress = "Alamat penjemputan wajib diisi secara lengkap.";
  }
  if (!input.serviceId) {
    errors.serviceId = "Silakan pilih jenis layanan.";
  }
  if (!Number.isFinite(input.estimatedWeight) || input.estimatedWeight < 1) {
    errors.estimatedWeight = "Minimal berat cucian adalah 1 kg.";
  }
  if (!input.pickupDate) {
    errors.pickupDate = "Tanggal penjemputan wajib dipilih.";
  }
  if (!input.pickupTime) {
    errors.pickupTime = "Jam penjemputan wajib dipilih.";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
function getStageLabel(status) {
  return ORDER_STAGES.find((stage) => stage.code === status)?.label ?? "Order Diterima";
}
function matchFaqFallbackAnswer(question, services, settings) {
  const q = question.toLowerCase();
  const cuciKering = services.find((s) => s.slug === "cuci-kering") ?? {
    name: "Cuci Kering",
    pricePerKg: 7e3
  };
  const cuciSetrika = services.find((s) => s.slug === "cuci-setrika") ?? {
    name: "Cuci Setrika",
    pricePerKg: 1e4
  };
  if (/(cuci kering|kering saja|tanpa setrika)/.test(q)) {
    return `Harga layanan ${cuciKering.name} di Laundry Huzavin adalah ${formatRupiah(
      cuciKering.pricePerKg
    )}/kg (sudah dicuci bersih dan dikeringkan, estimasi selesai 1\u20132 hari). Minimal order 1 kg dan antar jemput gratis ya!`;
  }
  if (/(cuci setrika|setrika|komplit|lengkap)/.test(q)) {
    return `Harga layanan ${cuciSetrika.name} di Laundry Huzavin adalah ${formatRupiah(
      cuciSetrika.pricePerKg
    )}/kg (dicuci bersih, dikeringkan, lalu disetrika rapi maksimal). Estimasi selesai 1\u20132 hari dan antar jemput gratis!`;
  }
  if (/(harga|tarif|biaya|bayar|berapa|price)/.test(q)) {
    return `Daftar harga Laundry Huzavin:
\u2022 ${cuciKering.name}: ${formatRupiah(
      cuciKering.pricePerKg
    )}/kg
\u2022 ${cuciSetrika.name}: ${formatRupiah(
      cuciSetrika.pricePerKg
    )}/kg

Minimal order hanya 1 kg dan sudah gratis antar jemput. Anda juga bisa pakai Kalkulator Harga di website kami!`;
  }
  if (/(minimal|minimum|paling sedikit|kilo|kg)/.test(q)) {
    return "Minimal order di Laundry Huzavin adalah 1 kg saja, dan mendukung berat desimal seperti 1,5 kg atau 2,5 kg setelah penimbangan akhir.";
  }
  if (/(lama|berapa hari|estimasi|selesai|cepat|durasi|waktu)/.test(q)) {
    return "Estimasi pengerjaan cucian di Laundry Huzavin adalah 1\u20132 hari agar hasilnya benar-benar bersih higienis dan rapi maksimal.";
  }
  if (/(antar|jemput|pickup|kurir|ongkir|gratis)/.test(q)) {
    return "Ya! Laundry Huzavin menyediakan layanan antar jemput GRATIS untuk area layanan kami di Sawangan, Pasir Putih, dan sekitarnya. Tinggal duduk manis, kami jemput dan antar cucian bersih Anda.";
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
    return "Halo! Selamat datang di Laundry Huzavin. Ada yang bisa Huzavin AI Assistant bantu seputar harga, layanan antar jemput gratis, cara pesan, atau cek status cucian?";
  }
  return `Terima kasih atas pertanyaannya! Untuk informasi lebih detail atau kebutuhan khusus, silakan langsung hubungi admin kami melalui tombol "Chat Admin" ke WhatsApp ${settings.whatsappDisplay}.`;
}

// server/db.ts
var dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
var dbPath = path.join(dataDir, "huzavin.db");
var db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price_per_kg INTEGER NOT NULL,
      description TEXT NOT NULL,
      estimated_duration TEXT NOT NULL DEFAULT '1\u20132 hari',
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const serviceCount = db.prepare("SELECT COUNT(*) as count FROM services").get();
  if (serviceCount.count === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (id, slug, name, price_per_kg, description, estimated_duration, includes_ironing, is_active, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertService.run(
      "cuci-kering",
      "cuci-kering",
      "Cuci Kering",
      7e3,
      "Pakaian dicuci hingga bersih higienis dengan deterjen pilihan dan dikeringkan menyeluruh.",
      "1\u20132 hari",
      0,
      1,
      1,
      now
    );
    insertService.run(
      "cuci-setrika",
      "cuci-setrika",
      "Cuci Setrika",
      1e4,
      "Pakaian dicuci bersih higienis, dikeringkan, kemudian disetrika uap dan dilipat hingga rapi maksimal.",
      "1\u20132 hari",
      1,
      1,
      2,
      now
    );
  }
  const upsertSetting = db.prepare(`
    INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
  `);
  upsertSetting.run("businessName", DEFAULT_SITE_SETTINGS.businessName, now);
  upsertSetting.run("sloganMain", DEFAULT_SITE_SETTINGS.sloganMain, now);
  upsertSetting.run("sloganSecondary", DEFAULT_SITE_SETTINGS.sloganSecondary, now);
  upsertSetting.run("address", DEFAULT_SITE_SETTINGS.address, now);
  upsertSetting.run("whatsappRaw", DEFAULT_SITE_SETTINGS.whatsappRaw, now);
  upsertSetting.run("whatsappDisplay", DEFAULT_SITE_SETTINGS.whatsappDisplay, now);
  const galleryCount = db.prepare("SELECT COUNT(*) as count FROM gallery").get();
  if (galleryCount.count === 0) {
    const insertGallery = db.prepare(`
      INSERT INTO gallery (id, title, category, image_url, before_image_url, caption, is_illustration, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertGallery.run(
      "gal-before",
      "Tumpukan Pakaian Sebelum Dicuci (Ilustrasi)",
      "Pakaian sebelum dicuci",
      "/src/assets/images/before_messy_laundry_1794848015072.jpg",
      null,
      "Ilustrasi kondisi cucian menumpuk sebelum dijemput gratis oleh kurir Laundry Huzavin.",
      1,
      1,
      now
    );
    insertGallery.run(
      "gal-after",
      "Hasil Setrika & Lipatan Rapi (Ilustrasi)",
      "Pakaian terlipat rapi",
      "/src/assets/images/after_neat_laundry_1794848015827.jpg",
      "/src/assets/images/before_messy_laundry_1794848015072.jpg",
      "Ilustrasi hasil akhir pakaian yang bersih higienis, wangi lembut, disetrika dan dilipat rapi.",
      1,
      2,
      now
    );
    insertGallery.run(
      "gal-care",
      "Peralatan & Deterjen Higienis (Ilustrasi)",
      "Peralatan laundry",
      "/src/assets/images/laundry_equipment_care_1794848016294.jpg",
      null,
      "Ilustrasi penggunaan deterjen higienis, pewangi lembut, dan penjemuran terawat.",
      1,
      3,
      now
    );
  }
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM admin_profiles").get();
  if (adminCount.count === 0) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "abiumi";
    const passwordHash = bcrypt.hashSync(initialPassword, 12);
    db.prepare(`
      INSERT INTO admin_profiles (id, username, password_hash, display_name, must_change_password, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), "huzavin", passwordHash, "Pemilik Laundry Huzavin", 1, now);
  }
}
function getServices(includeInactive = false) {
  const rows = db.prepare(
    `SELECT id, slug, name, price_per_kg, description, estimated_duration, includes_ironing, is_active, sort_order
       FROM services ${includeInactive ? "" : "WHERE is_active = 1"} ORDER BY sort_order ASC`
  ).all();
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    pricePerKg: row.price_per_kg,
    description: row.description,
    estimatedDuration: row.estimated_duration,
    includesIroning: Boolean(row.includes_ironing),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order
  }));
}
function getSiteSettings() {
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    businessName: map.get("businessName") ?? DEFAULT_SITE_SETTINGS.businessName,
    sloganMain: map.get("sloganMain") ?? DEFAULT_SITE_SETTINGS.sloganMain,
    sloganSecondary: map.get("sloganSecondary") ?? DEFAULT_SITE_SETTINGS.sloganSecondary,
    address: map.get("address") ?? DEFAULT_SITE_SETTINGS.address,
    whatsappRaw: map.get("whatsappRaw") ?? DEFAULT_SITE_SETTINGS.whatsappRaw,
    whatsappDisplay: map.get("whatsappDisplay") ?? DEFAULT_SITE_SETTINGS.whatsappDisplay
  };
}
function getGalleryItems() {
  const rows = db.prepare(
    `SELECT id, title, category, image_url, before_image_url, caption, is_illustration, sort_order, created_at
       FROM gallery ORDER BY sort_order ASC, created_at DESC`
  ).all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    beforeImageUrl: row.before_image_url,
    caption: row.caption,
    isIllustration: Boolean(row.is_illustration),
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }));
}
function getTestimonials(includeUnpublished = false) {
  const rows = db.prepare(
    `SELECT id, customer_name, avatar_url, rating, comment, is_published, created_at
       FROM testimonials ${includeUnpublished ? "" : "WHERE is_published = 1"} ORDER BY created_at DESC`
  ).all();
  return rows.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    avatarUrl: row.avatar_url,
    rating: row.rating,
    comment: row.comment,
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at
  }));
}
function mapOrderRow(row) {
  return {
    id: String(row.id),
    orderCode: String(row.order_code),
    customerId: row.customer_id ? String(row.customer_id) : null,
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    pickupAddress: String(row.pickup_address),
    pickupLandmark: String(row.pickup_landmark ?? ""),
    serviceId: String(row.service_id),
    serviceName: String(row.service_name),
    includesIroning: Boolean(row.includes_ironing),
    pricePerKg: Number(row.price_per_kg),
    estimatedWeight: Number(row.estimated_weight),
    finalWeight: row.final_weight === null || row.final_weight === void 0 ? null : Number(row.final_weight),
    estimatedPrice: Number(row.estimated_price),
    finalPrice: row.final_price === null || row.final_price === void 0 ? null : Number(row.final_price),
    pickupDate: String(row.pickup_date),
    pickupTime: String(row.pickup_time),
    notes: String(row.notes ?? ""),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
function getOrderHistory(orderId) {
  const rows = db.prepare(
    `SELECT id, order_id, status, description, updated_by, created_at
       FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC`
  ).all(orderId);
  return rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    status: r.status,
    description: r.description,
    updatedBy: r.updated_by,
    createdAt: r.created_at
  }));
}
function createNextOrderCode(now) {
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `HZV-${yearMonth}-`;
  const lastRow = db.prepare(`SELECT order_code FROM orders WHERE order_code LIKE ? ORDER BY order_code DESC LIMIT 1`).get(`${prefix}%`);
  let nextSeq = 1;
  if (lastRow?.order_code) {
    const tail = Number.parseInt(lastRow.order_code.replace(prefix, ""), 10);
    if (Number.isFinite(tail)) {
      nextSeq = tail + 1;
    }
  }
  return generateOrderCode(now, nextSeq);
}

// server/auth.ts
import crypto2 from "crypto";
import fs2 from "fs";
import path2 from "path";
import bcrypt2 from "bcryptjs";
var COOKIE_NAME = "huzavin_admin_session";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 12;
function loadOrCreateSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretPath = path2.resolve(process.cwd(), "data", ".session_secret");
  if (fs2.existsSync(secretPath)) {
    const existing = fs2.readFileSync(secretPath, "utf8").trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto2.randomBytes(32).toString("hex");
  fs2.mkdirSync(path2.dirname(secretPath), { recursive: true });
  fs2.writeFileSync(secretPath, generated, { mode: 384 });
  return generated;
}
var SESSION_SECRET = loadOrCreateSessionSecret();
function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto2.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
function verifyToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expectedSig = crypto2.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto2.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed.adminId || !parsed.username || typeof parsed.exp !== "number") {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function authenticateAdminCredentials(username, password) {
  const cleanUser = username.trim().toLowerCase();
  const row = db.prepare(
    `SELECT id, username, password_hash, display_name, must_change_password
       FROM admin_profiles WHERE LOWER(username) = ?`
  ).get(cleanUser);
  if (!row) return null;
  const valid = bcrypt2.compareSync(password, row.password_hash);
  if (!valid) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    mustChangePassword: Boolean(row.must_change_password)
  };
}
function setAdminSessionCookie(res, admin) {
  const token = signToken({
    adminId: admin.id,
    username: admin.username,
    exp: Date.now() + SESSION_TTL_MS
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://"),
    maxAge: SESSION_TTL_MS,
    path: "/"
  });
}
function clearAdminSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
function readAdminFromRequest(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || typeof token !== "string") return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const row = db.prepare(
    `SELECT id, username, display_name, must_change_password
       FROM admin_profiles WHERE id = ?`
  ).get(payload.adminId);
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    mustChangePassword: Boolean(row.must_change_password)
  };
}
function requireAdmin(req, res, next) {
  const admin = readAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ error: "Sesi admin tidak valid atau telah berakhir. Silakan login kembali." });
    return;
  }
  req.admin = admin;
  next();
}
function changeAdminPassword(adminId, currentPassword, newPassword) {
  const row = db.prepare("SELECT password_hash FROM admin_profiles WHERE id = ?").get(adminId);
  if (!row) {
    return { ok: false, error: "Akun admin tidak ditemukan." };
  }
  if (!bcrypt2.compareSync(currentPassword, row.password_hash)) {
    return { ok: false, error: "Password saat ini tidak sesuai." };
  }
  if (newPassword.trim().length < 6) {
    return { ok: false, error: "Password baru minimal 6 karakter." };
  }
  const nextHash = bcrypt2.hashSync(newPassword, 12);
  db.prepare("UPDATE admin_profiles SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?").run(
    nextHash,
    (/* @__PURE__ */ new Date()).toISOString(),
    adminId
  );
  return { ok: true };
}

// server/geminiChat.ts
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import crypto3 from "crypto";
async function generateAssistantReply(params) {
  const cleanMessage = params.message.trim();
  const services = getServices(false);
  const settings = getSiteSettings();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare(
    `INSERT INTO chatbot_conversations (id, session_id, role, message, source, created_at)
     VALUES (?, ?, 'user', ?, 'client', ?)`
  ).run(crypto3.randomUUID(), params.sessionId, cleanMessage, now);
  const apiKey = process.env.GEMINI_API_KEY;
  let replyText = "";
  let source = "faq-fallback";
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const priceLines = services.map((s) => `- ${s.name}: ${formatRupiah(s.pricePerKg)}/kg (${s.description}, estimasi ${s.estimatedDuration})`).join("\n");
      const systemInstruction = `Kamu adalah "Huzavin AI Assistant", asisten pelanggan resmi untuk ${settings.businessName}.
Sifatmu: ramah, sopan, membantu, berbicara Bahasa Indonesia yang santun dan ringkas (2\u20134 kalimat).

Informasi Resmi ${settings.businessName} (JANGAN mengarang di luar data ini):
- Slogan: "${settings.sloganMain}" dan "${settings.sloganSecondary}"
- Daftar Layanan & Harga Saat Ini:
${priceLines}
- Minimal order: 1 kg (mendukung berat desimal setelah penimbangan akhir, misalnya 1,5 kg atau 2,5 kg).
- Estimasi pengerjaan: 1\u20132 hari.
- Antar jemput: GRATIS antar jemput laundry untuk area layanan Sawangan, Pasir Putih, dan sekitarnya.
- Alamat lengkap: ${settings.address}
- WhatsApp Admin: ${settings.whatsappDisplay}
- Cara pesan: Pelanggan bisa mengisi formulir "Buat Pesanan Sekarang" di website untuk mendapatkan Kode Order otomatis (format HZV-YYYYMM-XXXX) dan mengirim konfirmasi ke WhatsApp admin, atau langsung chat WhatsApp admin.
- Cara cek status cucian: Masukkan Kode Order di menu "Lacak Cucian Kamu" / "Cek Status" pada website untuk melihat progres 10 tahap secara real-time.

Aturan ketat:
1. Jika pertanyaan di luar informasi resmi di atas atau menanyakan promo/diskon khusus/keluhan order pribadi, JANGAN mengarang jawaban. Arahkan pelanggan dengan ramah untuk menekan tombol "CHAT ADMIN" agar terhubung ke WhatsApp admin ${settings.whatsappDisplay}.
2. Gunakan format Rupiah yang jelas (contoh: Rp7.000/kg, Rp10.000/kg).`;
      const recentHistory = params.history.slice(-6).map((turn) => `${turn.role === "user" ? "Pelanggan" : "Huzavin AI"}: ${turn.message}`).join("\n");
      const prompt = recentHistory ? `Riwayat percakapan:
${recentHistory}

Pertanyaan terbaru pelanggan: ${cleanMessage}` : cleanMessage;
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
      if (response.text && response.text.trim().length > 0) {
        replyText = response.text.trim();
        source = "gemini";
      }
    } catch (error) {
      console.warn("[Huzavin AI] Falling back to deterministic FAQ matcher:", error instanceof Error ? error.message : error);
    }
  }
  if (!replyText) {
    replyText = matchFaqFallbackAnswer(cleanMessage, services, settings);
    source = "faq-fallback";
  }
  db.prepare(
    `INSERT INTO chatbot_conversations (id, session_id, role, message, source, created_at)
     VALUES (?, ?, 'assistant', ?, ?, ?)`
  ).run(crypto3.randomUUID(), params.sessionId, replyText, source, (/* @__PURE__ */ new Date()).toISOString());
  return { reply: replyText, source };
}

// server.ts
initDatabase();
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
var trackingStreams = /* @__PURE__ */ new Map();
function broadcastOrderUpdate(orderCode) {
  const key = orderCode.trim().toUpperCase();
  const listeners = trackingStreams.get(key);
  if (!listeners || listeners.size === 0) return;
  const row = db.prepare("SELECT * FROM orders WHERE UPPER(order_code) = ?").get(key);
  if (!row) return;
  const order = mapOrderRow(row);
  const history = getOrderHistory(order.id);
  const payload = JSON.stringify({
    orderCode: order.orderCode,
    status: order.status,
    statusLabel: getStageLabel(order.status),
    finalWeight: order.finalWeight,
    finalPrice: order.finalPrice,
    updatedAt: order.updatedAt,
    history
  });
  for (const res of listeners) {
    res.write(`event: status-update
data: ${payload}

`);
  }
}
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    databaseEngine: "sqlite",
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY")
  });
});
app.get("/api/bootstrap", (_req, res) => {
  res.json({
    services: getServices(false),
    settings: getSiteSettings(),
    gallery: getGalleryItems(),
    testimonials: getTestimonials(false)
  });
});
app.get("/api/services", (_req, res) => {
  res.json({ services: getServices(false) });
});
app.get("/api/settings", (_req, res) => {
  res.json({ settings: getSiteSettings() });
});
app.get("/api/gallery", (_req, res) => {
  res.json({ gallery: getGalleryItems() });
});
app.get("/api/testimonials", (_req, res) => {
  res.json({ testimonials: getTestimonials(false) });
});
app.post("/api/orders", (req, res) => {
  const body = req.body ?? {};
  const estimatedWeight = parseWeightInput(body.estimatedWeight);
  const validation = validateOrderInput({
    customerName: String(body.customerName ?? ""),
    customerPhone: String(body.customerPhone ?? ""),
    pickupAddress: String(body.pickupAddress ?? ""),
    pickupLandmark: String(body.pickupLandmark ?? ""),
    serviceId: String(body.serviceId ?? ""),
    estimatedWeight,
    pickupDate: String(body.pickupDate ?? ""),
    pickupTime: String(body.pickupTime ?? ""),
    notes: String(body.notes ?? "")
  });
  if (!validation.valid) {
    res.status(400).json({ error: "Data pemesanan belum lengkap atau tidak valid.", errors: validation.errors });
    return;
  }
  const serviceRow = db.prepare("SELECT id, name, price_per_kg, includes_ironing FROM services WHERE id = ? AND is_active = 1").get(String(body.serviceId));
  if (!serviceRow) {
    res.status(400).json({ error: "Layanan laundry yang dipilih tidak ditemukan." });
    return;
  }
  const nowDate = /* @__PURE__ */ new Date();
  const nowIso = nowDate.toISOString();
  const normalizedPhone = normalizeWhatsappNumber(String(body.customerPhone));
  const cleanName = String(body.customerName).trim();
  const cleanAddress = String(body.pickupAddress).trim();
  const cleanLandmark = String(body.pickupLandmark ?? "").trim();
  const cleanNotes = String(body.notes ?? "").trim();
  const estimatedPrice = calculateEstimatedPrice(estimatedWeight, serviceRow.price_per_kg);
  const tx = db.transaction(() => {
    let customerRow = db.prepare("SELECT id FROM customers WHERE whatsapp = ?").get(normalizedPhone);
    let customerId = customerRow?.id;
    if (customerId) {
      db.prepare("UPDATE customers SET name = ?, last_address = ?, last_landmark = ?, updated_at = ? WHERE id = ?").run(
        cleanName,
        cleanAddress,
        cleanLandmark,
        nowIso,
        customerId
      );
    } else {
      customerId = crypto4.randomUUID();
      db.prepare(
        `INSERT INTO customers (id, name, whatsapp, last_address, last_landmark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(customerId, cleanName, normalizedPhone, cleanAddress, cleanLandmark, nowIso, nowIso);
    }
    const orderId = crypto4.randomUUID();
    const orderCode = createNextOrderCode(nowDate);
    const initialStatus = "ORDER_DITERIMA";
    db.prepare(
      `INSERT INTO orders (
        id, order_code, customer_id, customer_name, customer_phone,
        pickup_address, pickup_landmark, service_id, service_name, includes_ironing,
        price_per_kg, estimated_weight, final_weight, estimated_price, final_price,
        pickup_date, pickup_time, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      orderCode,
      customerId,
      cleanName,
      normalizedPhone,
      cleanAddress,
      cleanLandmark,
      serviceRow.id,
      serviceRow.name,
      serviceRow.includes_ironing,
      serviceRow.price_per_kg,
      estimatedWeight,
      estimatedPrice,
      String(body.pickupDate),
      String(body.pickupTime),
      cleanNotes,
      initialStatus,
      nowIso,
      nowIso
    );
    db.prepare(
      `INSERT INTO order_status_history (id, order_id, status, description, updated_by, created_at)
       VALUES (?, ?, ?, ?, 'Sistem Website', ?)`
    ).run(
      crypto4.randomUUID(),
      orderId,
      initialStatus,
      "Pesanan berhasil dicatat di sistem Laundry Huzavin. Menunggu konfirmasi admin via WhatsApp.",
      nowIso
    );
    return { orderId, orderCode };
  });
  const result = tx();
  const createdRow = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.orderId);
  const order = mapOrderRow(createdRow);
  const history = getOrderHistory(order.id);
  res.status(201).json({ order, history });
});
app.get("/api/orders/track/:code", (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: "Kode order wajib diisi." });
    return;
  }
  const row = db.prepare("SELECT * FROM orders WHERE UPPER(order_code) = ?").get(code);
  if (!row) {
    res.status(404).json({
      error: "Maaf, kode order tidak ditemukan. Silakan periksa kembali kode pesanan atau hubungi admin Huzavin."
    });
    return;
  }
  const order = mapOrderRow(row);
  const history = getOrderHistory(order.id);
  const last4Query = String(req.query.last4 ?? "").replace(/\D/g, "");
  const verified = last4Query.length === 4 && last4Query === getLastFourDigits(order.customerPhone);
  res.json({
    verified,
    order: {
      orderCode: order.orderCode,
      customerNameDisplay: verified ? order.customerName : maskCustomerName(order.customerName),
      pickupAddress: verified ? order.pickupAddress : null,
      pickupLandmark: verified ? order.pickupLandmark : null,
      serviceName: order.serviceName,
      includesIroning: order.includesIroning,
      estimatedWeight: order.estimatedWeight,
      finalWeight: order.finalWeight,
      estimatedPrice: order.estimatedPrice,
      finalPrice: order.finalPrice,
      pickupDate: order.pickupDate,
      pickupTime: order.pickupTime,
      notes: verified ? order.notes : null,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    },
    history
  });
});
app.post("/api/orders/track/:code/verify", (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  const last4 = String(req.body?.last4 ?? "").replace(/\D/g, "");
  if (last4.length !== 4) {
    res.status(400).json({ error: "Masukkan 4 digit terakhir nomor WhatsApp pemesan." });
    return;
  }
  const row = db.prepare("SELECT * FROM orders WHERE UPPER(order_code) = ?").get(code);
  if (!row) {
    res.status(404).json({ error: "Kode order tidak ditemukan." });
    return;
  }
  const order = mapOrderRow(row);
  if (last4 !== getLastFourDigits(order.customerPhone)) {
    res.status(403).json({ error: "4 digit terakhir nomor WhatsApp tidak cocok dengan pesanan ini." });
    return;
  }
  res.json({
    verified: true,
    customerName: order.customerName,
    pickupAddress: order.pickupAddress,
    pickupLandmark: order.pickupLandmark,
    notes: order.notes
  });
});
app.get("/api/orders/track/:code/stream", (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  if (!code) {
    res.status(400).end();
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  let set = trackingStreams.get(code);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    trackingStreams.set(code, set);
  }
  set.add(res);
  res.write(`event: connected
data: ${JSON.stringify({ orderCode: code })}

`);
  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 25e3);
  req.on("close", () => {
    clearInterval(keepAlive);
    const currentSet = trackingStreams.get(code);
    if (currentSet) {
      currentSet.delete(res);
      if (currentSet.size === 0) {
        trackingStreams.delete(code);
      }
    }
  });
});
app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const sessionId = String(req.body?.sessionId ?? crypto4.randomUUID());
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (!message) {
    res.status(400).json({ error: "Pesan tidak boleh kosong." });
    return;
  }
  try {
    const result = await generateAssistantReply({
      sessionId,
      message,
      history
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Gagal memproses pesan asisten."
    });
  }
});
app.get("/api/admin/me", (req, res) => {
  const admin = readAdminFromRequest(req);
  if (!admin) {
    res.json({ authenticated: false, admin: null });
    return;
  }
  res.json({ authenticated: true, admin });
});
app.post("/api/admin/login", (req, res) => {
  const username = String(req.body?.username ?? "");
  const password = String(req.body?.password ?? "");
  if (!username.trim() || !password) {
    res.status(400).json({ error: "Username dan password wajib diisi." });
    return;
  }
  const admin = authenticateAdminCredentials(username, password);
  if (!admin) {
    res.status(401).json({ error: "Username atau password admin salah." });
    return;
  }
  setAdminSessionCookie(res, admin);
  res.json({ authenticated: true, admin });
});
app.post("/api/admin/logout", (_req, res) => {
  clearAdminSessionCookie(res);
  res.json({ ok: true });
});
app.post("/api/admin/change-password", requireAdmin, (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (!req.admin) {
    res.status(401).json({ error: "Tidak terautentikasi." });
    return;
  }
  const result = changeAdminPassword(req.admin.id, currentPassword, newPassword);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, message: "Password admin berhasil diperbarui." });
});
app.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const orderRows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  const orders = orderRows.map(mapOrderRow);
  const totalOrders = orders.length;
  const newOrders = orders.filter((o) => o.status === "ORDER_DITERIMA").length;
  const waitingPickup = orders.filter((o) => o.status === "MENUNGGU_PENJEMPUTAN").length;
  const inProcess = orders.filter(
    (o) => ["CUCIAN_TELAH_DIJEMPUT", "CUCIAN_DITERIMA_DI_HUZAVIN", "SEDANG_DICUCI", "SEDANG_DIKERINGKAN", "SEDANG_DISETRIKA"].includes(
      o.status
    )
  ).length;
  const washingNow = orders.filter((o) => o.status === "SEDANG_DICUCI").length;
  const readyToDeliver = orders.filter((o) => o.status === "SIAP_DIANTAR").length;
  const completedOrders = orders.filter((o) => o.status === "PESANAN_SELESAI").length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.finalPrice ?? o.estimatedPrice), 0);
  res.json({
    summary: {
      totalOrders,
      newOrders,
      waitingPickup,
      inProcess,
      washingNow,
      readyToDeliver,
      completedOrders,
      totalRevenue
    },
    orders,
    services: getServices(true),
    gallery: getGalleryItems(),
    testimonials: getTestimonials(true),
    settings: getSiteSettings(),
    databaseStatus: {
      activeEngine: "sqlite",
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    }
  });
});
app.get("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Pesanan tidak ditemukan." });
    return;
  }
  const order = mapOrderRow(row);
  const history = getOrderHistory(order.id);
  res.json({ order, history });
});
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const orderId = String(req.params.id);
  const existingRow = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!existingRow) {
    res.status(404).json({ error: "Pesanan tidak ditemukan." });
    return;
  }
  const existing = mapOrderRow(existingRow);
  const nextStatus = req.body?.status ? String(req.body.status) : existing.status;
  const validStatusCodes = new Set(ORDER_STAGES.map((s) => s.code));
  if (!validStatusCodes.has(nextStatus)) {
    res.status(400).json({ error: "Status laundry tidak valid." });
    return;
  }
  let nextFinalWeight = existing.finalWeight;
  if (req.body?.finalWeight !== void 0) {
    if (req.body.finalWeight === null || req.body.finalWeight === "") {
      nextFinalWeight = null;
    } else {
      const parsed = parseWeightInput(req.body.finalWeight);
      if (parsed < 1) {
        res.status(400).json({ error: "Berat cucian minimal 1 kg." });
        return;
      }
      nextFinalWeight = parsed;
    }
  }
  let nextFinalPrice = existing.finalPrice;
  if (req.body?.finalPrice !== void 0) {
    if (req.body.finalPrice === null || req.body.finalPrice === "") {
      nextFinalPrice = null;
    } else {
      const parsedPrice = Number(req.body.finalPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ error: "Total pembayaran tidak valid." });
        return;
      }
      nextFinalPrice = Math.round(parsedPrice);
    }
  }
  const statusChanged = nextStatus !== existing.status;
  const statusNote = String(req.body?.statusNote ?? "").trim();
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  db.transaction(() => {
    db.prepare(
      `UPDATE orders
       SET status = ?, final_weight = ?, final_price = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextStatus, nextFinalWeight, nextFinalPrice, nowIso, orderId);
    if (statusChanged || statusNote) {
      const stageDesc = statusNote || ORDER_STAGES.find((s) => s.code === nextStatus)?.description || `Status diperbarui ke ${getStageLabel(nextStatus)}.`;
      db.prepare(
        `INSERT INTO order_status_history (id, order_id, status, description, updated_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        crypto4.randomUUID(),
        orderId,
        nextStatus,
        stageDesc,
        req.admin?.displayName || "Admin Huzavin",
        nowIso
      );
    }
  })();
  broadcastOrderUpdate(existing.orderCode);
  const updatedRow = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  const order = mapOrderRow(updatedRow);
  const history = getOrderHistory(orderId);
  res.json({ order, history });
});
app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const orderId = String(req.params.id);
  const result = db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  if (result.changes === 0) {
    res.status(404).json({ error: "Pesanan tidak ditemukan." });
    return;
  }
  res.json({ ok: true });
});
app.put("/api/admin/services/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const pricePerKg = Number(req.body?.pricePerKg);
  const name = String(req.body?.name ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const estimatedDuration = String(req.body?.estimatedDuration ?? "1\u20132 hari").trim();
  if (!name || !Number.isFinite(pricePerKg) || pricePerKg < 1e3) {
    res.status(400).json({ error: "Nama layanan dan harga/kg yang valid wajib diisi." });
    return;
  }
  const result = db.prepare(
    `UPDATE services
       SET name = ?, price_per_kg = ?, description = ?, estimated_duration = ?, updated_at = ?
       WHERE id = ?`
  ).run(name, Math.round(pricePerKg), description, estimatedDuration, (/* @__PURE__ */ new Date()).toISOString(), id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Layanan tidak ditemukan." });
    return;
  }
  res.json({ services: getServices(true) });
});
app.post("/api/admin/gallery", requireAdmin, (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  const category = String(req.body?.category ?? "").trim();
  const imageUrl = String(req.body?.imageUrl ?? "").trim();
  const beforeImageUrl = req.body?.beforeImageUrl ? String(req.body.beforeImageUrl).trim() : null;
  const caption = String(req.body?.caption ?? "").trim();
  const isIllustration = Boolean(req.body?.isIllustration);
  if (!title || !category || !imageUrl) {
    res.status(400).json({ error: "Judul, kategori, dan gambar wajib diisi." });
    return;
  }
  const id = crypto4.randomUUID();
  db.prepare(
    `INSERT INTO gallery (id, title, category, image_url, before_image_url, caption, is_illustration, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, title, category, imageUrl, beforeImageUrl, caption, isIllustration ? 1 : 0, (/* @__PURE__ */ new Date()).toISOString());
  res.status(201).json({ gallery: getGalleryItems() });
});
app.put("/api/admin/gallery/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const title = String(req.body?.title ?? "").trim();
  const category = String(req.body?.category ?? "").trim();
  const imageUrl = String(req.body?.imageUrl ?? "").trim();
  const beforeImageUrl = req.body?.beforeImageUrl ? String(req.body.beforeImageUrl).trim() : null;
  const caption = String(req.body?.caption ?? "").trim();
  const isIllustration = Boolean(req.body?.isIllustration);
  if (!title || !category || !imageUrl) {
    res.status(400).json({ error: "Judul, kategori, dan gambar wajib diisi." });
    return;
  }
  db.prepare(
    `UPDATE gallery
     SET title = ?, category = ?, image_url = ?, before_image_url = ?, caption = ?, is_illustration = ?
     WHERE id = ?`
  ).run(title, category, imageUrl, beforeImageUrl, caption, isIllustration ? 1 : 0, id);
  res.json({ gallery: getGalleryItems() });
});
app.delete("/api/admin/gallery/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM gallery WHERE id = ?").run(String(req.params.id));
  res.json({ gallery: getGalleryItems() });
});
app.post("/api/admin/testimonials", requireAdmin, (req, res) => {
  const customerName = String(req.body?.customerName ?? "").trim();
  const comment = String(req.body?.comment ?? "").trim();
  const rating = Math.min(5, Math.max(1, Number(req.body?.rating) || 5));
  const avatarUrl = req.body?.avatarUrl ? String(req.body.avatarUrl).trim() : null;
  if (!customerName || !comment) {
    res.status(400).json({ error: "Nama pelanggan dan komentar wajib diisi." });
    return;
  }
  db.prepare(
    `INSERT INTO testimonials (id, customer_name, avatar_url, rating, comment, is_published, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(crypto4.randomUUID(), customerName, avatarUrl, rating, comment, (/* @__PURE__ */ new Date()).toISOString());
  res.status(201).json({ testimonials: getTestimonials(true) });
});
app.put("/api/admin/testimonials/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const customerName = String(req.body?.customerName ?? "").trim();
  const comment = String(req.body?.comment ?? "").trim();
  const rating = Math.min(5, Math.max(1, Number(req.body?.rating) || 5));
  const avatarUrl = req.body?.avatarUrl ? String(req.body.avatarUrl).trim() : null;
  if (!customerName || !comment) {
    res.status(400).json({ error: "Nama pelanggan dan komentar wajib diisi." });
    return;
  }
  db.prepare(
    `UPDATE testimonials SET customer_name = ?, avatar_url = ?, rating = ?, comment = ? WHERE id = ?`
  ).run(customerName, avatarUrl, rating, comment, id);
  res.json({ testimonials: getTestimonials(true) });
});
app.delete("/api/admin/testimonials/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM testimonials WHERE id = ?").run(String(req.params.id));
  res.json({ testimonials: getTestimonials(true) });
});
app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const businessName = String(req.body?.businessName ?? "").trim();
  const sloganMain = String(req.body?.sloganMain ?? "").trim();
  const sloganSecondary = String(req.body?.sloganSecondary ?? "").trim();
  const address = String(req.body?.address ?? "").trim();
  const whatsappDisplay = String(req.body?.whatsappDisplay ?? "").trim();
  const whatsappRaw = normalizeWhatsappNumber(whatsappDisplay);
  if (!businessName || !address || !whatsappRaw) {
    res.status(400).json({ error: "Nama bisnis, alamat, dan nomor WhatsApp wajib diisi." });
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const upsert = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  db.transaction(() => {
    upsert.run("businessName", businessName, now);
    upsert.run("sloganMain", sloganMain, now);
    upsert.run("sloganSecondary", sloganSecondary, now);
    upsert.run("address", address, now);
    upsert.run("whatsappDisplay", whatsappDisplay, now);
    upsert.run("whatsappRaw", whatsappRaw, now);
  })();
  res.json({ settings: getSiteSettings() });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path3.dirname(fileURLToPath(import.meta.url));
    const distDir = path3.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path3.join(distDir, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Laundry Huzavin server listening on http://localhost:${PORT}`);
  });
}
startServer();

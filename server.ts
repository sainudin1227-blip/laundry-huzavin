import 'dotenv/config';
import express, { Response } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createNextOrderCode,
  db,
  getGalleryItems,
  getOrderHistory,
  getServices,
  getSiteSettings,
  getTestimonials,
  initDatabase,
  mapOrderRow,
} from './server/db';
import {
  authenticateAdminCredentials,
  AuthenticatedRequest,
  changeAdminPassword,
  clearAdminSessionCookie,
  readAdminFromRequest,
  requireAdmin,
  setAdminSessionCookie,
} from './server/auth';
import { generateAssistantReply } from './server/geminiChat';
import {
  calculateEstimatedPrice,
  getLastFourDigits,
  getStageLabel,
  maskCustomerName,
  normalizeWhatsappNumber,
  ORDER_STAGES,
  OrderStatusCode,
  parseWeightInput,
  validateOrderInput,
} from './src/lib/laundryRules';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Track SSE listeners per order code (normalized uppercase) for live real-time tracking updates
const trackingStreams = new Map<string, Set<Response>>();

function broadcastOrderUpdate(orderCode: string): void {
  const key = orderCode.trim().toUpperCase();
  const listeners = trackingStreams.get(key);
  if (!listeners || listeners.size === 0) return;

  const row = db.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?').get(key) as Record<string, unknown> | undefined;
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
    history,
  });

  for (const res of listeners) {
    res.write(`event: status-update\ndata: ${payload}\n\n`);
  }
}

// ---------------------------------------------------------------------------
// PUBLIC ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    databaseEngine: 'sqlite',
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    services: getServices(false),
    settings: getSiteSettings(),
    gallery: getGalleryItems(),
    testimonials: getTestimonials(false),
  });
});

app.get('/api/services', (_req, res) => {
  res.json({ services: getServices(false) });
});

app.get('/api/settings', (_req, res) => {
  res.json({ settings: getSiteSettings() });
});

app.get('/api/gallery', (_req, res) => {
  res.json({ gallery: getGalleryItems() });
});

app.get('/api/testimonials', (_req, res) => {
  res.json({ testimonials: getTestimonials(false) });
});

// Create Customer Order + Customer record + Initial Status History
app.post('/api/orders', (req, res) => {
  const body = req.body ?? {};
  const estimatedWeight = parseWeightInput(body.estimatedWeight);

  const validation = validateOrderInput({
    customerName: String(body.customerName ?? ''),
    customerPhone: String(body.customerPhone ?? ''),
    pickupAddress: String(body.pickupAddress ?? ''),
    pickupLandmark: String(body.pickupLandmark ?? ''),
    serviceId: String(body.serviceId ?? ''),
    estimatedWeight,
    pickupDate: String(body.pickupDate ?? ''),
    pickupTime: String(body.pickupTime ?? ''),
    notes: String(body.notes ?? ''),
  });

  if (!validation.valid) {
    res.status(400).json({ error: 'Data pemesanan belum lengkap atau tidak valid.', errors: validation.errors });
    return;
  }

  const serviceRow = db
    .prepare('SELECT id, name, price_per_kg, includes_ironing FROM services WHERE id = ? AND is_active = 1')
    .get(String(body.serviceId)) as
    | { id: string; name: string; price_per_kg: number; includes_ironing: number }
    | undefined;

  if (!serviceRow) {
    res.status(400).json({ error: 'Layanan laundry yang dipilih tidak ditemukan.' });
    return;
  }

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const normalizedPhone = normalizeWhatsappNumber(String(body.customerPhone));
  const cleanName = String(body.customerName).trim();
  const cleanAddress = String(body.pickupAddress).trim();
  const cleanLandmark = String(body.pickupLandmark ?? '').trim();
  const cleanNotes = String(body.notes ?? '').trim();
  const estimatedPrice = calculateEstimatedPrice(estimatedWeight, serviceRow.price_per_kg);

  const tx = db.transaction(() => {
    let customerRow = db.prepare('SELECT id FROM customers WHERE whatsapp = ?').get(normalizedPhone) as
      | { id: string }
      | undefined;

    let customerId = customerRow?.id;
    if (customerId) {
      db.prepare('UPDATE customers SET name = ?, last_address = ?, last_landmark = ?, updated_at = ? WHERE id = ?').run(
        cleanName,
        cleanAddress,
        cleanLandmark,
        nowIso,
        customerId
      );
    } else {
      customerId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO customers (id, name, whatsapp, last_address, last_landmark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(customerId, cleanName, normalizedPhone, cleanAddress, cleanLandmark, nowIso, nowIso);
    }

    const orderId = crypto.randomUUID();
    const orderCode = createNextOrderCode(nowDate);
    const initialStatus: OrderStatusCode = 'ORDER_DITERIMA';

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
      crypto.randomUUID(),
      orderId,
      initialStatus,
      'Pesanan berhasil dicatat di sistem Laundry Huzavin. Menunggu konfirmasi admin via WhatsApp.',
      nowIso
    );

    return { orderId, orderCode };
  });

  const result = tx();
  const createdRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.orderId) as Record<string, unknown>;
  const order = mapOrderRow(createdRow);
  const history = getOrderHistory(order.id);

  res.status(201).json({ order, history });
});

// Track Order by Code (protects PII by masking name/hiding address until 4-digit phone verification)
app.get('/api/orders/track/:code', (req, res) => {
  const code = String(req.params.code ?? '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Kode order wajib diisi.' });
    return;
  }

  const row = db.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?').get(code) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    res.status(404).json({
      error: 'Maaf, kode order tidak ditemukan. Silakan periksa kembali kode pesanan atau hubungi admin Huzavin.',
    });
    return;
  }

  const order = mapOrderRow(row);
  const history = getOrderHistory(order.id);
  const last4Query = String(req.query.last4 ?? '').replace(/\D/g, '');
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
      updatedAt: order.updatedAt,
    },
    history,
  });
});

// Verify 4 last digits of WhatsApp number to reveal full personal order summary
app.post('/api/orders/track/:code/verify', (req, res) => {
  const code = String(req.params.code ?? '').trim().toUpperCase();
  const last4 = String(req.body?.last4 ?? '').replace(/\D/g, '');

  if (last4.length !== 4) {
    res.status(400).json({ error: 'Masukkan 4 digit terakhir nomor WhatsApp pemesan.' });
    return;
  }

  const row = db.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?').get(code) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Kode order tidak ditemukan.' });
    return;
  }

  const order = mapOrderRow(row);
  if (last4 !== getLastFourDigits(order.customerPhone)) {
    res.status(403).json({ error: '4 digit terakhir nomor WhatsApp tidak cocok dengan pesanan ini.' });
    return;
  }

  res.json({
    verified: true,
    customerName: order.customerName,
    pickupAddress: order.pickupAddress,
    pickupLandmark: order.pickupLandmark,
    notes: order.notes,
  });
});

// Server-Sent Events (SSE) for live tracking updates without page refresh
app.get('/api/orders/track/:code/stream', (req, res) => {
  const code = String(req.params.code ?? '').trim().toUpperCase();
  if (!code) {
    res.status(400).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let set = trackingStreams.get(code);
  if (!set) {
    set = new Set();
    trackingStreams.set(code, set);
  }
  set.add(res);

  res.write(`event: connected\ndata: ${JSON.stringify({ orderCode: code })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
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

// AI Chatbot Endpoint (server-side Gemini + FAQ fallback)
app.post('/api/chat', async (req, res) => {
  const message = String(req.body?.message ?? '').trim();
  const sessionId = String(req.body?.sessionId ?? crypto.randomUUID());
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) {
    res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    return;
  }

  try {
    const result = await generateAssistantReply({
      sessionId,
      message,
      history,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memproses pesan asisten.',
    });
  }
});

// ---------------------------------------------------------------------------
// ADMIN AUTHENTICATION ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/admin/me', (req, res) => {
  const admin = readAdminFromRequest(req);
  if (!admin) {
    res.json({ authenticated: false, admin: null });
    return;
  }
  res.json({ authenticated: true, admin });
});

app.post('/api/admin/login', (req, res) => {
  const username = String(req.body?.username ?? '');
  const password = String(req.body?.password ?? '');

  if (!username.trim() || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const admin = authenticateAdminCredentials(username, password);
  if (!admin) {
    res.status(401).json({ error: 'Username atau password admin salah.' });
    return;
  }

  setAdminSessionCookie(res, admin);
  res.json({ authenticated: true, admin });
});

app.post('/api/admin/logout', (_req, res) => {
  clearAdminSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/admin/change-password', requireAdmin, (req: AuthenticatedRequest, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (!req.admin) {
    res.status(401).json({ error: 'Tidak terautentikasi.' });
    return;
  }

  const result = changeAdminPassword(req.admin.id, currentPassword, newPassword);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ ok: true, message: 'Password admin berhasil diperbarui.' });
});

// ---------------------------------------------------------------------------
// PROTECTED ADMIN DASHBOARD ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const orderRows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<string, unknown>[];
  const orders = orderRows.map(mapOrderRow);

  const totalOrders = orders.length;
  const newOrders = orders.filter((o) => o.status === 'ORDER_DITERIMA').length;
  const waitingPickup = orders.filter((o) => o.status === 'MENUNGGU_PENJEMPUTAN').length;
  const inProcess = orders.filter((o) =>
    ['CUCIAN_TELAH_DIJEMPUT', 'CUCIAN_DITERIMA_DI_HUZAVIN', 'SEDANG_DICUCI', 'SEDANG_DIKERINGKAN', 'SEDANG_DISETRIKA'].includes(
      o.status
    )
  ).length;
  const washingNow = orders.filter((o) => o.status === 'SEDANG_DICUCI').length;
  const readyToDeliver = orders.filter((o) => o.status === 'SIAP_DIANTAR').length;
  const completedOrders = orders.filter((o) => o.status === 'PESANAN_SELESAI').length;

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
      totalRevenue,
    },
    orders,
    services: getServices(true),
    gallery: getGalleryItems(),
    testimonials: getTestimonials(true),
    settings: getSiteSettings(),
    databaseStatus: {
      activeEngine: 'sqlite',
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
});

app.get('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(String(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }
  const order = mapOrderRow(row);
  const history = getOrderHistory(order.id);
  res.json({ order, history });
});

app.patch('/api/admin/orders/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const orderId = String(req.params.id);
  const existingRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined;

  if (!existingRow) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }

  const existing = mapOrderRow(existingRow);
  const nextStatus = req.body?.status ? (String(req.body.status) as OrderStatusCode) : existing.status;
  const validStatusCodes = new Set(ORDER_STAGES.map((s) => s.code));

  if (!validStatusCodes.has(nextStatus)) {
    res.status(400).json({ error: 'Status laundry tidak valid.' });
    return;
  }

  let nextFinalWeight = existing.finalWeight;
  if (req.body?.finalWeight !== undefined) {
    if (req.body.finalWeight === null || req.body.finalWeight === '') {
      nextFinalWeight = null;
    } else {
      const parsed = parseWeightInput(req.body.finalWeight);
      if (parsed < 1) {
        res.status(400).json({ error: 'Berat cucian minimal 1 kg.' });
        return;
      }
      nextFinalWeight = parsed;
    }
  }

  let nextFinalPrice = existing.finalPrice;
  if (req.body?.finalPrice !== undefined) {
    if (req.body.finalPrice === null || req.body.finalPrice === '') {
      nextFinalPrice = null;
    } else {
      const parsedPrice = Number(req.body.finalPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ error: 'Total pembayaran tidak valid.' });
        return;
      }
      nextFinalPrice = Math.round(parsedPrice);
    }
  }

  const statusChanged = nextStatus !== existing.status;
  const statusNote = String(req.body?.statusNote ?? '').trim();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `UPDATE orders
       SET status = ?, final_weight = ?, final_price = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextStatus, nextFinalWeight, nextFinalPrice, nowIso, orderId);

    if (statusChanged || statusNote) {
      const stageDesc =
        statusNote ||
        ORDER_STAGES.find((s) => s.code === nextStatus)?.description ||
        `Status diperbarui ke ${getStageLabel(nextStatus)}.`;

      db.prepare(
        `INSERT INTO order_status_history (id, order_id, status, description, updated_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        orderId,
        nextStatus,
        stageDesc,
        req.admin?.displayName || 'Admin Huzavin',
        nowIso
      );
    }
  })();

  broadcastOrderUpdate(existing.orderCode);

  const updatedRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
  const order = mapOrderRow(updatedRow);
  const history = getOrderHistory(orderId);
  res.json({ order, history });
});

app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orderId = String(req.params.id);
  const result = db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }
  res.json({ ok: true });
});

// Admin: Manage Service Prices
app.put('/api/admin/services/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const pricePerKg = Number(req.body?.pricePerKg);
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const estimatedDuration = String(req.body?.estimatedDuration ?? '1–2 hari').trim();

  if (!name || !Number.isFinite(pricePerKg) || pricePerKg < 1000) {
    res.status(400).json({ error: 'Nama layanan dan harga/kg yang valid wajib diisi.' });
    return;
  }

  const result = db
    .prepare(
      `UPDATE services
       SET name = ?, price_per_kg = ?, description = ?, estimated_duration = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(name, Math.round(pricePerKg), description, estimatedDuration, new Date().toISOString(), id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Layanan tidak ditemukan.' });
    return;
  }

  res.json({ services: getServices(true) });
});

// Admin: Manage Gallery
app.post('/api/admin/gallery', requireAdmin, (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  const category = String(req.body?.category ?? '').trim();
  const imageUrl = String(req.body?.imageUrl ?? '').trim();
  const beforeImageUrl = req.body?.beforeImageUrl ? String(req.body.beforeImageUrl).trim() : null;
  const caption = String(req.body?.caption ?? '').trim();
  const isIllustration = Boolean(req.body?.isIllustration);

  if (!title || !category || !imageUrl) {
    res.status(400).json({ error: 'Judul, kategori, dan gambar wajib diisi.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO gallery (id, title, category, image_url, before_image_url, caption, is_illustration, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, title, category, imageUrl, beforeImageUrl, caption, isIllustration ? 1 : 0, new Date().toISOString());

  res.status(201).json({ gallery: getGalleryItems() });
});

app.put('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const title = String(req.body?.title ?? '').trim();
  const category = String(req.body?.category ?? '').trim();
  const imageUrl = String(req.body?.imageUrl ?? '').trim();
  const beforeImageUrl = req.body?.beforeImageUrl ? String(req.body.beforeImageUrl).trim() : null;
  const caption = String(req.body?.caption ?? '').trim();
  const isIllustration = Boolean(req.body?.isIllustration);

  if (!title || !category || !imageUrl) {
    res.status(400).json({ error: 'Judul, kategori, dan gambar wajib diisi.' });
    return;
  }

  db.prepare(
    `UPDATE gallery
     SET title = ?, category = ?, image_url = ?, before_image_url = ?, caption = ?, is_illustration = ?
     WHERE id = ?`
  ).run(title, category, imageUrl, beforeImageUrl, caption, isIllustration ? 1 : 0, id);

  res.json({ gallery: getGalleryItems() });
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM gallery WHERE id = ?').run(String(req.params.id));
  res.json({ gallery: getGalleryItems() });
});

// Admin: Manage Testimonials
app.post('/api/admin/testimonials', requireAdmin, (req, res) => {
  const customerName = String(req.body?.customerName ?? '').trim();
  const comment = String(req.body?.comment ?? '').trim();
  const rating = Math.min(5, Math.max(1, Number(req.body?.rating) || 5));
  const avatarUrl = req.body?.avatarUrl ? String(req.body.avatarUrl).trim() : null;

  if (!customerName || !comment) {
    res.status(400).json({ error: 'Nama pelanggan dan komentar wajib diisi.' });
    return;
  }

  db.prepare(
    `INSERT INTO testimonials (id, customer_name, avatar_url, rating, comment, is_published, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(crypto.randomUUID(), customerName, avatarUrl, rating, comment, new Date().toISOString());

  res.status(201).json({ testimonials: getTestimonials(true) });
});

app.put('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const customerName = String(req.body?.customerName ?? '').trim();
  const comment = String(req.body?.comment ?? '').trim();
  const rating = Math.min(5, Math.max(1, Number(req.body?.rating) || 5));
  const avatarUrl = req.body?.avatarUrl ? String(req.body.avatarUrl).trim() : null;

  if (!customerName || !comment) {
    res.status(400).json({ error: 'Nama pelanggan dan komentar wajib diisi.' });
    return;
  }

  db.prepare(
    `UPDATE testimonials SET customer_name = ?, avatar_url = ?, rating = ?, comment = ? WHERE id = ?`
  ).run(customerName, avatarUrl, rating, comment, id);

  res.json({ testimonials: getTestimonials(true) });
});

app.delete('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(String(req.params.id));
  res.json({ testimonials: getTestimonials(true) });
});

// Admin: Manage Contact & Site Settings
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const businessName = String(req.body?.businessName ?? '').trim();
  const sloganMain = String(req.body?.sloganMain ?? '').trim();
  const sloganSecondary = String(req.body?.sloganSecondary ?? '').trim();
  const address = String(req.body?.address ?? '').trim();
  const whatsappDisplay = String(req.body?.whatsappDisplay ?? '').trim();
  const whatsappRaw = normalizeWhatsappNumber(whatsappDisplay);

  if (!businessName || !address || !whatsappRaw) {
    res.status(400).json({ error: 'Nama bisnis, alamat, dan nomor WhatsApp wajib diisi.' });
    return;
  }

  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  db.transaction(() => {
    upsert.run('businessName', businessName, now);
    upsert.run('sloganMain', sloganMain, now);
    upsert.run('sloganSecondary', sloganSecondary, now);
    upsert.run('address', address, now);
    upsert.run('whatsappDisplay', whatsappDisplay, now);
    upsert.run('whatsappRaw', whatsappRaw, now);
  })();

  res.json({ settings: getSiteSettings() });
});

// ---------------------------------------------------------------------------
// VITE DEV MIDDLEWARE / PRODUCTION STATIC HOSTING
// ---------------------------------------------------------------------------

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Laundry Huzavin server listening on http://localhost:${PORT}`);
  });
}

startServer();

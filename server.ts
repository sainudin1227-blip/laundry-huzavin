import 'dotenv/config';
import express, { Response } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  clothingUploadsDir,
  createNextOrderCode,
  db,
  deleteClothingPhotoFile,
  getAllClothingItemsWithOrders,
  getClothingPhotos,
  getCustomersDirectory,
  getGalleryItems,
  getOrderHistory,
  getOrderItems,
  getServices,
  getSiteSettings,
  getTestimonials,
  initDatabase,
  mapOrderRow,
  saveClothingPhotoFile,
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
  AdminDecision,
  calculateEstimatedPrice,
  getLastFourDigits,
  getStageLabel,
  ManualClothingItemInput,
  maskCustomerName,
  normalizeWhatsappNumber,
  ORDER_STAGES,
  OrderSource,
  OrderStatusCode,
  parseWeightInput,
  PaymentStatus,
  PhotoStage,
  validateManualOrderInput,
  validateOrderInput,
} from './src/lib/laundryRules';

initDatabase();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// Track SSE listeners per order code for live customer tracking updates
const trackingStreams = new Map<string, Set<Response>>();
// Track SSE listeners for Admin Control Center live order notifications
const adminStreams = new Set<Response>();

function broadcastOrderUpdate(orderCode: string): void {
  const key = orderCode.trim().toUpperCase();
  const listeners = trackingStreams.get(key);
  if (listeners && listeners.size > 0) {
    const row = db.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?').get(key) as
      | Record<string, unknown>
      | undefined;
    if (row) {
      const order = mapOrderRow(row);
      const history = getOrderHistory(order.id);
      const payload = JSON.stringify({
        orderCode: order.orderCode,
        status: order.status,
        statusLabel: getStageLabel(order.status),
        finalWeight: order.finalWeight,
        finalPrice: order.finalPrice,
        paymentStatus: order.paymentStatus,
        adminDecision: order.adminDecision,
        updatedAt: order.updatedAt,
        history,
      });

      for (const res of listeners) {
        res.write(`event: status-update\ndata: ${payload}\n\n`);
      }
    }
  }
}

function broadcastAdminEvent(eventName: string, data: unknown): void {
  if (adminStreams.size === 0) return;
  const serialized = JSON.stringify(data);
  for (const res of adminStreams) {
    res.write(`event: ${eventName}\ndata: ${serialized}\n\n`);
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

// Create Customer Order from Website Booking Form -> automatically enters Admin Pesanan Masuk
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
    const customerRow = db.prepare('SELECT id FROM customers WHERE whatsapp = ?').get(normalizedPhone) as
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
        pickup_date, pickup_time, notes, status, order_source, payment_status, admin_decision,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, 'website', 'belum_dibayar', 'menunggu', ?, ?)`
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

  broadcastAdminEvent('order-created', {
    orderCode: order.orderCode,
    customerName: order.customerName,
    serviceName: order.serviceName,
  });

  res.status(201).json({ order, history });
});

// Track Order by Code (masks customer PII unless 4-digit WhatsApp verification passes)
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
      paymentStatus: order.paymentStatus,
      adminDecision: order.adminDecision,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    history,
  });
});

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

  const sessionToken = setAdminSessionCookie(req, res, admin);
  res.json({ authenticated: true, admin, sessionToken });
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminSessionCookie(req, res);
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
// PROTECTED ADMIN CONTROL CENTER ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/admin/stream', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  adminStreams.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    adminStreams.delete(res);
  });
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const orderRows = db
    .prepare(
      `SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
        (SELECT COUNT(*) FROM clothing_photos cp WHERE cp.order_id = o.id) AS photos_count
       FROM orders o ORDER BY o.created_at DESC`
    )
    .all() as Record<string, unknown>[];

  const orders = orderRows.map(mapOrderRow);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);

  const activeNonRejected = orders.filter((o) => o.adminDecision !== 'ditolak');

  const todayRevenue = activeNonRejected
    .filter((o) => o.createdAt.slice(0, 10) === todayStr && o.paymentStatus === 'lunas')
    .reduce((sum, o) => sum + (o.finalPrice ?? o.estimatedPrice), 0);

  const monthRevenue = activeNonRejected
    .filter((o) => o.createdAt.slice(0, 7) === monthStr && o.paymentStatus === 'lunas')
    .reduce((sum, o) => sum + (o.finalPrice ?? o.estimatedPrice), 0);

  const totalRevenue = activeNonRejected.reduce((sum, o) => sum + (o.finalPrice ?? o.estimatedPrice), 0);
  const unpaidOrders = activeNonRejected.filter((o) => o.paymentStatus === 'belum_dibayar');

  res.json({
    summary: {
      totalOrders: orders.length,
      newOrders: orders.filter((o) => o.status === 'ORDER_DITERIMA' && o.adminDecision !== 'ditolak').length,
      waitingPickup: orders.filter((o) => o.status === 'MENUNGGU_PENJEMPUTAN').length,
      pickedUp: orders.filter((o) => o.status === 'CUCIAN_TELAH_DIJEMPUT').length,
      receivedAtWorkshop: orders.filter((o) => o.status === 'CUCIAN_DITERIMA_DI_HUZAVIN').length,
      washingNow: orders.filter((o) => o.status === 'SEDANG_DICUCI').length,
      dryingNow: orders.filter((o) => o.status === 'SEDANG_DIKERINGKAN').length,
      ironingNow: orders.filter((o) => o.status === 'SEDANG_DISETRIKA').length,
      readyToDeliver: orders.filter((o) => o.status === 'SIAP_DIANTAR').length,
      deliveringNow: orders.filter((o) => o.status === 'DALAM_PENGANTARAN').length,
      completedOrders: orders.filter((o) => o.status === 'PESANAN_SELESAI').length,
      todayRevenue,
      monthRevenue,
      totalRevenue,
      totalTransactions: activeNonRejected.length,
      unpaidOrdersCount: unpaidOrders.length,
      unpaidAmount: unpaidOrders.reduce((sum, o) => sum + (o.finalPrice ?? o.estimatedPrice), 0),
    },
    orders,
    clothingItems: getAllClothingItemsWithOrders(),
    customers: getCustomersDirectory(),
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

// Admin: Create Manual Order (with multiple clothing items + optional clothing photos)
app.post('/api/admin/orders/manual', requireAdmin, (req: AuthenticatedRequest, res) => {
  const body = req.body ?? {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const parsedItems: ManualClothingItemInput[] = rawItems.map((item: Record<string, unknown>) => ({
    category: String(item.category ?? '').trim(),
    quantity: Math.max(1, Number.parseInt(String(item.quantity ?? 1), 10) || 1),
    weightKg: parseWeightInput(item.weightKg as string | number),
    conditionNote: String(item.conditionNote ?? 'Normal').trim() || 'Normal',
    specialNote: String(item.specialNote ?? '').trim(),
  }));

  const totalWeightKg = parseWeightInput(body.totalWeightKg);
  const orderSource: OrderSource = body.orderSource === 'whatsapp' ? 'whatsapp' : 'manual';
  const paymentStatus: PaymentStatus = body.paymentStatus === 'lunas' ? 'lunas' : 'belum_dibayar';

  const validation = validateManualOrderInput({
    customerName: String(body.customerName ?? ''),
    customerPhone: String(body.customerPhone ?? ''),
    pickupAddress: String(body.pickupAddress ?? ''),
    serviceId: String(body.serviceId ?? ''),
    orderSource,
    paymentStatus,
    totalWeightKg,
    notes: String(body.notes ?? ''),
    items: parsedItems,
  });

  if (!validation.valid) {
    res.status(400).json({ error: 'Data pesanan manual belum lengkap atau tidak valid.', errors: validation.errors });
    return;
  }

  const serviceRow = db
    .prepare('SELECT id, name, price_per_kg, includes_ironing FROM services WHERE id = ?')
    .get(String(body.serviceId)) as
    | { id: string; name: string; price_per_kg: number; includes_ironing: number }
    | undefined;

  if (!serviceRow) {
    res.status(400).json({ error: 'Layanan laundry tidak ditemukan.' });
    return;
  }

  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  const savedPhotos: Array<{ fileName: string; mimeType: string; caption: string; photoStage: PhotoStage }> = [];

  try {
    for (const p of rawPhotos) {
      if (p?.dataUrl && typeof p.dataUrl === 'string') {
        const saved = saveClothingPhotoFile(p.dataUrl);
        if (saved) {
          savedPhotos.push({
            fileName: saved.fileName,
            mimeType: saved.mimeType,
            caption: String(p.caption ?? '').trim(),
            photoStage: p.photoStage === 'sesudah' ? 'sesudah' : 'sebelum',
          });
        }
      }
    }
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Foto pakaian tidak valid.' });
    return;
  }

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const normalizedPhone = normalizeWhatsappNumber(String(body.customerPhone));
  const cleanName = String(body.customerName).trim();
  const cleanAddress = String(body.pickupAddress ?? '').trim() || 'Datang langsung ke workshop Laundry Huzavin';
  const cleanNotes = String(body.notes ?? '').trim();
  const totalPrice = calculateEstimatedPrice(totalWeightKg, serviceRow.price_per_kg);
  const initialStatus: OrderStatusCode =
    (body.initialStatus as OrderStatusCode) || 'CUCIAN_DITERIMA_DI_HUZAVIN';

  const pickupDate = String(body.pickupDate ?? '').trim() || nowIso.slice(0, 10);
  const pickupTime = String(body.pickupTime ?? '').trim() || 'Workshop / Manual';

  const result = db.transaction(() => {
    const customerRow = db.prepare('SELECT id FROM customers WHERE whatsapp = ?').get(normalizedPhone) as
      | { id: string }
      | undefined;

    let customerId = customerRow?.id;
    if (customerId) {
      db.prepare('UPDATE customers SET name = ?, last_address = ?, updated_at = ? WHERE id = ?').run(
        cleanName,
        cleanAddress,
        nowIso,
        customerId
      );
    } else {
      customerId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO customers (id, name, whatsapp, last_address, last_landmark, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', ?, ?)`
      ).run(customerId, cleanName, normalizedPhone, cleanAddress, nowIso, nowIso);
    }

    const orderId = crypto.randomUUID();
    const orderCode = createNextOrderCode(nowDate);

    db.prepare(
      `INSERT INTO orders (
        id, order_code, customer_id, customer_name, customer_phone,
        pickup_address, pickup_landmark, service_id, service_name, includes_ironing,
        price_per_kg, estimated_weight, final_weight, estimated_price, final_price,
        pickup_date, pickup_time, notes, status, order_source, payment_status, admin_decision,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'diterima', ?, ?)`
    ).run(
      orderId,
      orderCode,
      customerId,
      cleanName,
      normalizedPhone,
      cleanAddress,
      serviceRow.id,
      serviceRow.name,
      serviceRow.includes_ironing,
      serviceRow.price_per_kg,
      totalWeightKg,
      totalWeightKg,
      totalPrice,
      totalPrice,
      pickupDate,
      pickupTime,
      cleanNotes,
      initialStatus,
      orderSource,
      paymentStatus,
      nowIso,
      nowIso
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (id, order_id, category, quantity, weight_kg, condition_note, special_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of parsedItems) {
      insertItem.run(
        crypto.randomUUID(),
        orderId,
        item.category,
        item.quantity,
        item.weightKg,
        item.conditionNote,
        item.specialNote ?? '',
        nowIso
      );
    }

    const insertPhoto = db.prepare(
      `INSERT INTO clothing_photos (id, order_id, photo_stage, file_name, mime_type, caption, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const photo of savedPhotos) {
      insertPhoto.run(
        crypto.randomUUID(),
        orderId,
        photo.photoStage,
        photo.fileName,
        photo.mimeType,
        photo.caption,
        req.admin?.displayName || 'Admin Huzavin',
        nowIso
      );
    }

    db.prepare(
      `INSERT INTO order_status_history (id, order_id, status, description, updated_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      orderId,
      initialStatus,
      `Pesanan manual (${orderSource === 'whatsapp' ? 'WhatsApp' : 'Datang Langsung'}) dicatat oleh admin dengan ${parsedItems.length} item pakaian.`,
      req.admin?.displayName || 'Admin Huzavin',
      nowIso
    );

    return { orderId, orderCode };
  })();

  const createdRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.orderId) as Record<string, unknown>;
  const order = mapOrderRow(createdRow);
  res.status(201).json({ order });
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
  const items = getOrderItems(order.id);
  const photos = getClothingPhotos(order.id);
  res.json({ order, history, items, photos });
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

  const nextPaymentStatus: PaymentStatus =
    req.body?.paymentStatus === 'lunas'
      ? 'lunas'
      : req.body?.paymentStatus === 'belum_dibayar'
      ? 'belum_dibayar'
      : existing.paymentStatus;

  const validDecisions = new Set<AdminDecision>(['menunggu', 'diterima', 'ditolak', 'perlu_konfirmasi']);
  const nextDecision: AdminDecision = validDecisions.has(req.body?.adminDecision)
    ? (req.body.adminDecision as AdminDecision)
    : existing.adminDecision;

  const nextRejectionReason =
    req.body?.rejectionReason !== undefined ? String(req.body.rejectionReason).trim() : existing.rejectionReason;

  const statusChanged = nextStatus !== existing.status;
  const decisionChanged = nextDecision !== existing.adminDecision;
  const statusNote = String(req.body?.statusNote ?? '').trim();
  const nowIso = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `UPDATE orders
       SET status = ?, final_weight = ?, final_price = ?, payment_status = ?, admin_decision = ?, rejection_reason = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      nextStatus,
      nextFinalWeight,
      nextFinalPrice,
      nextPaymentStatus,
      nextDecision,
      nextRejectionReason,
      nowIso,
      orderId
    );

    if (statusChanged || decisionChanged || statusNote) {
      let stageDesc = statusNote;
      if (!stageDesc) {
        if (decisionChanged && nextDecision === 'ditolak') {
          stageDesc = `Pesanan ditolak admin${nextRejectionReason ? `: ${nextRejectionReason}` : '.'}`;
        } else if (decisionChanged && nextDecision === 'perlu_konfirmasi') {
          stageDesc = 'Admin meminta konfirmasi ulang kepada pelanggan via WhatsApp.';
        } else {
          stageDesc =
            ORDER_STAGES.find((s) => s.code === nextStatus)?.description ||
            `Status diperbarui ke ${getStageLabel(nextStatus)}.`;
        }
      }

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
  const items = getOrderItems(orderId);
  const photos = getClothingPhotos(orderId);
  res.json({ order, history, items, photos });
});

app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orderId = String(req.params.id);
  const photos = getClothingPhotos(orderId);
  const result = db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }
  for (const photo of photos) {
    deleteClothingPhotoFile(photo.fileName);
  }
  res.json({ ok: true });
});

// Admin: Manage Clothing Items (order_items)
app.post('/api/admin/orders/:id/items', requireAdmin, (req, res) => {
  const orderId = String(req.params.id);
  const category = String(req.body?.category ?? '').trim();
  const quantity = Math.max(1, Number.parseInt(String(req.body?.quantity ?? 1), 10) || 1);
  const weightKg = parseWeightInput(req.body?.weightKg ?? 0);
  const conditionNote = String(req.body?.conditionNote ?? 'Normal').trim() || 'Normal';
  const specialNote = String(req.body?.specialNote ?? '').trim();

  if (!category) {
    res.status(400).json({ error: 'Jenis pakaian wajib diisi.' });
    return;
  }

  db.prepare(
    `INSERT INTO order_items (id, order_id, category, quantity, weight_kg, condition_note, special_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), orderId, category, quantity, weightKg, conditionNote, specialNote, new Date().toISOString());

  res.status(201).json({ items: getOrderItems(orderId) });
});

app.put('/api/admin/order-items/:itemId', requireAdmin, (req, res) => {
  const itemId = String(req.params.itemId);
  const existing = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(itemId) as
    | { order_id: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Item pakaian tidak ditemukan.' });
    return;
  }

  const category = String(req.body?.category ?? '').trim();
  const quantity = Math.max(1, Number.parseInt(String(req.body?.quantity ?? 1), 10) || 1);
  const weightKg = parseWeightInput(req.body?.weightKg ?? 0);
  const conditionNote = String(req.body?.conditionNote ?? 'Normal').trim() || 'Normal';
  const specialNote = String(req.body?.specialNote ?? '').trim();

  if (!category) {
    res.status(400).json({ error: 'Jenis pakaian wajib diisi.' });
    return;
  }

  db.prepare(
    `UPDATE order_items SET category = ?, quantity = ?, weight_kg = ?, condition_note = ?, special_note = ? WHERE id = ?`
  ).run(category, quantity, weightKg, conditionNote, specialNote, itemId);

  res.json({ items: getOrderItems(existing.order_id) });
});

app.delete('/api/admin/order-items/:itemId', requireAdmin, (req, res) => {
  const itemId = String(req.params.itemId);
  const existing = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(itemId) as
    | { order_id: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Item pakaian tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
  res.json({ items: getOrderItems(existing.order_id) });
});

// Admin: Protected Clothing Photo Documentation (upload, private serve, delete)
app.post('/api/admin/orders/:id/photos', requireAdmin, (req: AuthenticatedRequest, res) => {
  const orderId = String(req.params.id);
  const orderExists = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
  if (!orderExists) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }

  const dataUrl = String(req.body?.dataUrl ?? '');
  const caption = String(req.body?.caption ?? '').trim();
  const photoStage: PhotoStage = req.body?.photoStage === 'sesudah' ? 'sesudah' : 'sebelum';

  try {
    const saved = saveClothingPhotoFile(dataUrl);
    if (!saved) {
      res.status(400).json({ error: 'Format gambar tidak didukung (gunakan JPG, PNG, atau WEBP).' });
      return;
    }

    db.prepare(
      `INSERT INTO clothing_photos (id, order_id, photo_stage, file_name, mime_type, caption, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      orderId,
      photoStage,
      saved.fileName,
      saved.mimeType,
      caption,
      req.admin?.displayName || 'Admin Huzavin',
      new Date().toISOString()
    );

    res.status(201).json({ photos: getClothingPhotos(orderId) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan foto.' });
  }
});

app.get('/api/admin/clothing-photos/:photoId/file', requireAdmin, (req, res) => {
  const photo = db
    .prepare('SELECT file_name, mime_type FROM clothing_photos WHERE id = ?')
    .get(String(req.params.photoId)) as { file_name: string; mime_type: string } | undefined;

  if (!photo) {
    res.status(404).json({ error: 'Foto tidak ditemukan.' });
    return;
  }

  const fullPath = path.join(clothingUploadsDir, path.basename(photo.file_name));
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File foto tidak ditemukan.' });
    return;
  }

  res.setHeader('Content-Type', photo.mime_type);
  res.setHeader('Cache-Control', 'no-store, private');
  res.sendFile(fullPath);
});

app.delete('/api/admin/clothing-photos/:photoId', requireAdmin, (req, res) => {
  const photo = db
    .prepare('SELECT order_id, file_name FROM clothing_photos WHERE id = ?')
    .get(String(req.params.photoId)) as { order_id: string; file_name: string } | undefined;

  if (!photo) {
    res.status(404).json({ error: 'Foto tidak ditemukan.' });
    return;
  }

  db.prepare('DELETE FROM clothing_photos WHERE id = ?').run(String(req.params.photoId));
  deleteClothingPhotoFile(photo.file_name);
  res.json({ photos: getClothingPhotos(photo.order_id) });
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

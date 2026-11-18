import bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateEstimatedPrice,
  DEFAULT_SITE_SETTINGS,
  generateOrderCode,
  getStageLabel,
  normalizeWhatsappNumber,
  ORDER_STAGES,
  parseWeightInput,
  type AdminDecision,
  type ManualClothingItemInput,
  type OrderSource,
  type OrderStatusCode,
  type PaymentStatus,
  type PhotoStage,
  type ServiceItem,
  type SiteSettings,
} from './laundryRules';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import type {
  AdminOverviewData,
  AdminUser,
  ClothingPhotoClient,
  CustomerDirectoryItem,
  GalleryItem,
  OrderHistoryItem,
  OrderItemClient,
  OrderRecordClient,
  TestimonialItem,
} from '../types';

export interface OrderDetailPayload {
  order: OrderRecordClient;
  history: OrderHistoryItem[];
  items: OrderItemClient[];
  photos: ClothingPhotoClient[];
}

const SESSION_KEY = 'huzavin_supabase_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

interface StoredAdminSession {
  admin: AdminUser;
  exp: number;
}

let memorySession: StoredAdminSession | null = null;

function persistAdminSession(session: StoredAdminSession | null): void {
  memorySession = session;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (session) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    // Ignore storage restriction errors; in-memory session remains active
  }
}

export function getStoredAdminSession(): AdminUser | null {
  if (memorySession && memorySession.exp > Date.now()) {
    return memorySession.admin;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredAdminSession;
      if (parsed?.admin?.id && parsed?.admin?.username && typeof parsed.exp === 'number') {
        if (parsed.exp > Date.now()) {
          memorySession = parsed;
          return parsed.admin;
        }
      }
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Ignore malformed storage
  }
  memorySession = null;
  return null;
}

export function clearAdminSession(): void {
  persistAdminSession(null);
}

export interface AdminLoginResult {
  ok: boolean;
  admin?: AdminUser;
  error?: string;
}

export async function loginAdminWithSupabase(
  username: string,
  password: string,
  clientOverride?: SupabaseClient | null
): Promise<AdminLoginResult> {
  const client = clientOverride !== undefined ? clientOverride : getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      error:
        'Konfigurasi Supabase (VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY) belum diatur pada environment.',
    };
  }

  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password) {
    return { ok: false, error: 'Username dan password wajib diisi.' };
  }

  const { data: row, error } = await client
    .from('admin_profiles')
    .select('id, username, password_hash, display_name, must_change_password')
    .ilike('username', cleanUsername)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: `Gagal memeriksa tabel admin_profiles di Supabase: ${error.message}`,
    };
  }

  if (!row || typeof row.password_hash !== 'string') {
    return { ok: false, error: 'Username atau password salah' };
  }

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) {
    return { ok: false, error: 'Username atau password salah' };
  }

  const admin: AdminUser = {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name || 'Admin Huzavin'),
    mustChangePassword: Boolean(row.must_change_password),
  };

  persistAdminSession({
    admin,
    exp: Date.now() + SESSION_TTL_MS,
  });

  return { ok: true, admin };
}

export async function verifyStoredAdminWithSupabase(
  clientOverride?: SupabaseClient | null
): Promise<AdminUser | null> {
  const localAdmin = getStoredAdminSession();
  if (!localAdmin) return null;

  const client = clientOverride !== undefined ? clientOverride : getSupabaseClient();
  if (!client) {
    clearAdminSession();
    return null;
  }

  const { data: row, error } = await client
    .from('admin_profiles')
    .select('id, username, display_name, must_change_password')
    .eq('id', localAdmin.id)
    .maybeSingle();

  if (error) {
    // Keep session on transient network errors; reject only if profile is confirmed deleted
    return localAdmin;
  }

  if (!row) {
    clearAdminSession();
    return null;
  }

  const refreshed: AdminUser = {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name || 'Admin Huzavin'),
    mustChangePassword: Boolean(row.must_change_password),
  };
  persistAdminSession({
    admin: refreshed,
    exp: memorySession?.exp ?? Date.now() + SESSION_TTL_MS,
  });
  return refreshed;
}

export async function changeSupabaseAdminPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
  clientOverride?: SupabaseClient | null
): Promise<{ ok: boolean; error?: string }> {
  const client = clientOverride !== undefined ? clientOverride : getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Konfigurasi Supabase belum tersedia.' };
  }

  if (newPassword.trim().length < 6) {
    return { ok: false, error: 'Password baru minimal 6 karakter.' };
  }

  const { data: row, error } = await client
    .from('admin_profiles')
    .select('id, password_hash')
    .eq('id', adminId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: 'Akun admin tidak ditemukan di Supabase.' };
  }

  if (!bcrypt.compareSync(currentPassword, String(row.password_hash))) {
    return { ok: false, error: 'Password saat ini tidak sesuai.' };
  }

  const nextHash = bcrypt.hashSync(newPassword, 10);
  const { error: updateErr } = await client
    .from('admin_profiles')
    .update({
      password_hash: nextHash,
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminId);

  if (updateErr) {
    return { ok: false, error: `Gagal memperbarui password: ${updateErr.message}` };
  }

  const stored = getStoredAdminSession();
  if (stored && stored.id === adminId) {
    persistAdminSession({
      admin: { ...stored, mustChangePassword: false },
      exp: memorySession?.exp ?? Date.now() + SESSION_TTL_MS,
    });
  }

  return { ok: true };
}

function mapServiceRow(row: Record<string, unknown>): ServiceItem {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    pricePerKg: Number(row.price_per_kg),
    description: String(row.description ?? ''),
    estimatedDuration: String(row.estimated_duration ?? '1–2 hari'),
    includesIroning: Boolean(row.includes_ironing),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 1),
  };
}

function mapOrderRow(
  row: Record<string, unknown>,
  serviceIroningMap: Map<string, boolean>,
  itemsCountMap: Map<string, number>,
  photosCountMap: Map<string, number>
): OrderRecordClient {
  const id = String(row.id);
  const serviceId = String(row.service_id);
  return {
    id,
    orderCode: String(row.order_code),
    customerId: row.customer_id ? String(row.customer_id) : null,
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    pickupAddress: String(row.pickup_address ?? ''),
    pickupLandmark: String(row.pickup_landmark ?? ''),
    serviceId,
    serviceName: String(row.service_name),
    includesIroning: serviceIroningMap.get(serviceId) ?? false,
    pricePerKg: Number(row.price_per_kg ?? 0),
    estimatedWeight: Number(row.estimated_weight ?? 1),
    finalWeight:
      row.final_weight !== null && row.final_weight !== undefined
        ? Number(row.final_weight)
        : null,
    estimatedPrice: Number(row.estimated_price ?? 0),
    finalPrice:
      row.final_price !== null && row.final_price !== undefined
        ? Number(row.final_price)
        : null,
    pickupDate: String(row.pickup_date ?? ''),
    pickupTime: String(row.pickup_time ?? ''),
    notes: String(row.notes ?? ''),
    status: String(row.status) as OrderStatusCode,
    orderSource: (String(row.order_source ?? 'website') as OrderSource) || 'website',
    paymentStatus:
      (String(row.payment_status ?? 'belum_dibayar') as PaymentStatus) || 'belum_dibayar',
    adminDecision: (String(row.admin_decision ?? 'menunggu') as AdminDecision) || 'menunggu',
    rejectionReason: String(row.rejection_reason ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    itemsCount: itemsCountMap.get(id) ?? 0,
    photosCount: photosCountMap.get(id) ?? 0,
  };
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Konfigurasi Supabase (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) belum diatur.');
  }
  return client;
}

export async function fetchSupabaseAdminOverview(): Promise<AdminOverviewData> {
  const client = requireSupabaseClient();

  const [
    servicesRes,
    ordersRes,
    itemsRes,
    photosRes,
    customersRes,
    galleryRes,
    testimonialsRes,
    settingsRes,
  ] = await Promise.all([
    client.from('services').select('*').order('sort_order', { ascending: true }),
    client.from('orders').select('*').order('created_at', { ascending: false }),
    client.from('order_items').select('*').order('created_at', { ascending: false }),
    client.from('clothing_photos').select('*').order('created_at', { ascending: false }),
    client.from('customers').select('*').order('updated_at', { ascending: false }),
    client
      .from('gallery')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    client.from('testimonials').select('*').order('created_at', { ascending: false }),
    client.from('site_settings').select('*'),
  ]);

  if (servicesRes.error) throw new Error(servicesRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const services = (servicesRes.data ?? []).map((r) => mapServiceRow(r as Record<string, unknown>));
  const serviceIroningMap = new Map(services.map((s) => [s.id, s.includesIroning]));

  const itemsCountMap = new Map<string, number>();
  const rawItems = itemsRes.data ?? [];
  for (const r of rawItems) {
    const oid = String(r.order_id);
    itemsCountMap.set(oid, (itemsCountMap.get(oid) ?? 0) + 1);
  }

  const photosCountMap = new Map<string, number>();
  const firstPhotoMap = new Map<string, string>();
  const rawPhotos = photosRes.data ?? [];
  for (const r of rawPhotos) {
    const oid = String(r.order_id);
    photosCountMap.set(oid, (photosCountMap.get(oid) ?? 0) + 1);
    if (!firstPhotoMap.has(oid) && r.storage_path) {
      firstPhotoMap.set(oid, String(r.storage_path));
    }
  }

  const orders = (ordersRes.data ?? []).map((r) =>
    mapOrderRow(r as Record<string, unknown>, serviceIroningMap, itemsCountMap, photosCountMap)
  );
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const clothingItems: OrderItemClient[] = rawItems.map((r) => {
    const oid = String(r.order_id);
    const parent = orderMap.get(oid);
    return {
      id: String(r.id),
      orderId: oid,
      category: String(r.category),
      quantity: Number(r.quantity ?? 1),
      weightKg: Number(r.weight_kg ?? 0),
      conditionNote: String(r.condition_note ?? 'Normal'),
      specialNote: String(r.special_note ?? ''),
      createdAt: String(r.created_at),
      orderCode: parent?.orderCode,
      customerName: parent?.customerName,
      orderStatus: parent?.status,
      serviceName: parent?.serviceName,
      orderCreatedAt: parent?.createdAt,
      photoCount: photosCountMap.get(oid) ?? 0,
      firstPhotoUrl: firstPhotoMap.get(oid) ?? null,
    };
  });

  const customers: CustomerDirectoryItem[] = (customersRes.data ?? []).map((c) => {
    const cid = String(c.id);
    const cOrders = orders.filter((o) => o.customerId === cid && o.adminDecision !== 'ditolak');
    return {
      id: cid,
      name: String(c.name),
      whatsapp: String(c.whatsapp),
      lastAddress: String(c.last_address ?? ''),
      lastLandmark: String(c.last_landmark ?? ''),
      ordersCount: cOrders.length,
      totalSpent: cOrders.reduce((s, o) => s + (o.finalPrice ?? o.estimatedPrice), 0),
      lastOrderAt: cOrders[0]?.createdAt ?? null,
      createdAt: String(c.created_at),
    };
  });

  const gallery: GalleryItem[] = (galleryRes.data ?? []).map((g) => ({
    id: String(g.id),
    title: String(g.title),
    category: String(g.category),
    imageUrl: String(g.image_url),
    beforeImageUrl: g.before_image_url ? String(g.before_image_url) : null,
    caption: String(g.caption ?? ''),
    isIllustration: Boolean(g.is_illustration),
    sortOrder: Number(g.sort_order ?? 1),
    createdAt: String(g.created_at),
  }));

  const testimonials: TestimonialItem[] = (testimonialsRes.data ?? []).map((t) => ({
    id: String(t.id),
    customerName: String(t.customer_name),
    avatarUrl: t.avatar_url ? String(t.avatar_url) : null,
    rating: Number(t.rating ?? 5),
    comment: String(t.comment),
    isPublished: Boolean(t.is_published),
    createdAt: String(t.created_at),
  }));

  const settingsMap = new Map(
    (settingsRes.data ?? []).map((s) => [String(s.key), String(s.value ?? '')])
  );
  const settings: SiteSettings = {
    businessName: settingsMap.get('businessName') || DEFAULT_SITE_SETTINGS.businessName,
    sloganMain: settingsMap.get('sloganMain') || DEFAULT_SITE_SETTINGS.sloganMain,
    sloganSecondary: settingsMap.get('sloganSecondary') || DEFAULT_SITE_SETTINGS.sloganSecondary,
    address: settingsMap.get('address') || DEFAULT_SITE_SETTINGS.address,
    whatsappDisplay: settingsMap.get('whatsappDisplay') || DEFAULT_SITE_SETTINGS.whatsappDisplay,
    whatsappRaw: settingsMap.get('whatsappRaw') || DEFAULT_SITE_SETTINGS.whatsappRaw,
  };

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
  const totalRevenue = activeNonRejected.reduce(
    (sum, o) => sum + (o.finalPrice ?? o.estimatedPrice),
    0
  );
  const unpaidOrders = activeNonRejected.filter((o) => o.paymentStatus === 'belum_dibayar');

  return {
    summary: {
      totalOrders: orders.length,
      newOrders: orders.filter((o) => o.status === 'ORDER_DITERIMA' && o.adminDecision !== 'ditolak')
        .length,
      waitingPickup: orders.filter(
        (o) =>
          (o.status === 'ORDER_DITERIMA' || o.status === 'MENUNGGU_PENJEMPUTAN') &&
          o.adminDecision !== 'ditolak'
      ).length,
      pickedUp: orders.filter(
        (o) => o.status === 'CUCIAN_TELAH_DIJEMPUT' && o.adminDecision !== 'ditolak'
      ).length,
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
      unpaidAmount: unpaidOrders.reduce((s, o) => s + (o.finalPrice ?? o.estimatedPrice), 0),
    },
    orders,
    clothingItems,
    customers,
    services,
    gallery,
    testimonials,
    settings,
    databaseStatus: {
      activeEngine: 'Supabase PostgreSQL',
      supabaseConfigured: isSupabaseConfigured,
    },
  };
}

export async function fetchSupabaseOrderDetail(orderId: string): Promise<OrderDetailPayload> {
  const client = requireSupabaseClient();
  const [orderRes, servicesRes, historyRes, itemsRes, photosRes] = await Promise.all([
    client.from('orders').select('*').eq('id', orderId).single(),
    client.from('services').select('id, includes_ironing'),
    client
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    client
      .from('clothing_photos')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ]);

  if (orderRes.error || !orderRes.data) {
    throw new Error(orderRes.error?.message || 'Pesanan tidak ditemukan.');
  }

  const serviceIroningMap = new Map(
    (servicesRes.data ?? []).map((s) => [String(s.id), Boolean(s.includes_ironing)])
  );
  const items: OrderItemClient[] = (itemsRes.data ?? []).map((r) => ({
    id: String(r.id),
    orderId: String(r.order_id),
    category: String(r.category),
    quantity: Number(r.quantity ?? 1),
    weightKg: Number(r.weight_kg ?? 0),
    conditionNote: String(r.condition_note ?? 'Normal'),
    specialNote: String(r.special_note ?? ''),
    createdAt: String(r.created_at),
  }));
  const photos: ClothingPhotoClient[] = (photosRes.data ?? []).map((p) => ({
    id: String(p.id),
    orderId: String(p.order_id),
    photoStage: String(p.photo_stage) as PhotoStage,
    imageUrl: String(p.storage_path),
    caption: String(p.caption ?? ''),
    uploadedBy: String(p.uploaded_by ?? 'Admin Huzavin'),
    createdAt: String(p.created_at),
  }));
  const history: OrderHistoryItem[] = (historyRes.data ?? []).map((h) => ({
    id: String(h.id),
    orderId: String(h.order_id),
    status: String(h.status) as OrderStatusCode,
    description: String(h.description ?? ''),
    updatedBy: String(h.updated_by ?? 'Sistem'),
    createdAt: String(h.created_at),
  }));

  const order = mapOrderRow(
    orderRes.data as Record<string, unknown>,
    serviceIroningMap,
    new Map([[orderId, items.length]]),
    new Map([[orderId, photos.length]])
  );

  return { order, history, items, photos };
}

export async function createSupabaseManualOrder(payload: {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  serviceId: string;
  orderSource: OrderSource;
  paymentStatus: PaymentStatus;
  initialStatus: OrderStatusCode;
  pickupDate?: string;
  pickupTime?: string;
  totalWeightKg: number;
  notes?: string;
  items: ManualClothingItemInput[];
  photos?: Array<{ dataUrl: string; photoStage: PhotoStage; caption: string }>;
}): Promise<OrderRecordClient> {
  const client = requireSupabaseClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: svcRow, error: svcErr } = await client
    .from('services')
    .select('*')
    .eq('id', payload.serviceId)
    .single();
  if (svcErr || !svcRow) throw new Error('Layanan laundry tidak ditemukan di Supabase.');

  const service = mapServiceRow(svcRow as Record<string, unknown>);
  const normalizedPhone = normalizeWhatsappNumber(payload.customerPhone) || payload.customerPhone.trim();

  // Upsert customer
  let customerId: string | null = null;
  const { data: existingCustomer } = await client
    .from('customers')
    .select('id')
    .eq('whatsapp', normalizedPhone)
    .maybeSingle();

  if (existingCustomer?.id) {
    customerId = String(existingCustomer.id);
    await client
      .from('customers')
      .update({
        name: payload.customerName.trim(),
        last_address: payload.pickupAddress.trim() || 'Datang langsung ke workshop',
        updated_at: nowIso,
      })
      .eq('id', customerId);
  } else {
    const { data: newCust } = await client
      .from('customers')
      .insert({
        name: payload.customerName.trim(),
        whatsapp: normalizedPhone,
        last_address: payload.pickupAddress.trim() || 'Datang langsung ke workshop',
        last_landmark: '',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .single();
    customerId = newCust?.id ? String(newCust.id) : null;
  }

  // Generate sequential order code
  const prefix = `HZV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const { count } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .ilike('order_code', `${prefix}%`);
  const orderCode = generateOrderCode(now, (count ?? 0) + 1);

  const estimatedPrice = calculateEstimatedPrice(payload.totalWeightKg, service.pricePerKg);
  const { data: insertedOrder, error: orderErr } = await client
    .from('orders')
    .insert({
      order_code: orderCode,
      customer_id: customerId,
      customer_name: payload.customerName.trim(),
      customer_phone: normalizedPhone,
      pickup_address: payload.pickupAddress.trim() || 'Datang langsung ke workshop Huzavin',
      pickup_landmark: '',
      service_id: service.id,
      service_name: service.name,
      price_per_kg: service.pricePerKg,
      estimated_weight: payload.totalWeightKg,
      final_weight: payload.totalWeightKg,
      estimated_price: estimatedPrice,
      final_price: estimatedPrice,
      pickup_date: payload.pickupDate?.trim() || nowIso.slice(0, 10),
      pickup_time: payload.pickupTime?.trim() || 'Workshop / Langsung',
      notes: payload.notes?.trim() ?? '',
      status: payload.initialStatus,
      order_source: payload.orderSource,
      payment_status: payload.paymentStatus,
      admin_decision: 'diterima',
      rejection_reason: '',
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (orderErr || !insertedOrder) {
    throw new Error(orderErr?.message || 'Gagal menyimpan pesanan manual ke Supabase.');
  }

  const orderId = String(insertedOrder.id);

  if (payload.items.length > 0) {
    await client.from('order_items').insert(
      payload.items.map((item) => ({
        order_id: orderId,
        category: item.category,
        quantity: Math.max(1, item.quantity),
        weight_kg: Math.max(0, item.weightKg),
        condition_note: item.conditionNote || 'Normal',
        special_note: item.specialNote ?? '',
        created_at: nowIso,
      }))
    );
  }

  if (payload.photos && payload.photos.length > 0) {
    await client.from('clothing_photos').insert(
      payload.photos.map((ph) => ({
        order_id: orderId,
        photo_stage: ph.photoStage,
        storage_path: ph.dataUrl,
        caption: ph.caption || 'Foto pakaian masuk',
        uploaded_by: 'Admin Huzavin',
        created_at: nowIso,
      }))
    );
  }

  await client.from('order_status_history').insert({
    order_id: orderId,
    status: payload.initialStatus,
    description: `${getStageLabel(payload.initialStatus)} — Dicatat manual oleh Admin Huzavin.`,
    updated_by: 'Admin Huzavin',
    created_at: nowIso,
  });

  return mapOrderRow(
    insertedOrder as Record<string, unknown>,
    new Map([[service.id, service.includesIroning]]),
    new Map([[orderId, payload.items.length]]),
    new Map([[orderId, payload.photos?.length ?? 0]])
  );
}

export async function updateSupabaseOrder(
  orderId: string,
  patch: Partial<{
    status: OrderStatusCode;
    paymentStatus: PaymentStatus;
    adminDecision: AdminDecision;
    rejectionReason: string;
    finalWeight: string | number | null;
    finalPrice: number | null;
    statusNote: string;
  }>
): Promise<OrderDetailPayload> {
  const client = requireSupabaseClient();
  const { data: existing, error: fetchErr } = await client
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (fetchErr || !existing) throw new Error('Pesanan tidak ditemukan.');

  const nowIso = new Date().toISOString();
  const nextStatus = patch.status ?? (String(existing.status) as OrderStatusCode);
  const nextDecision = patch.adminDecision ?? (String(existing.admin_decision) as AdminDecision);
  const nextPayment = patch.paymentStatus ?? (String(existing.payment_status) as PaymentStatus);
  const nextRejection =
    patch.rejectionReason !== undefined ? patch.rejectionReason : String(existing.rejection_reason ?? '');

  let nextFinalWeight = existing.final_weight as number | null;
  if (patch.finalWeight !== undefined) {
    if (patch.finalWeight === null || patch.finalWeight === '') {
      nextFinalWeight = null;
    } else {
      const parsed = parseWeightInput(String(patch.finalWeight));
      nextFinalWeight = parsed >= 1 ? parsed : nextFinalWeight;
    }
  }

  let nextFinalPrice = existing.final_price as number | null;
  if (patch.finalPrice !== undefined) {
    nextFinalPrice =
      patch.finalPrice === null ? null : Math.max(0, Math.round(Number(patch.finalPrice)));
  } else if (nextFinalWeight !== null && nextFinalWeight !== existing.final_weight) {
    nextFinalPrice = calculateEstimatedPrice(nextFinalWeight, Number(existing.price_per_kg));
  }

  const { error: updErr } = await client
    .from('orders')
    .update({
      status: nextStatus,
      admin_decision: nextDecision,
      payment_status: nextPayment,
      rejection_reason: nextRejection,
      final_weight: nextFinalWeight,
      final_price: nextFinalPrice,
      updated_at: nowIso,
    })
    .eq('id', orderId);

  if (updErr) throw new Error(updErr.message);

  if (patch.status || patch.statusNote || patch.adminDecision) {
    const stageDesc =
      ORDER_STAGES.find((s) => s.code === nextStatus)?.description ?? getStageLabel(nextStatus);
    await client.from('order_status_history').insert({
      order_id: orderId,
      status: nextStatus,
      description: patch.statusNote?.trim() || stageDesc,
      updated_by: 'Admin Huzavin',
      created_at: nowIso,
    });
  }

  return fetchSupabaseOrderDetail(orderId);
}

export async function deleteSupabaseOrder(orderId: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.from('orders').delete().eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function createSupabaseOrderItem(
  orderId: string,
  item: ManualClothingItemInput
): Promise<OrderItemClient[]> {
  const client = requireSupabaseClient();
  const { error } = await client.from('order_items').insert({
    order_id: orderId,
    category: item.category,
    quantity: Math.max(1, item.quantity),
    weight_kg: Math.max(0, item.weightKg),
    condition_note: item.conditionNote || 'Normal',
    special_note: item.specialNote ?? '',
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return (await fetchSupabaseOrderDetail(orderId)).items;
}

export async function updateSupabaseOrderItem(
  itemId: string,
  item: ManualClothingItemInput
): Promise<OrderItemClient[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('order_items')
    .update({
      category: item.category,
      quantity: Math.max(1, item.quantity),
      weight_kg: Math.max(0, item.weightKg),
      condition_note: item.conditionNote || 'Normal',
      special_note: item.specialNote ?? '',
    })
    .eq('id', itemId)
    .select('order_id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal memperbarui item pakaian.');
  return (await fetchSupabaseOrderDetail(String(data.order_id))).items;
}

export async function deleteSupabaseOrderItem(itemId: string): Promise<OrderItemClient[]> {
  const client = requireSupabaseClient();
  const { data: row } = await client
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .maybeSingle();
  const { error } = await client.from('order_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
  if (!row?.order_id) return [];
  return (await fetchSupabaseOrderDetail(String(row.order_id))).items;
}

export async function uploadSupabaseClothingPhoto(
  orderId: string,
  payload: { dataUrl: string; photoStage: PhotoStage; caption: string }
): Promise<ClothingPhotoClient[]> {
  const client = requireSupabaseClient();
  const { error } = await client.from('clothing_photos').insert({
    order_id: orderId,
    photo_stage: payload.photoStage,
    storage_path: payload.dataUrl,
    caption: payload.caption || '',
    uploaded_by: 'Admin Huzavin',
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return (await fetchSupabaseOrderDetail(orderId)).photos;
}

export async function deleteSupabaseClothingPhoto(photoId: string): Promise<ClothingPhotoClient[]> {
  const client = requireSupabaseClient();
  const { data: row } = await client
    .from('clothing_photos')
    .select('order_id')
    .eq('id', photoId)
    .maybeSingle();
  const { error } = await client.from('clothing_photos').delete().eq('id', photoId);
  if (error) throw new Error(error.message);
  if (!row?.order_id) return [];
  return (await fetchSupabaseOrderDetail(String(row.order_id))).photos;
}

export async function updateSupabaseService(
  serviceId: string,
  patch: { name: string; pricePerKg: number; description: string; estimatedDuration: string }
): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client
    .from('services')
    .update({
      name: patch.name,
      price_per_kg: Math.round(patch.pricePerKg),
      description: patch.description,
      estimated_duration: patch.estimatedDuration,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceId);
  if (error) throw new Error(error.message);
}

export async function saveSupabaseGalleryItem(item: {
  id: string | null;
  title: string;
  category: string;
  imageUrl: string;
  caption: string;
  isIllustration: boolean;
}): Promise<void> {
  const client = requireSupabaseClient();
  if (item.id) {
    const { error } = await client
      .from('gallery')
      .update({
        title: item.title,
        category: item.category,
        image_url: item.imageUrl,
        caption: item.caption,
        is_illustration: item.isIllustration,
      })
      .eq('id', item.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from('gallery').insert({
      title: item.title,
      category: item.category,
      image_url: item.imageUrl,
      caption: item.caption,
      is_illustration: item.isIllustration,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteSupabaseGalleryItem(id: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.from('gallery').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function saveSupabaseTestimonial(item: {
  id: string | null;
  customerName: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const client = requireSupabaseClient();
  if (item.id) {
    const { error } = await client
      .from('testimonials')
      .update({
        customer_name: item.customerName,
        rating: item.rating,
        comment: item.comment,
      })
      .eq('id', item.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from('testimonials').insert({
      customer_name: item.customerName,
      rating: item.rating,
      comment: item.comment,
      is_published: true,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteSupabaseTestimonial(id: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.from('testimonials').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function saveSupabaseSettings(settings: {
  businessName: string;
  sloganMain: string;
  sloganSecondary: string;
  address: string;
  whatsappDisplay: string;
}): Promise<void> {
  const client = requireSupabaseClient();
  const nowIso = new Date().toISOString();
  const entries = Object.entries({
    ...settings,
    whatsappRaw: normalizeWhatsappNumber(settings.whatsappDisplay),
  }).map(([key, value]) => ({
    key,
    value,
    updated_at: nowIso,
  }));
  const { error } = await client.from('site_settings').upsert(entries, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

import type { OrderStatusCode, ServiceItem, SiteSettings } from './lib/laundryRules';

export interface GalleryItem {
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

export interface TestimonialItem {
  id: string;
  customerName: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  isPublished: boolean;
  createdAt: string;
}

export interface PublicBootstrapData {
  services: ServiceItem[];
  settings: SiteSettings;
  gallery: GalleryItem[];
  testimonials: TestimonialItem[];
}

export interface OrderHistoryItem {
  id: string;
  orderId: string;
  status: OrderStatusCode;
  description: string;
  updatedBy: string;
  createdAt: string;
}

export interface OrderRecordClient {
  id: string;
  orderCode: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface TrackedOrderPayload {
  verified: boolean;
  order: {
    orderCode: string;
    customerNameDisplay: string;
    pickupAddress: string | null;
    pickupLandmark: string | null;
    serviceName: string;
    includesIroning: boolean;
    estimatedWeight: number;
    finalWeight: number | null;
    estimatedPrice: number;
    finalPrice: number | null;
    pickupDate: string;
    pickupTime: string;
    notes: string | null;
    status: OrderStatusCode;
    createdAt: string;
    updatedAt: string;
  };
  history: OrderHistoryItem[];
}

export interface LocalSavedOrder {
  orderCode: string;
  last4Phone: string;
  serviceName: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
}

export interface AdminOverviewData {
  summary: {
    totalOrders: number;
    newOrders: number;
    waitingPickup: number;
    inProcess: number;
    washingNow: number;
    readyToDeliver: number;
    completedOrders: number;
    totalRevenue: number;
  };
  orders: OrderRecordClient[];
  services: ServiceItem[];
  gallery: GalleryItem[];
  testimonials: TestimonialItem[];
  settings: SiteSettings;
  databaseStatus: {
    activeEngine: string;
    supabaseConfigured: boolean;
  };
}

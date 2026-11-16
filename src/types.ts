import type {
  AdminDecision,
  OrderSource,
  OrderStatusCode,
  PaymentStatus,
  PhotoStage,
  ServiceItem,
  SiteSettings,
} from './lib/laundryRules';

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

export interface OrderItemClient {
  id: string;
  orderId: string;
  category: string;
  quantity: number;
  weightKg: number;
  conditionNote: string;
  specialNote: string;
  createdAt: string;
  // Joined order fields when viewed in Data Pakaian
  orderCode?: string;
  customerName?: string;
  orderStatus?: OrderStatusCode;
  serviceName?: string;
  orderCreatedAt?: string;
  photoCount?: number;
  firstPhotoUrl?: string | null;
}

export interface ClothingPhotoClient {
  id: string;
  orderId: string;
  photoStage: PhotoStage;
  imageUrl: string;
  caption: string;
  uploadedBy: string;
  createdAt: string;
}

export interface OrderRecordClient {
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
    paymentStatus: PaymentStatus;
    adminDecision: AdminDecision;
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

export interface CustomerDirectoryItem {
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

export interface AdminOverviewData {
  summary: {
    totalOrders: number;
    newOrders: number;
    waitingPickup: number;
    pickedUp: number;
    receivedAtWorkshop: number;
    washingNow: number;
    dryingNow: number;
    ironingNow: number;
    readyToDeliver: number;
    deliveringNow: number;
    completedOrders: number;
    todayRevenue: number;
    monthRevenue: number;
    totalRevenue: number;
    totalTransactions: number;
    unpaidOrdersCount: number;
    unpaidAmount: number;
  };
  orders: OrderRecordClient[];
  clothingItems: OrderItemClient[];
  customers: CustomerDirectoryItem[];
  services: ServiceItem[];
  gallery: GalleryItem[];
  testimonials: TestimonialItem[];
  settings: SiteSettings;
  databaseStatus: {
    activeEngine: string;
    supabaseConfigured: boolean;
  };
}

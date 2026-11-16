/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AdvantagesSection } from './components/AdvantagesSection';
import { AdminPortal } from './components/AdminPortal';
import { FloatingWidgets } from './components/FloatingWidgets';
import { GallerySection } from './components/GallerySection';
import { HeroSection } from './components/HeroSection';
import { LocationAndFooter } from './components/LocationAndFooter';
import { Navbar } from './components/Navbar';
import { OrderCalculatorAndBooking } from './components/OrderCalculatorAndBooking';
import { OrderTracker } from './components/OrderTracker';
import { ServicesAndPricing } from './components/ServicesAndPricing';
import { TestimonialsAndFaq } from './components/TestimonialsAndFaq';
import { DEFAULT_SITE_SETTINGS } from './lib/laundryRules';
import type { LocalSavedOrder, PublicBootstrapData } from './types';

const SAVED_ORDERS_KEY = 'huzavin_my_orders';

const INITIAL_SERVICES = [
  {
    id: 'cuci-kering',
    slug: 'cuci-kering',
    name: 'Cuci Kering',
    pricePerKg: 7000,
    description: 'Pakaian dicuci hingga bersih higienis dan dikeringkan.',
    estimatedDuration: '1–2 hari',
    includesIroning: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'cuci-setrika',
    slug: 'cuci-setrika',
    name: 'Cuci Setrika',
    pricePerKg: 10000,
    description: 'Pakaian dicuci, dikeringkan, kemudian disetrika hingga rapi.',
    estimatedDuration: '1–2 hari',
    includesIroning: true,
    isActive: true,
    sortOrder: 2,
  },
];

function loadSavedOrders(): LocalSavedOrder[] {
  try {
    const raw = localStorage.getItem(SAVED_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  const [bootstrap, setBootstrap] = useState<PublicBootstrapData>({
    services: INITIAL_SERVICES,
    settings: DEFAULT_SITE_SETTINGS,
    gallery: [],
    testimonials: [],
  });
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | null>(null);
  const [savedOrders, setSavedOrders] = useState<LocalSavedOrder[]>(loadSavedOrders);
  const [requestedTrackCode, setRequestedTrackCode] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminRoute) return;

    async function fetchBootstrap() {
      try {
        const res = await fetch('/api/bootstrap');
        if (!res.ok) return;
        const data = (await res.json()) as PublicBootstrapData;
        setBootstrap(data);
      } catch {
        // Keep clean initial catalog if offline
      }
    }
    fetchBootstrap();
  }, [isAdminRoute]);

  if (isAdminRoute) {
    return <AdminPortal />;
  }

  function handleSelectServiceForOrder(serviceId: string) {
    setPreselectedServiceId(serviceId);
    const el = document.getElementById('form-booking-pickup');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleOrderCreated(saved: LocalSavedOrder) {
    setSavedOrders((prev) => {
      const next = [saved, ...prev.filter((o) => o.orderCode !== saved.orderCode)].slice(0, 10);
      try {
        localStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }

  function handleJumpToTracker(orderCode: string) {
    setRequestedTrackCode(orderCode);
    const el = document.getElementById('lacak');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FBFF] text-slate-900">
      <Navbar settings={bootstrap.settings} />

      <main className="flex-1">
        <HeroSection settings={bootstrap.settings} />
        <AdvantagesSection />
        <ServicesAndPricing
          services={bootstrap.services}
          settings={bootstrap.settings}
          onSelectServiceForOrder={handleSelectServiceForOrder}
        />
        <OrderCalculatorAndBooking
          services={bootstrap.services}
          settings={bootstrap.settings}
          preselectedServiceId={preselectedServiceId}
          onOrderCreated={handleOrderCreated}
          onJumpToTracker={handleJumpToTracker}
        />
        <OrderTracker
          settings={bootstrap.settings}
          savedOrders={savedOrders}
          requestedOrderCode={requestedTrackCode}
        />
        <GallerySection gallery={bootstrap.gallery} />
        <TestimonialsAndFaq testimonials={bootstrap.testimonials} />
        <LocationAndFooter services={bootstrap.services} settings={bootstrap.settings} />
      </main>

      <FloatingWidgets settings={bootstrap.settings} />
    </div>
  );
}

import { useState } from 'react';
import { Menu, MessageCircle, X } from 'lucide-react';
import { buildGeneralWhatsappUrl } from '../lib/laundryRules';
import type { SiteSettings } from '../lib/laundryRules';

interface NavbarProps {
  settings: SiteSettings;
}

const NAV_LINKS = [
  { label: 'Beranda', href: '#beranda' },
  { label: 'Layanan', href: '#layanan' },
  { label: 'Daftar Harga', href: '#harga' },
  { label: 'Cek Status', href: '#lacak' },
  { label: 'Galeri', href: '#galeri' },
  { label: 'Testimoni', href: '#testimoni' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Kontak', href: '#kontak' },
];

export function Navbar({ settings }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const whatsappUrl = buildGeneralWhatsappUrl(settings.whatsappRaw);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Logo */}
        <a
          href="#beranda"
          className="flex items-center gap-2.5 text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg"
        >
          <span className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center shrink-0 shadow-sm">
            <svg viewBox="0 0 36 36" className="w-6 h-6" aria-hidden="true">
              <rect x="6" y="5" width="24" height="26" rx="4" fill="#FFFFFF" />
              <circle cx="18" cy="20" r="6.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2" />
              <circle cx="18" cy="20" r="2.8" fill="#38BDF8" />
              <circle cx="12" cy="10" r="1.4" fill="#0284C7" />
              <circle cx="16.5" cy="10" r="1.4" fill="#FACC15" />
            </svg>
          </span>
          <span className="font-display font-extrabold text-base sm:text-lg tracking-tight text-sky-950">
            HUZAVIN LAUNDRY
          </span>
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Navigasi utama" className="hidden lg:flex items-center gap-5 xl:gap-6">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-sky-400"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary Action + Mobile Hamburger */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold tracking-wide transition-colors whitespace-nowrap shrink-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            ORDER SEKARANG
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-sky-100 bg-sky-50/70 text-sky-900 hover:bg-sky-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-sky-100 bg-white px-4 py-4 space-y-1 shadow-lg">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
            >
              {item.label}
            </a>
          ))}
          <div className="pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              ORDER SEKARANG
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

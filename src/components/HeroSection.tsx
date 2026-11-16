import { useState } from 'react';
import { Calculator, Clock, MessageCircle, Scale, Tag, Truck } from 'lucide-react';
import { buildGeneralWhatsappUrl } from '../lib/laundryRules';
import type { SiteSettings } from '../lib/laundryRules';

interface HeroSectionProps {
  settings: SiteSettings;
}

const HERO_IMAGE = '/src/assets/images/hero_laundry_illustration_1794848014747.jpg';

const HERO_HIGHLIGHTS = [
  {
    icon: Truck,
    title: 'Antar Jemput GRATIS',
    subtitle: 'Area Sawangan & sekitarnya',
  },
  {
    icon: Scale,
    title: 'Minimal Order 1 KG',
    subtitle: 'Fleksibel untuk harian',
  },
  {
    icon: Clock,
    title: 'Selesai 1–2 Hari',
    subtitle: 'Tepat waktu & higienis',
  },
  {
    icon: Tag,
    title: 'Harga Terjangkau',
    subtitle: 'Mulai Rp7.000/kg',
  },
];

export function HeroSection({ settings }: HeroSectionProps) {
  const [imgError, setImgError] = useState(false);
  const whatsappUrl = buildGeneralWhatsappUrl(settings.whatsappRaw);

  return (
    <section id="beranda" className="scroll-mt-16 relative overflow-hidden bg-gradient-to-b from-sky-50/90 via-[#F8FBFF] to-white pt-8 pb-14 sm:pt-12 sm:pb-20">
      {/* Subtle floating soap bubble accent in top corner only */}
      <div className="pointer-events-none absolute top-6 left-6 w-14 h-14 rounded-full bg-sky-200/30 border border-sky-300/35 animate-bubble-slow hidden md:block" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Column: Core Proposition */}
          <div className="lg:col-span-6 flex flex-col justify-center py-2">
            <p className="text-sm font-semibold text-sky-700 mb-3">
              Pasir Putih, Sawangan, Kota Depok · Antar Jemput Gratis
            </p>

            <h1 className="font-display font-extrabold text-slate-900 tracking-tight leading-[1.08] text-[clamp(2.25rem,4vw,3.5rem)] text-balance mb-5">
              CUCIAN BERSIH, HIDUP LEBIH PRAKTIS!
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
              <strong className="font-semibold text-slate-800">{settings.sloganMain}</strong>{' '}
              {settings.sloganSecondary}
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm sm:text-base shadow-md shadow-sky-600/20 transition-all hover:-translate-y-0.5 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                ORDER VIA WHATSAPP
              </a>

              <a
                href="#kalkulator"
                className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 font-bold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0"
              >
                <Calculator className="w-5 h-5 text-sky-600" aria-hidden="true" />
                HITUNG HARGA
              </a>
            </div>
          </div>

          {/* Right Column: Hero Cartoon Illustration */}
          <div className="lg:col-span-6 relative">
            <div className="relative h-full min-h-[280px] sm:min-h-[360px] rounded-3xl bg-sky-100/70 border border-sky-200/80 overflow-hidden shadow-sm">
              {!imgError ? (
                <img
                  src={HERO_IMAGE}
                  alt="Ilustrasi mesin cuci Laundry Huzavin, keranjang pakaian bersih, dan deterjen higienis"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full lg:h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-sky-100 to-yellow-50 text-center">
                  <svg viewBox="0 0 120 120" className="w-28 h-28 mb-4 animate-drum-spin" aria-hidden="true">
                    <circle cx="60" cy="60" r="48" fill="#E0F2FE" stroke="#0284C7" strokeWidth="6" />
                    <path d="M22 65 Q45 45 60 65 T98 65" fill="none" stroke="#38BDF8" strokeWidth="6" />
                  </svg>
                  <p className="font-display font-bold text-sky-900">Laundry Huzavin Sawangan</p>
                </div>
              )}

              {/* Playful Soap Bubbles Overlay */}
              <div className="pointer-events-none absolute top-4 right-5 w-11 h-11 rounded-full bg-white/50 border border-white/80 backdrop-blur-[1px] animate-bubble-slow" />
              <div className="pointer-events-none absolute top-16 right-14 w-6 h-6 rounded-full bg-yellow-200/60 border border-white/80 animate-bubble-delayed" />
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Benefit Strip below Hero Split */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {HERO_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-sky-100 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    {item.title}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

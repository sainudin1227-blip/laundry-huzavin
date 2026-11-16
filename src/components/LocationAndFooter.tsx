import { Clock, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { buildGeneralWhatsappUrl, formatRupiah } from '../lib/laundryRules';
import type { ServiceItem, SiteSettings } from '../lib/laundryRules';

interface LocationAndFooterProps {
  services: ServiceItem[];
  settings: SiteSettings;
}

export function LocationAndFooter({ services, settings }: LocationAndFooterProps) {
  const mapsQuery = encodeURIComponent(settings.address);
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const mapsDirectionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const whatsappUrl = buildGeneralWhatsappUrl(settings.whatsappRaw);

  return (
    <>
      {/* SECTION: PETA LOKASI & KONTAK */}
      <section id="kontak" className="scroll-mt-16 py-14 sm:py-20 bg-white border-t border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl bg-[#F8FBFF] border border-sky-100 p-6 sm:p-8">
              <div>
                <p className="text-sm font-semibold text-sky-600 mb-2">Lokasi &amp; Kontak</p>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight mb-6">
                  Kunjungi atau Hubungi Laundry Huzavin
                </h2>

                <div className="space-y-5 text-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Alamat Workshop</p>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{settings.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">WhatsApp Resmi</p>
                      <p className="text-slate-600 mt-0.5 font-mono tabular-nums">{settings.whatsappDisplay}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-yellow-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Jam Operasional &amp; Penjemputan</p>
                      <p className="text-slate-600 mt-0.5">Setiap Hari · 08:00 – 20:00 WIB</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href={mapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <Navigation className="w-4 h-4" aria-hidden="true" />
                  BUKA PETUNJUK ARAH
                </a>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  CHAT ADMIN
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-3xl overflow-hidden border border-sky-200 min-h-[320px] lg:min-h-[420px] bg-sky-50">
              <iframe
                title="Peta Lokasi Laundry Huzavin Sawangan Depok"
                src={mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full min-h-[320px] border-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-sky-950 text-sky-100 pt-14 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-sky-900">
            <div className="lg:col-span-2 space-y-3">
              <h3 className="font-display font-extrabold text-xl text-white tracking-tight">
                {settings.businessName}
              </h3>
              <p className="text-sky-200 font-medium text-sm">{settings.sloganMain}</p>
              <p className="text-sky-300/80 text-sm leading-relaxed max-w-md">{settings.address}</p>
              <p className="text-sm text-sky-200 font-mono tabular-nums">
                WhatsApp: {settings.whatsappDisplay}
              </p>
            </div>

            <div>
              <h4 className="font-display font-bold text-sm text-white mb-3">Navigasi</h4>
              <ul className="space-y-2 text-sm text-sky-200/90">
                <li>
                  <a href="#beranda" className="hover:text-white transition-colors">
                    Beranda
                  </a>
                </li>
                <li>
                  <a href="#layanan" className="hover:text-white transition-colors">
                    Layanan &amp; Daftar Harga
                  </a>
                </li>
                <li>
                  <a href="#kalkulator" className="hover:text-white transition-colors">
                    Kalkulator &amp; Booking Pickup
                  </a>
                </li>
                <li>
                  <a href="#lacak" className="hover:text-white transition-colors">
                    Lacak Cucian Kamu
                  </a>
                </li>
                <li>
                  <a href="#galeri" className="hover:text-white transition-colors">
                    Galeri &amp; Testimoni
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-bold text-sm text-white mb-3">Layanan &amp; Tarif</h4>
              <ul className="space-y-2 text-sm text-sky-200/90">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>{s.name}</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {formatRupiah(s.pricePerKg)}/kg
                    </span>
                  </li>
                ))}
                <li className="text-xs text-sky-300/80 pt-1">
                  Minimal order 1 kg · Antar jemput gratis · Estimasi 1–2 hari
                </li>
                <li className="pt-2">
                  <a href="/admin" className="text-xs text-sky-300 hover:text-white underline">
                    Portal Admin Huzavin
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sky-300/80">
            <p>© 2026 Laundry Huzavin. All Rights Reserved.</p>
            <p>Laundry Antar Jemput Gratis Sawangan, Pasir Putih, Kota Depok.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

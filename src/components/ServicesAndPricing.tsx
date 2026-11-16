import { ArrowRight, Check, Clock, MessageCircle, Shirt, Sparkles, Truck } from 'lucide-react';
import { buildGeneralWhatsappUrl, formatRupiah } from '../lib/laundryRules';
import type { ServiceItem, SiteSettings } from '../lib/laundryRules';

interface ServicesAndPricingProps {
  services: ServiceItem[];
  settings: SiteSettings;
  onSelectServiceForOrder: (serviceId: string) => void;
}

export function ServicesAndPricing({ services, settings, onSelectServiceForOrder }: ServicesAndPricingProps) {
  const whatsappUrl = buildGeneralWhatsappUrl(settings.whatsappRaw);

  return (
    <>
      {/* SECTION: LAYANAN */}
      <section id="layanan" className="scroll-mt-16 py-14 sm:py-20 bg-[#F8FBFF] border-t border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-sky-600 mb-2">Layanan Kami</p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight text-balance">
                Pilihan Layanan Laundry Harian yang Bersih &amp; Terjangkau
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-md">
              Minimal order hanya <strong>1 kg</strong>, bebas biaya antar jemput, dan harga transparan dihitung berdasarkan berat cucian.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {services.map((service) => {
              const isIroned = service.includesIroning;
              return (
                <article
                  key={service.id}
                  className={`rounded-3xl p-6 sm:p-8 border transition-all duration-200 flex flex-col justify-between ${
                    isIroned
                      ? 'bg-white border-sky-300 shadow-sm'
                      : 'bg-white border-sky-100 hover:border-sky-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                            isIroned ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {isIroned ? <Sparkles className="w-6 h-6" /> : <Shirt className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900">
                            {service.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Estimasi pengerjaan: {service.estimatedDuration}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-display font-extrabold text-2xl sm:text-3xl text-sky-700 tabular-nums">
                          {formatRupiah(service.pricePerKg)}
                        </p>
                        <p className="text-xs text-slate-500">per kilogram</p>
                      </div>
                    </div>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
                      {service.description}
                    </p>

                    <ul className="space-y-2.5 text-sm text-slate-700 mb-7">
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
                        <span>Minimal order 1 kg (mendukung berat desimal)</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
                        <span>Antar jemput GRATIS wilayah layanan</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
                        <span>
                          {isIroned
                            ? 'Cuci bersih, kering, setrika uap, dan lipat rapi'
                            : 'Cuci bersih higienis, dikeringkan, dan lipat rapi'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectServiceForOrder(service.id)}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm transition-colors ${
                      isIroned
                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                        : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                    }`}
                  >
                    PESAN SEKARANG
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION: DAFTAR HARGA / PRICE LIST */}
      <section id="harga" className="scroll-mt-16 py-14 sm:py-20 bg-white border-t border-sky-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-sm font-semibold text-sky-600 mb-2">Daftar Harga Resmi</p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Tarif Jelas Tanpa Biaya Tersembunyi
            </h2>
          </div>

          <div className="rounded-3xl border border-sky-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-50 border-b border-sky-100 text-slate-700 text-xs sm:text-sm font-semibold">
                    <th className="py-4 px-5 sm:px-6">Jenis Layanan</th>
                    <th className="py-4 px-4 sm:px-6">Estimasi Selesai</th>
                    <th className="py-4 px-5 sm:px-6 text-right">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {services.map((service) => (
                    <tr key={service.id} className="hover:bg-sky-50/40 transition-colors">
                      <td className="py-4 px-5 sm:px-6">
                        <div className="font-display font-bold text-base text-slate-900">{service.name}</div>
                        <div className="text-xs sm:text-sm text-slate-500 mt-0.5">{service.description}</div>
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-sm text-slate-600 whitespace-nowrap">
                        {service.estimatedDuration}
                      </td>
                      <td className="py-4 px-5 sm:px-6 text-right font-display font-extrabold text-lg text-sky-700 tabular-nums whitespace-nowrap">
                        {formatRupiah(service.pricePerKg)}/kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-sky-50/60 px-5 sm:px-6 py-4 border-t border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  Minimal order 1 kg
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  Estimasi pengerjaan 1–2 hari
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  Antar jemput gratis
                </span>
              </div>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                ORDER SEKARANG
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

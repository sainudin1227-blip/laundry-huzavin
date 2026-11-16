import { useState } from 'react';
import { ChevronDown, MessageSquareHeart, Star } from 'lucide-react';
import type { TestimonialItem } from '../types';

interface TestimonialsAndFaqProps {
  testimonials: TestimonialItem[];
}

const FAQ_ITEMS = [
  {
    q: 'Berapa harga laundry di Huzavin?',
    a: 'Cuci Kering Rp7.000/kg dan Cuci Setrika Rp10.000/kg. Tarif transparan dihitung berdasarkan berat cucian.',
  },
  {
    q: 'Berapa minimal order?',
    a: 'Minimal order adalah 1 kg, dan mendukung berat desimal (misalnya 1,5 kg atau 2,5 kg) saat penimbangan.',
  },
  {
    q: 'Berapa lama pengerjaan?',
    a: 'Estimasi pengerjaan adalah 1–2 hari agar pakaian benar-benar bersih higienis, kering sempurna, dan rapi maksimal.',
  },
  {
    q: 'Apakah tersedia layanan antar jemput?',
    a: 'Ya, tersedia layanan antar jemput GRATIS untuk area layanan Kampung Kupu, Pasir Putih, Sawangan, dan sekitarnya.',
  },
  {
    q: 'Bagaimana cara memesan?',
    a: 'Pelanggan dapat melakukan pemesanan langsung melalui formulir Booking Pickup di website ini untuk mendapatkan Kode Order otomatis atau memesan langsung melalui WhatsApp admin.',
  },
  {
    q: 'Bagaimana cara mengetahui status cucian?',
    a: 'Masukkan Kode Order Anda pada fitur "Lacak Cucian Kamu" di website ini untuk melihat progres 10 tahap pengerjaan secara real-time.',
  },
  {
    q: 'Di mana lokasi Laundry Huzavin?',
    a: 'Kampung Kupu, Kelurahan Pasir Putih, Kecamatan Sawangan, Kota Depok, Jawa Barat.',
  },
];

export function TestimonialsAndFaq({ testimonials }: TestimonialsAndFaqProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  return (
    <>
      {/* SECTION: TESTIMONI PELANGGAN */}
      <section id="testimoni" className="scroll-mt-16 py-14 sm:py-20 bg-white border-t border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-semibold text-sky-600 mb-2">Testimoni Pelanggan</p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Kata Pelanggan Tentang Laundry Huzavin
            </h2>
          </div>

          {testimonials.length === 0 ? (
            <div className="rounded-3xl bg-[#F8FBFF] border border-sky-100 p-8 sm:p-10 text-center max-w-3xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto mb-4">
                <MessageSquareHeart className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
                Belum Ada Testimoni Pelanggan yang Ditampilkan
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
                Laundry Huzavin hanya menampilkan ulasan asli dari pelanggan kami. Admin dapat menambahkan testimoni pelanggan yang sudah menggunakan layanan melalui halaman{' '}
                <a href="/admin" className="font-semibold text-sky-700 hover:underline">
                  Dashboard Admin
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <article
                  key={t.id}
                  className="rounded-3xl bg-[#F8FBFF] border border-sky-100 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1 text-amber-400 mb-4" aria-label={`Rating ${t.rating} dari 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < t.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <p className="text-slate-700 text-sm sm:text-base leading-relaxed">“{t.comment}”</p>
                  </div>

                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-sky-100">
                    {t.avatarUrl ? (
                      <img
                        src={t.avatarUrl}
                        alt={t.customerName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-sky-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-sky-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                        {t.customerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-display font-bold text-sm text-slate-900">{t.customerName}</p>
                      <p className="text-xs text-slate-500">Pelanggan Laundry Huzavin</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION: FAQ (TANYA JAWAB) */}
      <section id="faq" className="scroll-mt-16 py-14 sm:py-20 bg-[#F8FBFF] border-t border-sky-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-sm font-semibold text-sky-600 mb-2">Tanya Jawab (FAQ)</p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Pertanyaan yang Sering Diajukan
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={item.q} className="rounded-2xl bg-white border border-sky-100 overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-sky-50/50 transition-colors"
                  >
                    <span className="font-display font-bold text-sm sm:text-base text-slate-900">
                      {idx + 1}. {item.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-sky-600 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-sm text-slate-600 leading-relaxed border-t border-sky-50">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

import { MessageCircle, ShieldCheck, Sparkles, Truck } from 'lucide-react';

const ADVANTAGES = [
  {
    icon: ShieldCheck,
    title: 'Bersih Higienis',
    description:
      'Setiap cucian diproses dengan air bersih, deterjen berkualitas, dan pemisahan pakaian agar higienis dan bebas bau apek.',
    accentBg: 'bg-sky-100 text-sky-700',
  },
  {
    icon: Sparkles,
    title: 'Rapi Maksimal',
    description:
      'Disetrika dengan teliti dan dilipat seragam oleh tim berpengalaman sehingga pakaian langsung siap pakai atau masuk lemari.',
    accentBg: 'bg-yellow-100 text-amber-700',
  },
  {
    icon: Truck,
    title: 'Antar Jemput Gratis',
    description:
      'Kurir Huzavin siap menjemput pakaian kotor dan mengantarkan cucian bersih langsung ke rumah Anda tanpa biaya tambahan.',
    accentBg: 'bg-sky-100 text-sky-700',
  },
  {
    icon: MessageCircle,
    title: 'Pemesanan Mudah',
    description:
      'Hitung estimasi biaya otomatis, buat pesanan langsung lewat website, konfirmasi cepat via WhatsApp, dan pantau progres secara live.',
    accentBg: 'bg-yellow-100 text-amber-700',
  },
];

export function AdvantagesSection() {
  return (
    <section className="py-14 sm:py-20 bg-white border-t border-sky-100/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold text-sky-600 mb-2">Keunggulan Huzavin</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight text-balance">
            Kenapa Keluarga &amp; Warga Sawangan Memilih Laundry Huzavin?
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ADVANTAGES.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="group p-6 rounded-3xl bg-[#F8FBFF] border border-sky-100 hover:border-sky-300 hover:bg-white transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className={`w-12 h-12 rounded-2xl ${item.accentBg} flex items-center justify-center mb-5`}>
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold text-lg text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

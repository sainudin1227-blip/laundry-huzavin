import { useState } from 'react';
import { Image as ImageIcon, SlidersHorizontal } from 'lucide-react';
import type { GalleryItem } from '../types';

interface GallerySectionProps {
  gallery: GalleryItem[];
}

const CATEGORIES = [
  'Semua',
  'Pakaian sebelum dicuci',
  'Pakaian setelah dicuci',
  'Hasil setrika',
  'Pakaian terlipat rapi',
  'Peralatan laundry',
  'Aktivitas pelayanan laundry',
];

const BEFORE_IMG = '/src/assets/images/before_messy_laundry_1794848015072.jpg';
const AFTER_IMG = '/src/assets/images/after_neat_laundry_1794848015827.jpg';

export function GallerySection({ gallery }: GallerySectionProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  const filteredGallery =
    selectedCategory === 'Semua'
      ? gallery
      : gallery.filter((item) => item.category.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <section id="galeri" className="scroll-mt-16 py-14 sm:py-20 bg-[#F8FBFF] border-t border-sky-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold text-sky-600 mb-2">Galeri Before &amp; After</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight text-balance">
            Dari Cucian Menumpuk Menjadi Bersih &amp; Terlipat Rapi
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Geser slider di bawah untuk membandingkan ilustrasi kondisi sebelum dan sesudah proses pencucian &amp; setrika di Laundry Huzavin.
          </p>
        </div>

        {/* Interactive Before-After Slider */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="rounded-3xl bg-white border border-sky-200 p-3 sm:p-4 shadow-xs">
            <div className="relative aspect-[4/3] sm:aspect-[16/9] rounded-2xl overflow-hidden select-none bg-sky-50">
              {/* After Image (Full layer) */}
              <img
                src={AFTER_IMG}
                alt="Ilustrasi pakaian bersih terlipat rapi setelah proses Laundry Huzavin"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Before Image (Clipped layer) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={BEFORE_IMG}
                  alt="Ilustrasi pakaian kotor dan kusut sebelum dicuci"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Divider Line */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-sky-600 text-white border-2 border-white shadow-lg flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>

              {/* Corner Labels */}
              <span className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-slate-900/75 text-white text-xs font-semibold">
                Sebelum (Ilustrasi)
              </span>
              <span className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-sky-700/90 text-white text-xs font-semibold">
                Sesudah Rapi (Ilustrasi)
              </span>

              {/* Accessible Range Control */}
              <label htmlFor="before-after-slider" className="sr-only">
                Geser perbandingan Before dan After
              </label>
              <input
                id="before-after-slider"
                type="range"
                min={5}
                max={95}
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
              />
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Catatan: Gambar di atas merupakan ilustrasi standar proses Laundry Huzavin dan dapat diganti foto dokumentasi asli oleh Admin.
            </p>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6" role="tablist" aria-label="Kategori galeri">
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'bg-white text-slate-600 border border-sky-100 hover:border-sky-300 hover:text-sky-800'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Gallery Grid */}
        {filteredGallery.length === 0 ? (
          <div className="rounded-3xl bg-white border border-sky-100 p-10 text-center">
            <ImageIcon className="w-10 h-10 text-sky-300 mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold text-slate-700">Belum ada foto untuk kategori ini.</p>
            <p className="text-xs text-slate-500 mt-1">
              Admin dapat menambahkan foto dokumentasi melalui Admin Dashboard.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGallery.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl bg-white border border-sky-100 overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-sky-50 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                      <span>{item.category}</span>
                      {item.isIllustration && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Ilustrasi</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-base text-slate-900">{item.title}</h3>
                    {item.caption && <p className="text-sm text-slate-600 mt-1.5">{item.caption}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

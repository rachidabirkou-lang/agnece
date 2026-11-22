import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { tField } from '../i18n';
import type { Language, SliderItem } from '../types';

interface ImageSliderProps {
  sliders: SliderItem[];
  lang: Language;
}

export const ImageSlider: React.FC<ImageSliderProps> = ({ sliders, lang }) => {
  const [index, setIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const isRtl = lang === 'ar';

  if (!sliders.length) return null;

  const safeIndex = index % sliders.length;

  const next = () => setIndex((prev) => (prev + 1) % sliders.length);
  const prev = () => setIndex((prev) => (prev - 1 + sliders.length) % sliders.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 45) {
      if (isRtl) {
        if (diff > 0) next();
        else prev();
      } else {
        if (diff < 0) next();
        else prev();
      }
    }
    touchStartX.current = null;
  };

  const current = sliders[safeIndex];

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#141518]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative aspect-[16/9] max-h-[420px] w-full overflow-hidden">
        {failedImages[current.id] ? (
          <div className="w-full h-full bg-gradient-to-br from-[#1C1D22] to-[#0E0F12] flex flex-col items-center justify-center p-8 text-center">
            <ImageIcon className="w-12 h-12 text-[#C81E1E] mb-3 opacity-80" />
            <p className="text-lg font-bold text-white">{tField(current, 'title', lang)}</p>
          </div>
        ) : (
          <img
            src={current.image_url}
            alt={tField(current, 'title', lang)}
            referrerPolicy="no-referrer"
            onError={() => setFailedImages((m) => ({ ...m, [current.id]: true }))}
            className="w-full h-full object-cover transition-transform duration-500"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-xl">
            <h3 className="text-lg sm:text-2xl font-bold text-white leading-snug">
              {tField(current, 'title', lang)}
            </h3>
            {tField(current, 'subtitle', lang) && (
              <p className="mt-1.5 text-xs sm:text-sm text-neutral-200 leading-relaxed">
                {tField(current, 'subtitle', lang)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={isRtl ? next : prev}
              aria-label="Previous slide"
              className="w-10 h-10 rounded-full border border-white/30 bg-black/55 hover:bg-[#C81E1E] hover:border-[#C81E1E] text-white flex items-center justify-center transition-colors"
            >
              {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={isRtl ? prev : next}
              aria-label="Next slide"
              className="w-10 h-10 rounded-full border border-white/30 bg-black/55 hover:bg-[#C81E1E] hover:border-[#C81E1E] text-white flex items-center justify-center transition-colors"
            >
              {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 bg-[#121316] border-t border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {sliders.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === safeIndex ? 'w-8 bg-[#C81E1E]' : 'w-2.5 bg-white/25 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-400 font-mono-tabular">
          {String(safeIndex + 1).padStart(2, '0')} / {String(sliders.length).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};

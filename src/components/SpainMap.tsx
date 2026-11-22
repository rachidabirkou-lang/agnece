import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Briefcase, MapPin } from 'lucide-react';
import { tField, UI_TEXT } from '../i18n';
import type { City, Company, JobOffer, Language } from '../types';

interface SpainMapProps {
  cities: City[];
  lang: Language;
  accentColor: string;
  onOpenCity: (slug: string) => void;
  onApplyJob: (job: JobOffer) => void;
}

export const SpainMap: React.FC<SpainMapProps> = ({
  cities,
  lang,
  accentColor,
  onOpenCity,
  onApplyJob,
}) => {
  const t = UI_TEXT[lang];
  const isRtl = lang === 'ar';
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityDetail, setCityDetail] = useState<{
    companies: Company[];
    jobs: JobOffer[];
  } | null>(null);
  const [loadingCity, setLoadingCity] = useState(false);

  useEffect(() => {
    if (!selectedCity && cities.length > 0) {
      const madridOrFirst = cities.find((c) => c.slug === 'barcelona') || cities[0];
      setSelectedCity(madridOrFirst);
    }
  }, [cities, selectedCity]);

  useEffect(() => {
    if (!selectedCity) return;
    let cancelled = false;
    setLoadingCity(true);
    fetch(`/api/cities/${encodeURIComponent(selectedCity.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setCityDetail({
            companies: data.companies || [],
            jobs: data.jobs || [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setCityDetail({ companies: [], jobs: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingCity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCity?.slug]);

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      {/* Map Viewport */}
      <div className="lg:col-span-7 relative rounded-2xl border border-white/10 bg-[#121316] p-5 sm:p-8 overflow-hidden flex flex-col justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 52% 48%, ${accentColor}33 0%, transparent 65%)`,
          }}
        />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-4">
          <p className="text-sm text-neutral-300 font-medium">{t.selectCityPrompt}</p>
          <div className="flex items-center gap-5 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] inline-block" />
              {t.orangeDotLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: accentColor }}
              />
              {t.redDotLabel}
            </span>
          </div>
        </div>

        {/* SVG Map of Spain */}
        <div className="relative z-10 w-full aspect-[4/3] max-h-[440px] mx-auto select-none bg-[#0B0C0E] rounded-xl border border-white/10 p-3">
          <svg
            viewBox="0 0 100 85"
            className="w-full h-full overflow-visible"
            role="img"
            aria-label="Interactive Map of Spain"
          >
            <defs>
              <filter id="spain-dark-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="spain-dark-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1D1F24" />
                <stop offset="100%" stopColor="#131418" />
              </linearGradient>
            </defs>

            {/* Subtle coordinate grid */}
            <g stroke="#24262B" strokeWidth="0.22" opacity="0.7">
              <line x1="0" y1="20" x2="100" y2="20" />
              <line x1="0" y1="40" x2="100" y2="40" />
              <line x1="0" y1="60" x2="100" y2="60" />
              <line x1="25" y1="0" x2="25" y2="85" />
              <line x1="50" y1="0" x2="50" y2="85" />
              <line x1="75" y1="0" x2="75" y2="85" />
            </g>

            {/* Mainland Spain Silhouette */}
            <path
              d="M 17 8 L 24 6 L 34 7 L 45 9 L 55 8 L 62 11 L 72 15 L 82 17 L 91 20 L 92 24 L 86 29 L 82 34 L 74 41 L 71 49 L 73 56 L 70 63 L 66 71 L 60 76 L 52 78 L 45 81 L 37 83 L 29 82 L 24 77 L 23 72 L 25 65 L 25 56 L 23 47 L 22 39 L 21 30 L 17 24 L 13 18 L 14 11 Z"
              fill="url(#spain-dark-fill)"
              stroke={accentColor}
              strokeWidth="0.55"
              strokeLinejoin="round"
              filter="url(#spain-dark-glow)"
            />

            {/* Balearic Islands */}
            <path
              d="M 81 51 L 85 49 L 87 52 L 83 54 Z M 89 49 L 91 49 L 91 51 L 89 51 Z M 77 55 L 79 54 L 79 57 L 77 56 Z"
              fill="url(#spain-dark-fill)"
              stroke={accentColor}
              strokeWidth="0.45"
              strokeLinejoin="round"
            />

            {/* 14 City Interactive Points */}
            {cities.map((city) => {
              const isSelected = selectedCity?.id === city.id;
              const pointColor = city.dot_color === 'red' ? accentColor : '#F97316';
              const x = Number(city.map_x);
              const y = Number(city.map_y) * 0.85;
              const cityLabel = tField(city, 'name', lang);

              return (
                <g
                  key={city.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer group"
                  onClick={() => setSelectedCity(city)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCity(city);
                    }
                  }}
                  aria-label={cityLabel}
                >
                  <circle
                    r={isSelected ? 3.8 : 2.3}
                    fill={pointColor}
                    opacity={isSelected ? 0.3 : 0.16}
                    className="transition-all duration-200"
                  />
                  <circle
                    r={isSelected ? 1.75 : 1.25}
                    fill={pointColor}
                    stroke="#0A0A0A"
                    strokeWidth="0.4"
                    className="transition-transform duration-200 group-hover:scale-125"
                  />
                  <text
                    y={-2.6}
                    textAnchor="middle"
                    className={`text-[2.5px] font-bold select-none transition-colors ${
                      isSelected ? 'fill-white' : 'fill-neutral-300 group-hover:fill-white'
                    }`}
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    {cityLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Quick 14-city selector bar */}
        <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
          {cities.map((city) => {
            const active = selectedCity?.id === city.id;
            const dot = city.dot_color === 'red' ? accentColor : '#F97316';
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 border ${
                  active
                    ? 'bg-white text-black border-white'
                    : 'bg-[#1B1D22] text-neutral-300 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot }} />
                {tField(city, 'name', lang)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected City Live Inspector */}
      <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#141518] p-6 flex flex-col justify-between">
        {selectedCity ? (
          <>
            <div>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                    <MapPin className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    <span>{selectedCity.name_es}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-medium">
                      {selectedCity.active_jobs_count ?? cityDetail?.jobs.length ?? 0} {t.activeOffers}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    {tField(selectedCity, 'name', lang)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCity(selectedCity.slug)}
                  style={{ backgroundColor: accentColor }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                >
                  <span>{t.exploreCity}</span>
                  <ArrowIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="mt-4 text-sm text-neutral-300 leading-relaxed">
                {tField(selectedCity, 'description', lang)}
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="inline-flex items-center gap-1.5 font-bold text-neutral-200">
                    <Building2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {t.companiesCount} ({cityDetail?.companies.length ?? 0})
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-neutral-200">
                    <Briefcase className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {t.activeOffers} ({cityDetail?.jobs.length ?? 0})
                  </span>
                </div>

                {loadingCity ? (
                  <div className="space-y-3">
                    <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                    <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                  </div>
                ) : cityDetail && cityDetail.jobs.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pe-1">
                    {cityDetail.jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 rounded-xl border border-white/10 bg-[#1B1D22] hover:border-white/25 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-400 mb-1">
                          <span className="font-semibold text-neutral-200">{job.company_name_es}</span>
                          <span className="font-mono-tabular">{job.masked_phone}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1">
                          {tField(job, 'title', lang)}
                        </h4>
                        <div className="flex items-center justify-between gap-2 mt-3">
                          <span className="text-xs text-neutral-400">
                            {tField(job, 'category', lang)} · {job.positions_count} {t.positions}
                          </span>
                          <button
                            type="button"
                            onClick={() => onApplyJob(job)}
                            style={{ backgroundColor: accentColor }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                          >
                            {t.applyNow}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 py-6 text-center border border-dashed border-white/10 rounded-xl bg-[#0D0E11]">
                    {t.noJobsInCity}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

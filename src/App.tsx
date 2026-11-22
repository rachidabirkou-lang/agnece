import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  FolderCheck,
  Globe,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plane,
  Scissors,
  Users,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AnimatedCounter } from './components/AnimatedCounter';
import { ApplicationModal } from './components/ApplicationModal';
import { ImageSlider } from './components/ImageSlider';
import { CityDetailView, JobDetailView, JobsDirectoryView, LegalModal } from './components/PublicPages';
import { SpainMap } from './components/SpainMap';
import { tField, UI_TEXT } from './i18n';
import type { BootstrapData, JobOffer, Language } from './types';

type ActiveRoute =
  | { view: 'home' }
  | { view: 'cities' }
  | { view: 'city'; slug: string }
  | { view: 'jobs' }
  | { view: 'job'; id: number }
  | { view: 'admin' };

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<ActiveRoute>({ view: 'home' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [applyModalJob, setApplyModalJob] = useState<JobOffer | null>(null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showAllCitiesGrid, setShowAllCitiesGrid] = useState(false);
  const [openConditionIdx, setOpenConditionIdx] = useState<number>(0);

  const [testiIdx, setTestiIdx] = useState(0);
  const [jobsInitialCategory, setJobsInitialCategory] = useState<string>('all');


  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    whatsapp: '',
    subject: '',
    message: '',
  });
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (res.ok) {
        const json = (await res.json()) as BootstrapData;
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load bootstrap data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const t = UI_TEXT[lang];
  const isRtl = lang === 'ar';
  const ArrowDirIcon = isRtl ? ArrowLeft : ArrowRight;
  const accentColor = data?.settings?.accentColor || '#C81E1E';
  const tailorCount = data?.tailorContractsCount ?? 65;

  const handleNavClick = (target: string, categoryFilter?: string) => {
    setMobileMenuOpen(false);
    if (target === 'home') {
      setRoute({ view: 'home' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'jobs') {
      setJobsInitialCategory(categoryFilter || 'all');
      setRoute({ view: 'jobs' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'cities') {
      setRoute({ view: 'cities' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setRoute({ view: 'home' });
      setTimeout(() => {
        const el = document.getElementById(`section-${target}`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };


  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    setContactSuccess(false);
    setContactSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const out = await res.json();
      if (!res.ok) {
        setContactError(out.error || 'Error sending message');
      } else {
        setContactSuccess(true);
        setContactForm({ fullName: '', email: '', whatsapp: '', subject: '', message: '' });
      }
    } catch {
      setContactError('Network error');
    } finally {
      setContactSending(false);
    }
  };

  if (route.view === 'admin') {
    return (
      <AdminDashboard
        onExit={() => {
          setRoute({ view: 'home' });
          fetchBootstrap();
        }}
        onSiteDataChanged={fetchBootstrap}
      />
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const { settings, cities, sliders, conditions, testimonials, statistics } = data;
  const brandTitle = tField(settings, 'brandName', lang) || 'España Career';

  const sectionVisible = (id: string) => {
    const found = (settings.homeSections || []).find((s) => s.id === id);
    return found ? found.visible : true;
  };

  const orderedSectionIds = [...(settings.homeSections || [])]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id);

  const displayedCities = showAllCitiesGrid ? cities : cities.slice(0, 4);

  const visibleTestimonials = testimonials.length
    ? [
        testimonials[testiIdx % testimonials.length],
        ...(testimonials.length > 1 ? [testimonials[(testiIdx + 1) % testimonials.length]] : []),
        ...(testimonials.length > 2 ? [testimonials[(testiIdx + 2) % testimonials.length]] : []),
      ]
    : [];

  const sectorCards = [
    {
      categoryKey: 'الخياطة وصناعة الملابس',
      title: lang === 'ar' ? 'الخياطة وصناعة الملابس' : lang === 'es' ? 'Confección y Textil' : 'Confection et Textile',
      desc:
        lang === 'ar'
          ? `فرص عمل منظمة تشمل ${tailorCount} عقد عمل في الخياطة ضمن ورش ومصانع النسيج والملابس الجاهزة في إسبانيا.`
          : lang === 'es'
          ? `Oportunidades laborales con ${tailorCount} contratos de costura en talleres e industrias textiles de España.`
          : `Opportunités comprenant ${tailorCount} contrats de couture dans les ateliers et industries textiles en Espagne.`,
      bullets:
        lang === 'ar'
          ? [
              `${tailorCount} عقد عمل خياط متاح عبر 10 مدن إسبانية`,
              'خياطو آلات صناعية وتشطيب الملابس',
              'عقود منظمة وفق القانون الإسباني',
            ]
          : lang === 'es'
          ? [
              `${tailorCount} contratos disponibles en 10 ciudades`,
              'Operarios de maquinaria industrial y acabado',
              'Contratos conformes a la normativa española',
            ]
          : [
              `${tailorCount} contrats disponibles dans 10 villes`,
              'Opérateurs sur machines industrielles',
              'Contrats conformes à la législation espagnole',
            ],
      icon: <Scissors className="w-6 h-6" style={{ color: accentColor }} />,
    },
  ];

  const statIcons = [
    <Users className="w-6 h-6" style={{ color: accentColor }} />,
    <FileCheck2 className="w-6 h-6" style={{ color: accentColor }} />,
    <FolderCheck className="w-6 h-6" style={{ color: accentColor }} />,
    <MapPin className="w-6 h-6" style={{ color: accentColor }} />,
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* =================================================================== */}
      {/* TOP BAR (Black obsidian header with sleek center nav strip)         */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
          >
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={brandTitle}
                referrerPolicy="no-referrer"
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                <Plane className="w-4 h-4" />
              </span>
            )}
            <span>{brandTitle}</span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-neutral-300 bg-[#141518] px-7 py-2 rounded-lg border border-white/10">
            {(settings.navLinks || []).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => handleNavClick(nav.target)}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {tField(nav, 'label', lang)}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('jobs')}
              style={{ backgroundColor: accentColor }}
              className="px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              {t.applyNow}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle Menu"
              className="md:hidden p-2 rounded-lg border border-white/10 text-neutral-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#121316] px-4 py-4 space-y-2">
            {(settings.navLinks || []).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => handleNavClick(nav.target)}
                className="block w-full text-start px-3 py-2.5 rounded-lg text-sm font-semibold text-neutral-200 hover:bg-white/5"
              >
                {tField(nav, 'label', lang)}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* =================================================================== */}
      {/* ROUTE VIEWPORT                                                      */}
      {/* =================================================================== */}
      <main className="flex-1">
        {route.view === 'cities' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <h1 className="text-3xl font-bold text-white">{t.allCities}</h1>
                <p className="text-sm text-neutral-400 mt-1">{t.selectCityPrompt}</p>
              </div>
              <button
                type="button"
                onClick={() => setRoute({ view: 'home' })}
                className="px-4 py-2 rounded-lg bg-[#1A1B20] border border-white/10 text-xs font-semibold text-white"
              >
                {t.backHome}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setRoute({ view: 'city', slug: c.slug })}
                  className="text-start rounded-2xl border border-white/10 bg-[#141518] overflow-hidden hover:border-[#C81E1E]/60 transition-colors group"
                >
                  <div className="aspect-[16/9] w-full overflow-hidden relative bg-[#1B1D22]">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={tField(c, 'name', lang)}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div className="absolute bottom-3 start-4 end-4 flex items-center justify-between text-xs text-white">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-[#C81E1E]" />
                        {c.name_es}
                      </span>
                      <span className="tabular-nums">{c.active_jobs_count ?? 0} {t.activeOffers}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-white">{tField(c, 'name', lang)}</h2>
                    <p className="text-xs text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {tField(c, 'description', lang)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {route.view === 'city' && (
          <CityDetailView
            slug={route.slug}
            lang={lang}
            onBack={() => setRoute({ view: 'home' })}
            onSelectJob={(id) => setRoute({ view: 'job', id })}
            onApplyJob={(job) => setApplyModalJob(job)}
          />
        )}

        {route.view === 'jobs' && (
          <JobsDirectoryView
            cities={cities}
            lang={lang}
            initialCategory={jobsInitialCategory}
            onBack={() => setRoute({ view: 'home' })}
            onSelectJob={(id) => setRoute({ view: 'job', id })}
            onApplyJob={(job) => setApplyModalJob(job)}
          />
        )}

        {route.view === 'job' && (
          <JobDetailView
            jobId={route.id}
            lang={lang}
            onBack={() => setRoute({ view: 'jobs' })}
            onApplyJob={(job) => setApplyModalJob(job)}
          />
        )}

        {route.view === 'home' && (
          <div>
            {/* ============================================================= */}
            {/* 1. HERO SECTION (Black Obsidian canvas with dotted pattern)   */}
            {/* ============================================================= */}
            <section className="relative bg-[#0A0A0A] border-b border-white/10 overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                  backgroundImage: 'radial-gradient(#2C2E35 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  background: `radial-gradient(circle at 75% 30%, ${accentColor}33 0%, transparent 55%)`,
                }}
              />

              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-14 sm:pb-20">
                <div className="flex flex-wrap items-center justify-end gap-4 pb-8">
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#141518] border border-white/10">
                    <Globe className="w-3.5 h-3.5 text-neutral-400 mx-1.5" />
                    {(
                      [
                        { code: 'ar', label: 'العربية' },
                        { code: 'es', label: 'Español' },
                        { code: 'fr', label: 'Français' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setLang(item.code)}
                        style={lang === item.code ? { backgroundColor: accentColor } : undefined}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                          lang === item.code
                            ? 'text-white'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  <div className="lg:col-span-6 space-y-6">
                    <p
                      className="text-xs sm:text-sm font-bold tracking-wide"
                      style={{ color: accentColor }}
                    >
                      {lang === 'ar'
                        ? 'بوابة المواكبة المهنية في إسبانيا'
                        : lang === 'es'
                        ? 'Agencia Especializada en España'
                        : 'Agence Spécialisée en Espagne'}
                    </p>
                    <h1
                      className="font-extrabold text-white leading-tight tracking-tight"
                      style={{ fontSize: 'clamp(2rem, 4vw, 3.35rem)', textWrap: 'balance' }}
                    >
                      {tField(settings, 'heroTitle', lang)}
                    </h1>
                    <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl">
                      {tField(settings, 'heroSubtitle', lang)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleNavClick('jobs')}
                        style={{ backgroundColor: accentColor }}
                        className="px-6 py-3 rounded-lg text-sm font-bold text-white hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                      >
                        <span>{t.applyNow}</span>
                        <ArrowDirIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('jobs', 'الخياطة وصناعة الملابس')}
                        className="px-6 py-3 rounded-lg text-sm font-bold text-white bg-[#141518] border border-white/15 hover:border-[#C81E1E] transition-colors inline-flex items-center gap-2 tabular-nums"
                      >
                        <Scissors className="w-4 h-4" style={{ color: accentColor }} />
                        <span>
                          {lang === 'ar'
                            ? `عقود الخياطة (${tailorCount})`
                            : lang === 'es'
                            ? `Contratos Costura (${tailorCount})`
                            : `Contrats Couture (${tailorCount})`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavClick('cities')}
                        className="px-6 py-3 rounded-lg text-sm font-bold text-white bg-[#141518] border border-white/15 hover:border-white/35 transition-colors"
                      >
                        {t.allCities}
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#141518]">
                      <div className="aspect-[16/10] w-full overflow-hidden">
                        <img
                          src="/src/assets/images/slider_madrid_skyline_1795347961385.jpg"
                          alt={brandTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 sm:p-5 bg-[#121316] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                          <MapPin className="w-4 h-4" style={{ color: accentColor }} />
                          <span>Madrid · Barcelona · Valencia · Alicante · Sevilla</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('section-map');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          style={{ color: accentColor }}
                          className="text-xs font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <span>{lang === 'ar' ? 'استكشف الخريطة' : 'Explorar mapa'}</span>
                          <ArrowDirIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================= */}
            {/* 2. OUTSTANDING SECTORS 3-COLUMN GRID (#111215)                */}
            {/* ============================================================= */}
            <section className="bg-[#111215] py-16 border-b border-white/10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="text-center max-w-2xl mx-auto mb-12">
                  <p className="text-xs font-bold mb-2" style={{ color: accentColor }}>
                    {lang === 'ar' ? 'القطاعات المتوفرة' : lang === 'es' ? 'SECTORES DISPONIBLES' : 'SECTEURS DISPONIBLES'}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {lang === 'ar'
                      ? 'مجالات وخدمات التوظيف المميزة'
                      : lang === 'es'
                      ? 'Servicios y Sectores Laborales Destacados'
                      : 'Secteurs et Services Professionnels'}
                  </h2>
                </div>

                <div className="max-w-3xl mx-auto">
                  {sectorCards.map((card) => (
                    <div
                      key={card.title}
                      className="bg-[#17181D] rounded-2xl border border-white/10 p-7 sm:p-8 flex flex-col justify-between gap-6 hover:border-white/25 transition-colors"
                    >
                      <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white">{card.title}</h3>
                        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                          {card.desc}
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                          {card.bullets.map((b) => (
                            <li key={b} className="flex items-center gap-2 text-xs text-neutral-200 font-medium">
                              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-[#111215] border border-white/10 flex items-center justify-center">
                          {card.icon}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNavClick('jobs', card.categoryKey)}
                          style={{ backgroundColor: accentColor }}
                          className="px-5 py-2.5 rounded-lg text-xs font-bold text-white hover:opacity-90 inline-flex items-center gap-2 transition-opacity"
                          aria-label={card.title}
                        >
                          <span>
                            {lang === 'ar'
                              ? `عرض عقود الخياطة (${tailorCount})`
                              : lang === 'es'
                              ? `Ver contratos (${tailorCount})`
                              : `Voir les contrats (${tailorCount})`}
                          </span>
                          <ArrowDirIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ============================================================= */}
            {/* DYNAMIC SECTIONS CONTROLLED BY ADMIN                          */}
            {/* ============================================================= */}
            {orderedSectionIds.map((secId) => {
              if (secId === 'about' && sectionVisible('about')) {
                return (
                  <section key="about" id="section-about" className="bg-[#0A0A0A] py-16 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                      <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                        <p className="text-xs font-bold" style={{ color: accentColor }}>
                          {lang === 'ar' ? 'تعرف على الوكالة' : 'SOBRE LA AGENCIA'}
                        </p>
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-snug">
                          {tField(settings, 'aboutTitle', lang)}
                        </h2>
                        <div className="space-y-3 text-sm sm:text-base text-neutral-300 leading-relaxed whitespace-pre-line">
                          {tField(settings, 'aboutText', lang)}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {[
                            lang === 'ar' ? 'معلومات دقيقة للشركات' : 'Información verificada',
                            lang === 'ar' ? 'حماية أرقام المشغلين' : 'Teléfonos protegidos',
                            lang === 'ar' ? 'رفع الوثائق برمز دخول' : 'Documentos con código',
                            lang === 'ar' ? 'تغطية 14 مدينة إسبانية' : '14 ciudades en España',
                          ].map((bullet) => (
                            <div key={bullet} className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                              <span>{bullet}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleNavClick('jobs')}
                            style={{ backgroundColor: accentColor }}
                            className="px-6 py-3 rounded-lg text-sm font-bold text-white hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                          >
                            <span>{t.applyNow}</span>
                            <ArrowDirIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-white/10 min-h-[340px]">
                        <img
                          src={settings.aboutImageUrl || '/src/assets/images/about_agency_consultation_1795347962650.jpg'}
                          alt={tField(settings, 'aboutTitle', lang)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </section>
                );
              }

              if (secId === 'statistics' && sectionVisible('statistics')) {
                return (
                  <section key="statistics" id="section-statistics" className="bg-[#16171C] text-white py-12 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        {statistics.map((stat, idx) => (
                          <div key={stat.id} className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              {statIcons[idx % statIcons.length]}
                            </div>
                            <div>
                              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                                <AnimatedCounter target={stat.value} />+
                              </div>
                              <p className="text-xs text-neutral-400 mt-0.5 font-medium">
                                {tField(stat, 'label', lang)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (secId === 'map' && sectionVisible('map')) {
                return (
                  <React.Fragment key="map">
                    <section className="bg-[#111215] py-16 border-b border-white/10">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                          <p className="text-xs font-bold mb-2" style={{ color: accentColor }}>
                            {lang === 'ar' ? 'الوجهات المتاحة' : 'DESTINOS EN ESPAÑA'}
                          </p>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                            {lang === 'ar'
                              ? 'فرص المواكبة في المدن الإسبانية'
                              : lang === 'es'
                              ? 'Oportunidades en las Ciudades Españolas'
                              : 'Opportunités dans les Villes Espagnoles'}
                          </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {displayedCities.map((c) => (
                            <div
                              key={c.id}
                              className="bg-[#17181D] rounded-2xl border border-white/10 p-5 flex flex-col justify-between gap-4 hover:border-white/25 transition-colors"
                            >
                              <div className="space-y-3 text-center">
                                <div className="w-9 h-9 rounded-full bg-[#111215] border border-white/10 flex items-center justify-center mx-auto">
                                  <MapPin className="w-4 h-4" style={{ color: accentColor }} />
                                </div>
                                <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#0E0F12]">
                                  <img
                                    src={c.image_url || '/src/assets/images/slider_madrid_skyline_1795347961385.jpg'}
                                    alt={tField(c, 'name', lang)}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <h3 className="text-base font-bold text-white">
                                  {tField(c, 'name', lang)}
                                </h3>
                                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                  {tField(c, 'description', lang)}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setRoute({ view: 'city', slug: c.slug });
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                style={{ color: accentColor }}
                                className="pt-3 border-t border-white/10 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:underline"
                              >
                                <span>{t.exploreCity}</span>
                                <ArrowDirIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {cities.length > 4 && (
                          <div className="mt-8 text-center">
                            <button
                              type="button"
                              onClick={() => setShowAllCitiesGrid((v) => !v)}
                              className="px-6 py-2.5 rounded-lg bg-[#1A1B20] border border-white/15 text-xs font-bold text-white hover:border-[#C81E1E] transition-colors"
                            >
                              {showAllCitiesGrid
                                ? lang === 'ar'
                                  ? 'عرض أقل'
                                  : 'Mostrar menos'
                                : lang === 'ar'
                                ? `عرض جميع المدن (${cities.length})`
                                : `Ver todas las ciudades (${cities.length})`}
                            </button>
                          </div>
                        )}
                      </div>
                    </section>

                    <section id="section-map" className="bg-[#0A0A0A] py-16 border-b border-white/10">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="mb-8">
                          <p className="text-xs font-bold mb-1" style={{ color: accentColor }}>
                            {lang === 'ar' ? 'الخريطة التفاعلية' : 'MAPA INTERACTIVO'}
                          </p>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                            {lang === 'ar'
                              ? 'خريطة إسبانيا — استكشف الشركات والعروض حسب المدينة'
                              : lang === 'es'
                              ? 'Mapa de España — Empresas y Ofertas por Ciudad'
                              : 'Carte d’Espagne — Entreprises et Offres par Ville'}
                          </h2>
                        </div>
                        <SpainMap
                          cities={cities}
                          lang={lang}
                          accentColor={accentColor}
                          onOpenCity={(slug) => {
                            setRoute({ view: 'city', slug });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          onApplyJob={(job) => setApplyModalJob(job)}
                        />
                      </div>
                    </section>
                  </React.Fragment>
                );
              }

              if (secId === 'slider' && sectionVisible('slider')) {
                return (
                  <section key="slider" id="section-slider" className="bg-[#111215] py-16 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                      <div className="lg:col-span-6 space-y-6">
                        <ImageSlider sliders={sliders} lang={lang} />

                        <div className="bg-[#17181D] rounded-2xl border border-white/10 p-6 space-y-4">
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
                              <span>
                                {lang === 'ar'
                                  ? 'وضوح الشروط ومتطلبات التقديم'
                                  : lang === 'es'
                                  ? 'Claridad en requisitos y procesos'
                                  : 'Clarté des conditions et démarches'}
                              </span>
                              <span className="tabular-nums">96%</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: '96%', backgroundColor: accentColor }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
                              <span>
                                {lang === 'ar'
                                  ? 'حماية المعطيات والوثائق المرفوعة'
                                  : lang === 'es'
                                  ? 'Protección de datos y documentos'
                                  : 'Protection des données et documents'}
                              </span>
                              <span className="tabular-nums">100%</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: accentColor }} />
                            </div>
                          </div>

                          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                              <Award className="w-5 h-5" style={{ color: accentColor }} />
                              <span>{lang === 'ar' ? 'نظام وثائق محمي برمز دخول' : 'Sistema protegido por código'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleNavClick('jobs')}
                              style={{ backgroundColor: accentColor }}
                              className="px-5 py-2.5 rounded-lg text-xs font-bold text-white hover:opacity-90"
                            >
                              {t.applyNow}
                            </button>
                          </div>
                        </div>
                      </div>

                      {sectionVisible('conditions') && (
                        <div id="section-conditions" className="lg:col-span-6 space-y-5">
                          <div>
                            <p className="text-xs font-bold mb-1" style={{ color: accentColor }}>
                              {lang === 'ar' ? 'الشروط والضوابط' : 'REQUISITOS'}
                            </p>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                              {t.conditionsHeading}
                            </h2>
                            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                              {t.conditionsSub}
                            </p>
                          </div>

                          <div className="space-y-3">
                            {conditions.map((cond, idx) => {
                              const isOpen = openConditionIdx === idx;
                              return (
                                <div
                                  key={cond.id}
                                  className="rounded-xl border border-white/10 bg-[#17181D] overflow-hidden"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setOpenConditionIdx(isOpen ? -1 : idx)}
                                    className="w-full px-5 py-4 flex items-center justify-between gap-3 text-start"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span
                                        className="w-7 h-7 rounded-lg text-xs font-mono-tabular font-bold text-white flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: isOpen ? accentColor : '#25272E' }}
                                      >
                                        {String(idx + 1).padStart(2, '0')}
                                      </span>
                                      <span className="text-sm font-bold text-white">
                                        {tField(cond, 'text', lang)}
                                      </span>
                                    </div>
                                    <ChevronDown
                                      className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                                        isOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                  {isOpen && (
                                    <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-neutral-300 border-t border-white/10 leading-relaxed">
                                      {lang === 'ar'
                                        ? 'يتم التحقق من استيفاء هذا الشرط أثناء دراسة الملف ومراجعة الوثائق الرسمية.'
                                        : lang === 'es'
                                        ? 'Este requisito se verifica durante la revisión del expediente y la documentación oficial.'
                                        : 'Cette condition est vérifiée lors de l’étude du dossier et des justificatifs officiels.'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              }

              if (secId === 'conditions' && sectionVisible('conditions') && !sectionVisible('slider')) {
                return (
                  <section key="conditions" id="section-conditions" className="bg-[#111215] py-16 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                        {t.conditionsHeading}
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {conditions.map((cond, idx) => (
                          <div key={cond.id} className="p-6 rounded-2xl border border-white/10 bg-[#17181D] space-y-3">
                            <span className="text-sm font-mono-tabular font-bold" style={{ color: accentColor }}>
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            <p className="text-sm font-bold text-white">{tField(cond, 'text', lang)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              if (secId === 'contact' && sectionVisible('contact')) {
                return (
                  <section key="contact" id="section-contact" className="bg-[#0A0A0A] py-16 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                      <div className="lg:col-span-5 flex flex-col justify-between gap-6">
                        <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[16/10] bg-[#141518]">
                          <img
                            src="/src/assets/images/slider_valencia_logistics_1795347963529.jpg"
                            alt={t.contactHeading}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            { icon: <Phone className="w-4 h-4 text-white" />, title: 'WhatsApp', val: settings.whatsapp },
                            { icon: <Mail className="w-4 h-4 text-white" />, title: t.email, val: settings.email },
                            { icon: <MapPin className="w-4 h-4 text-white" />, title: t.citiesNav, val: `${cities.length} ${lang === 'ar' ? 'مدينة إسبانية' : 'Ciudades'}` },
                            { icon: <Clock className="w-4 h-4 text-white" />, title: lang === 'ar' ? 'المواكبة' : 'Horario', val: '09:00 - 18:00 CET' },
                          ].map((info) => (
                            <div key={info.title} className="p-4 rounded-xl bg-[#141518] border border-white/10 flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: accentColor }}
                              >
                                {info.icon}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-neutral-400 font-semibold">{info.title}</p>
                                <p className="text-xs font-bold text-white truncate" dir="ltr">{info.val}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#141518] p-6 sm:p-8 flex flex-col justify-center">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                          {t.contactHeading}
                        </h2>
                        <p className="text-sm text-neutral-400 mb-6">{t.contactSub}</p>

                        <form onSubmit={handleContactSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input
                              type="text"
                              required
                              placeholder={t.fullName}
                              value={contactForm.fullName}
                              onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                              className="px-4 py-3 rounded-lg bg-[#1B1D22] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C81E1E]"
                            />
                            <input
                              type="email"
                              required
                              dir="ltr"
                              placeholder={t.email}
                              value={contactForm.email}
                              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                              className="px-4 py-3 rounded-lg bg-[#1B1D22] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C81E1E]"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input
                              type="tel"
                              dir="ltr"
                              placeholder={t.whatsapp}
                              value={contactForm.whatsapp}
                              onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })}
                              className="px-4 py-3 rounded-lg bg-[#1B1D22] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C81E1E]"
                            />
                            <input
                              type="text"
                              placeholder={t.subject}
                              value={contactForm.subject}
                              onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                              className="px-4 py-3 rounded-lg bg-[#1B1D22] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C81E1E]"
                            />
                          </div>
                          <textarea
                            rows={4}
                            required
                            placeholder={t.message}
                            value={contactForm.message}
                            onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg bg-[#1B1D22] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C81E1E]"
                          />

                          {contactError && <p className="text-xs text-red-400 font-semibold">{contactError}</p>}
                          {contactSuccess && (
                            <p className="text-xs text-emerald-400 font-semibold inline-flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              {t.messageSent}
                            </p>
                          )}

                          <button
                            type="submit"
                            disabled={contactSending}
                            style={{ backgroundColor: accentColor }}
                            className="px-6 py-3 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {t.sendMessage}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                );
              }

              if (secId === 'testimonials' && sectionVisible('testimonials') && testimonials.length > 0) {
                return (
                  <section key="testimonials" id="section-testimonials" className="bg-[#111215] py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
                        <div>
                          <p className="text-xs font-bold mb-1" style={{ color: accentColor }}>
                            {lang === 'ar' ? 'آراء وتجارب' : 'TESTIMONIOS'}
                          </p>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                            {t.testimonialsHeading}
                          </h2>
                          <p className="mt-1 text-sm text-neutral-400">{t.testimonialsSub}</p>
                        </div>
                        {testimonials.length > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTestiIdx((i) => (i - 1 + testimonials.length) % testimonials.length)}
                              aria-label="Previous testimonial"
                              className="w-10 h-10 rounded-full border border-white/15 bg-[#17181D] hover:border-[#C81E1E] text-white flex items-center justify-center"
                            >
                              {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setTestiIdx((i) => (i + 1) % testimonials.length)}
                              aria-label="Next testimonial"
                              className="w-10 h-10 rounded-full border border-white/15 bg-[#17181D] hover:border-[#C81E1E] text-white flex items-center justify-center"
                            >
                              {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {visibleTestimonials.map((item, idx) => (
                          <div
                            key={`${item.id}-${idx}`}
                            className="bg-[#17181D] rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between"
                          >
                            <div className="relative h-48 bg-[#0E0F12] overflow-hidden">
                              <img
                                src={item.avatar_url || '/src/assets/images/testimonial_portrait_1_1795347962944.jpg'}
                                alt={item.client_name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <div
                                className="absolute bottom-3 start-4 px-3 py-1.5 rounded-md text-white text-xs font-bold shadow-sm"
                                style={{ backgroundColor: accentColor }}
                              >
                                {item.client_name}
                              </div>
                            </div>
                            <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                              <p className="text-sm text-neutral-300 leading-relaxed">
                                “{tField(item, 'quote', lang)}”
                              </p>
                              <div className="pt-3 border-t border-white/10 text-xs font-bold" style={{ color: accentColor }}>
                                {tField(item, 'city_or_service', lang)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              return null;
            })}

            {/* ============================================================= */}
            {/* PRE-FOOTER BOLD CRIMSON CTA BANNER                            */}
            {/* ============================================================= */}
            <section style={{ backgroundColor: accentColor }} className="text-white py-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {lang === 'ar'
                      ? 'هل أنت مستعد لبدء خطوتك المهنية في إسبانيا؟'
                      : lang === 'es'
                      ? '¿Listo para dar el siguiente paso profesional en España?'
                      : 'Prêt à démarrer votre démarche professionnelle en Espagne ?'}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/90 mt-1">
                    {lang === 'ar'
                      ? 'اختر عرض العمل المناسب لملفك وتابع مراحل التقديم بشكل منظم وآمن.'
                      : lang === 'es'
                      ? 'Elija la oferta que mejor se adapte a su perfil y complete su solicitud de forma segura.'
                      : 'Choisissez l’offre adaptée à votre profil et suivez chaque étape de votre candidature.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 shrink-0">
                  <div className="flex items-center gap-3 bg-black/25 px-4 py-2.5 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#0A0A0A] flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] text-white/80">{lang === 'ar' ? 'تواصل مباشر' : 'WhatsApp'}</p>
                      <p className="text-sm font-mono-tabular font-bold" dir="ltr">{settings.whatsapp}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNavClick('jobs')}
                    className="px-6 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-bold hover:bg-black transition-colors whitespace-nowrap"
                  >
                    {t.applyNow}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* DARK FOOTER                                                         */}
      {/* =================================================================== */}
      <footer className="bg-[#070709] text-neutral-300 py-14 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-lg font-extrabold text-white font-display">
              <Building2 className="w-5 h-5" style={{ color: accentColor }} />
              <span>{brandTitle}</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-md">
              {tField(settings, 'footerBio', lang)}
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <p className="font-bold text-white mb-3">{t.citiesNav} / {t.jobsNav}</p>
            {(settings.navLinks || []).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => handleNavClick(nav.target)}
                className="block text-neutral-400 hover:text-white transition-colors"
              >
                {tField(nav, 'label', lang)}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 text-xs">
            <p className="font-bold text-white mb-3">{t.contactHeading}</p>
            <p className="text-neutral-400 font-mono-tabular" dir="ltr">{settings.whatsapp}</p>
            <p className="text-neutral-400" dir="ltr">{settings.email}</p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button type="button" onClick={() => setLegalModal('privacy')} className="text-neutral-300 hover:text-white">
                {t.privacyPolicy}
              </button>
              <button type="button" onClick={() => setLegalModal('terms')} className="text-neutral-300 hover:text-white">
                {t.termsConditions}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoute({ view: 'admin' });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ color: accentColor }}
                className="font-bold hover:underline"
              >
                {t.adminPortal}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {applyModalJob && (
        <ApplicationModal
          job={applyModalJob}
          lang={lang}
          onClose={() => {
            setApplyModalJob(null);
            fetchBootstrap();
          }}
        />
      )}

      {legalModal && (
        <LegalModal
          type={legalModal}
          lang={lang}
          onClose={() => setLegalModal(null)}
        />
      )}
    </div>
  );
}

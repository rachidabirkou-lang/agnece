import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  MapPin,
  Phone,
  X,
} from 'lucide-react';
import { tField, UI_TEXT } from '../i18n';
import type { City, Company, ConditionItem, JobOffer, Language } from '../types';

interface CityDetailViewProps {
  slug: string;
  lang: Language;
  onBack: () => void;
  onSelectJob: (jobId: number) => void;
  onApplyJob: (job: JobOffer) => void;
}

export const CityDetailView: React.FC<CityDetailViewProps> = ({
  slug,
  lang,
  onBack,
  onSelectJob,
  onApplyJob,
}) => {
  const t = UI_TEXT[lang];
  const isRtl = lang === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const [data, setData] = useState<{ city: City; companies: Company[]; jobs: JobOffer[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cities/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, [slug]);

  const categories = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.jobs.forEach((j) => set.add(tField(j, 'category', lang)));
    return Array.from(set);
  }, [data, lang]);

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === 'all') return data.jobs;
    return data.jobs.filter((j) => tField(j, 'category', lang) === categoryFilter);
  }, [data, categoryFilter, lang]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-44 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-44 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-neutral-300">{t.noJobsInCity}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-[#242424] text-white text-sm font-semibold"
        >
          {t.backHome}
        </button>
      </div>
    );
  }

  const { city, companies } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white font-semibold transition-colors"
      >
        <BackIcon className="w-4 h-4 text-[#C81E1E]" />
        <span>{t.backHome}</span>
      </button>

      {/* City Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#141518]">
        <div className="aspect-[21/9] min-h-[220px] w-full relative">
          {city.image_url ? (
            <img
              src={city.image_url}
              alt={tField(city, 'name', lang)}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1C1D22] to-[#0A0A0A]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-200 mb-2">
              <MapPin className="w-3.5 h-3.5 text-[#C81E1E]" />
              <span>{city.name_es}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{data.jobs.length} {t.activeOffers}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{companies.length} {t.companiesCount}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              {tField(city, 'name', lang)}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-neutral-200 max-w-2xl leading-relaxed">
              {tField(city, 'description', lang)}
            </p>
          </div>
        </div>
      </div>

      {/* Companies in City */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#C81E1E]" />
          <span>{t.companiesCount} — {tField(city, 'name', lang)}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.map((co) => (
            <div
              key={co.id}
              className="p-5 rounded-2xl border border-white/10 bg-[#141518] space-y-3"
            >
              <div className="text-xs font-semibold text-[#C81E1E]">
                {tField(co, 'sector', lang)}
              </div>
              <h3 className="text-base font-bold text-white" dir="ltr">
                {co.name_es}
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {tField(co, 'operator_info', lang)}
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
                <span>{t.maskedPhoneLabel}</span>
                <span className="font-mono-tabular text-white font-semibold inline-flex items-center gap-1.5" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-[#C81E1E]" />
                  {co.masked_phone}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Job Offers in City */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#C81E1E]" />
            <span>{t.activeOffers}</span>
          </h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#141518] border border-white/10">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  categoryFilter === 'all' ? 'bg-[#C81E1E] text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                {t.allCategories}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    categoryFilter === cat ? 'bg-[#C81E1E] text-white' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredJobs.length === 0 ? (
          <p className="text-sm text-neutral-400 py-10 text-center border border-dashed border-white/10 rounded-2xl bg-[#141518]">
            {t.noJobsInCity}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-6 rounded-2xl border border-white/10 bg-[#141518] hover:border-[#C81E1E]/60 transition-colors flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-400 mb-2">
                    <span>{tField(job, 'category', lang)} · {tField(job, 'contract_type', lang)}</span>
                    <span className="tabular-nums font-bold text-white">{job.positions_count} {t.positions}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{tField(job, 'title', lang)}</h3>
                  <p className="text-xs text-[#C81E1E] font-semibold mt-1" dir="ltr">{job.company_name_es}</p>
                  <p className="text-sm text-neutral-300 mt-3 leading-relaxed line-clamp-3">
                    {tField(job, 'description', lang)}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectJob(job.id)}
                    className="text-xs font-bold text-neutral-200 hover:text-[#C81E1E] transition-colors"
                  >
                    {t.viewOfferDetails}
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyJob(job)}
                    className="px-4 py-2 rounded-lg bg-[#C81E1E] text-white text-xs font-bold hover:bg-[#A61717] transition-colors"
                  >
                    {t.applyNow}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface JobDetailViewProps {
  jobId: number;
  lang: Language;
  onBack: () => void;
  onApplyJob: (job: JobOffer) => void;
}

export const JobDetailView: React.FC<JobDetailViewProps> = ({ jobId, lang, onBack, onApplyJob }) => {
  const t = UI_TEXT[lang];
  const isRtl = lang === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const [detail, setDetail] = useState<{ job: JobOffer; conditions: ConditionItem[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/jobs/${jobId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setDetail(res))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-72 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-neutral-300">{t.noJobsInCity}</p>
        <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl bg-[#242424] text-white text-sm">
          {t.backHome}
        </button>
      </div>
    );
  }

  const { job, conditions } = detail;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white font-semibold transition-colors"
      >
        <BackIcon className="w-4 h-4 text-[#C81E1E]" />
        <span>{t.backHome}</span>
      </button>

      <div className="rounded-2xl border border-white/10 bg-[#141518] p-6 sm:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-white/10">
          <div className="space-y-2">
            <div className="text-xs text-neutral-400">
              <span>{tField(job, 'city_name', lang)}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>{tField(job, 'category', lang)}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="tabular-nums font-semibold text-white">{job.positions_count} {t.positions}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
              {tField(job, 'title', lang)}
            </h1>
            <p className="text-base font-bold text-[#C81E1E]" dir="ltr">
              {job.company_name_es}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onApplyJob(job)}
            className="px-6 py-3 rounded-lg bg-[#C81E1E] text-white text-sm font-bold hover:bg-[#A61717] transition-colors whitespace-nowrap shrink-0"
          >
            {t.applyNow}
          </button>
        </div>

        {/* Company & Offer Specifications */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#1B1D22] border border-white/10">
            <p className="text-xs text-neutral-400">{t.maskedPhoneLabel}</p>
            <p className="text-sm font-mono-tabular font-bold text-white mt-1" dir="ltr">
              {job.masked_phone}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#1B1D22] border border-white/10">
            <p className="text-xs text-neutral-400">{t.contractType}</p>
            <p className="text-sm font-bold text-white mt-1">
              {tField(job, 'contract_type', lang)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#1B1D22] border border-white/10">
            <p className="text-xs text-neutral-400">{t.sector}</p>
            <p className="text-sm font-bold text-white mt-1">
              {tField(job, 'category', lang)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">{t.companyOperator}</h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {tField(job, 'operator_info', lang)}
          </p>
          <p className="text-sm text-neutral-200 leading-relaxed pt-2">
            {tField(job, 'description', lang)}
          </p>
        </div>

        {/* Conditions */}
        {conditions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h2 className="text-lg font-bold text-white">{t.conditionsHeading}</h2>
            <ul className="space-y-2.5">
              {conditions.map((cond) => (
                <li key={cond.id} className="flex items-start gap-2.5 text-sm text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-[#C81E1E] shrink-0 mt-1" />
                  <span>{tField(cond, 'text', lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

interface JobsDirectoryViewProps {
  cities: City[];
  lang: Language;
  initialCategory?: string;
  onBack: () => void;
  onSelectJob: (jobId: number) => void;
  onApplyJob: (job: JobOffer) => void;
}

export const JobsDirectoryView: React.FC<JobsDirectoryViewProps> = ({
  cities,
  lang,
  initialCategory = 'all',
  onBack,
  onSelectJob,
  onApplyJob,
}) => {
  const t = UI_TEXT[lang];
  const isRtl = lang === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);

  useEffect(() => {
    setSelectedCategory(initialCategory || 'all');
  }, [initialCategory]);

  useEffect(() => {
    setLoading(true);
    fetch('/api/jobs')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setJobs(rows))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => {
      if (!map.has(j.category_ar)) {
        map.set(j.category_ar, tField(j, 'category', lang));
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [jobs, lang]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (selectedCityId !== 'all' && String(j.city_id) !== selectedCityId) return false;
      if (selectedCategory !== 'all' && j.category_ar !== selectedCategory) return false;
      return true;
    });
  }, [jobs, selectedCityId, selectedCategory]);

  const totalPositions = useMemo(() => {
    return filtered.reduce((sum, j) => sum + (Number(j.positions_count) || 0), 0);
  }, [filtered]);

  const tailorTotal = useMemo(() => {
    return jobs
      .filter((j) => j.category_ar === 'الخياطة وصناعة الملابس')
      .reduce((sum, j) => sum + (Number(j.positions_count) || 0), 0);
  }, [jobs]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white font-semibold transition-colors"
      >
        <BackIcon className="w-4 h-4 text-[#C81E1E]" />
        <span>{t.backHome}</span>
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">{t.jobsNav}</h1>
          {!loading && (
            <p className="text-xs sm:text-sm text-neutral-300 tabular-nums">
              {lang === 'ar'
                ? `${filtered.length} عروض متاحة · إجمالي ${totalPositions} عقد عمل`
                : lang === 'es'
                ? `${filtered.length} ofertas disponibles · ${totalPositions} contratos en total`
                : `${filtered.length} offres disponibles · ${totalPositions} contrats au total`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tailorTotal > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelectedCategory((prev) =>
                  prev === 'الخياطة وصناعة الملابس' ? 'all' : 'الخياطة وصناعة الملابس'
                )
              }
              className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors tabular-nums ${
                selectedCategory === 'الخياطة وصناعة الملابس'
                  ? 'bg-[#C81E1E] border-[#C81E1E] text-white'
                  : 'bg-[#141518] border-white/15 text-neutral-200 hover:border-[#C81E1E]'
              }`}
            >
              {lang === 'ar'
                ? `عقود الخياطة (${tailorTotal})`
                : lang === 'es'
                ? `Contratos de Costura (${tailorTotal})`
                : `Contrats Couture (${tailorTotal})`}
            </button>
          )}

          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-[#141518] border border-white/15 text-xs font-medium text-white focus:outline-none focus:border-[#C81E1E]"
          >
            <option value="all">{t.allCities}</option>
            {cities.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {tField(c, 'name', lang)}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-[#141518] border border-white/15 text-xs font-medium text-white focus:outline-none focus:border-[#C81E1E]"
          >
            <option value="all">{t.allCategories}</option>
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-52 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((job) => (
            <div
              key={job.id}
              className="p-6 rounded-2xl border border-white/10 bg-[#141518] hover:border-[#C81E1E]/60 transition-colors flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-neutral-400 mb-2">
                  <span>{tField(job, 'city_name', lang)} · {tField(job, 'category', lang)}</span>
                  <span className="tabular-nums font-bold text-white">{job.positions_count} {t.positions}</span>
                </div>
                <h2 className="text-base font-bold text-white leading-snug">{tField(job, 'title', lang)}</h2>
                <p className="text-xs text-[#C81E1E] font-semibold mt-1" dir="ltr">{job.company_name_es}</p>
                <p className="text-xs text-neutral-400 font-mono-tabular mt-2" dir="ltr">
                  {job.masked_phone}
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectJob(job.id)}
                  className="text-xs font-bold text-neutral-200 hover:text-[#C81E1E]"
                >
                  {t.viewOfferDetails}
                </button>
                <button
                  type="button"
                  onClick={() => onApplyJob(job)}
                  className="px-4 py-2 rounded-lg bg-[#C81E1E] text-white text-xs font-bold hover:bg-[#A61717] transition-colors"
                >
                  {t.applyNow}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface LegalModalProps {
  type: 'privacy' | 'terms';
  lang: Language;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, lang, onClose }) => {
  const t = UI_TEXT[lang];
  const isPrivacy = type === 'privacy';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#121316] text-white overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#18191E]">
          <h3 className="text-lg font-bold">{isPrivacy ? t.privacyPolicy : t.termsConditions}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-neutral-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 sm:p-8 space-y-4 text-sm text-neutral-300 leading-relaxed max-h-[70vh] overflow-y-auto">
          {isPrivacy ? (
            lang === 'ar' ? (
              <>
                <p>تلتزم الوكالة بحماية المعطيات الشخصية للمترشحين وفق مقتضيات القانون المغربي رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، وكذا النظام الأوروبي العام لحماية البيانات (GDPR) عند انطباقه.</p>
                <p>يتم جمع المعلومات المقدمة في نموذج التقديم (الاسم الكامل، رقم WhatsApp، الخبرة المهنية، والوثائق المرفوعة عبر رمز الدخول) حصراً لغرض دراسة ملاءمة الملف لعروض العمل المطلوبة والتواصل مع المرشح.</p>
                <p>تُحفظ الوثائق المرفوعة داخل مسارات تخزين محمية لا يمكن الوصول إليها إلا بصلاحيات الإدارة المخولة، ولا يتم نشرها للعموم أو بيعها لأي طرف ثالث.</p>
                <p>يحق للمترشح في أي وقت طلب الاطلاع على بياناته أو تصحيحها أو حذفها عبر مراسلة فريق الوكالة عبر البريد الإلكتروني الرسمي.</p>
              </>
            ) : (
              <>
                <p>We protect candidate personal data in compliance with Moroccan Law 09-08 and the European General Data Protection Regulation (GDPR) where applicable.</p>
                <p>Submitted information (full name, WhatsApp contact, experience answers, and access-code-protected documents) is processed solely for evaluating candidacy and coordinating with Spanish employers.</p>
                <p>Documents are stored in restricted non-public storage accessible only to authorized administrators. Candidates may request access, correction, or deletion of their records at any time.</p>
              </>
            )
          ) : lang === 'ar' ? (
            <>
              <p>تعمل المنصة كوسيط مواكبة وإرشاد لتسهيل تواصل الباحثين عن العمل مع الشركات المشغلة في إسبانيا.</p>
              <p>ملاحظة قانونية أساسية: لا تُقدَّم عقود العمل أو التأشيرات على أنها مضمونة بأي حال من الأحوال. يخضع قبول الترشيح، إبرام عقد العمل، ومنح التأشيرة وتصاريح الإقامة حصراً لقرار الشركات المشغلة والسلطات الإدارية والقنصلية المختصة.</p>
              <p>يتحمل المرشح مسؤولية صحة ودقة المعلومات والوثائق التي يرفعها عبر النظام.</p>
            </>
          ) : (
            <>
              <p>This platform acts as a professional guidance and coordination intermediary connecting candidates with employers in Spain.</p>
              <p>Important Legal Notice: Employment contracts and visas are never guaranteed. All hiring decisions, contract issuance, and visa approvals rest solely with the employing companies and competent Spanish authorities.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

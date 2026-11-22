import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Briefcase,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquareQuote,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AccessCodeRecord,
  ApplicationRecord,
  AuditLogRecord,
  City,
  Company,
  ConditionItem,
  ContactMessageRecord,
  DocumentMeta,
  JobOffer,
  RegisteredUserRecord,
  SiteSettings,
  SliderItem,
  StatisticItem,
  TestimonialItem,
} from '../types';

type AdminTab =
  | 'overview'
  | 'users'
  | 'applications'
  | 'access-codes'
  | 'documents'
  | 'cities'
  | 'companies'
  | 'jobs'
  | 'conditions'
  | 'sliders'
  | 'testimonials'
  | 'statistics'
  | 'settings'
  | 'messages'
  | 'audit';

interface AdminDashboardProps {
  onExit: () => void;
  onSiteDataChanged: () => void;
}

const APP_STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  reviewed: 'قيد المراجعة',
  contacted: 'تم التواصل',
  accepted: 'مقبول مبدئياً',
  rejected: 'مرفوض',
  completed: 'مكتمل',
};

const JOB_STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  paused: 'متوقف',
  expired: 'منتهي',
  review: 'قيد المراجعة',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onExit,
  onSiteDataChanged,
}) => {
  // Keep session token strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{ email: string; name: string; role: string } | null>(null);
  const [authStatus, setAuthStatus] = useState<{ needsSetup: boolean; hasEnvPasscode: boolean } | null>(null);

  // Auth form states
  const [email, setEmail] = useState('');
  const [name, setName] = useState('مدير الوكالة');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard states
  const [tab, setTab] = useState<AdminTab>('overview');
  const [bannerMsg, setBannerMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Data stores
  const [overview, setOverview] = useState<{
    metrics: Record<string, number>;
    recentApplications: ApplicationRecord[];
    recentAuditLogs: AuditLogRecord[];
  } | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserRecord[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCodeRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [sliders, setSliders] = useState<SliderItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [statistics, setStatistics] = useState<StatisticItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // Application & User filters
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appCityFilter, setAppCityFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSourceFilter, setUserSourceFilter] = useState('');
  const [editingUserNotes, setEditingUserNotes] = useState<Record<number, string>>({});

  // Inline create/edit form states
  const [newCity, setNewCity] = useState({ name_ar: '', name_es: '', name_fr: '', slug: '', map_x: 50, map_y: 50, dot_color: 'orange', description_ar: '', image_url: '' });
  const [newCompany, setNewCompany] = useState({ city_id: '', name_es: '', sector_ar: 'الخياطة وصناعة الملابس', sector_es: 'Confección y Textil', sector_fr: 'Confection et Textile', phone: '', operator_info_ar: '' });
  const [newJob, setNewJob] = useState({
    company_id: '', title_ar: '', title_es: '', category_ar: 'الخياطة وصناعة الملابس', category_es: 'Confección y Textil',
    description_ar: '', contract_type_ar: 'عقد عمل مؤقت قابل للتجديد', positions_count: 5,
    application_question_ar: 'هل ترغب في التقدم للحصول على عقد عمل في مجال الخياطة لدى هذه الشركة؟',
    experience_question_ar: 'هل سبق لك العمل في شركة متخصصة في الخياطة أو صناعة الملابس في المغرب؟',
    status: 'active',
  });
  const [newCode, setNewCode] = useState({ code: '', job_offer_id: '', max_uses: 3, expires_at: '' });
  const [newCondition, setNewCondition] = useState({ text_ar: '', text_es: '', text_fr: '', job_offer_id: '', display_order: 5 });
  const [newSlider, setNewSlider] = useState({ title_ar: '', title_es: '', subtitle_ar: '', image_url: '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', display_order: 4 });
  const [newTestimonial, setNewTestimonial] = useState({ client_name: '', city_or_service_ar: '', quote_ar: '', avatar_url: '/src/assets/images/testimonial_portrait_1_1795347962944.jpg' });

  const notify = (msg: string) => {
    setBannerMsg(msg);
    setErrorMsg('');
    setTimeout(() => setBannerMsg(''), 3500);
  };

  const notifyErr = (msg: string) => {
    setErrorMsg(msg);
    setBannerMsg('');
  };

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        setToken(null);
        setAdminUser(null);
        throw new Error('انتهت جلسة الإدارة، يرجى تسجيل الدخول مجدداً');
      }
      return res;
    },
    [token]
  );

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then((s) => setAuthStatus(s))
      .catch(() => setAuthStatus({ needsSetup: false, hasEnvPasscode: false }));
  }, []);

  const loadAllAdminData = useCallback(async () => {
    if (!token) return;
    try {
      const [
        ovRes, ciRes, coRes, joRes, condRes, acRes, docRes, slRes, teRes, stRes, setRes, msgRes, auRes,
      ] = await Promise.all([
        apiFetch('/api/admin/overview'),
        apiFetch('/api/admin/cities'),
        apiFetch('/api/admin/companies'),
        apiFetch('/api/admin/jobs'),
        apiFetch('/api/admin/conditions'),
        apiFetch('/api/admin/access-codes'),
        apiFetch('/api/admin/documents'),
        apiFetch('/api/admin/sliders'),
        apiFetch('/api/admin/testimonials'),
        apiFetch('/api/admin/statistics'),
        apiFetch('/api/admin/settings'),
        apiFetch('/api/admin/contact-messages'),
        apiFetch('/api/admin/audit-logs'),
      ]);

      setOverview(await ovRes.json());
      setCities(await ciRes.json());
      setCompanies(await coRes.json());
      setJobs(await joRes.json());
      setConditions(await condRes.json());
      setAccessCodes(await acRes.json());
      setDocuments(await docRes.json());
      setSliders(await slRes.json());
      setTestimonials(await teRes.json());
      setStatistics(await stRes.json());
      setSettings(await setRes.json());
      setMessages(await msgRes.json());
      setAuditLogs(await auRes.json());
    } catch (err: any) {
      notifyErr(err?.message || 'خطأ في تحميل بيانات الإدارة');
    }
  }, [token, apiFetch]);

  const loadApplications = useCallback(async () => {
    if (!token) return;
    const qs = new URLSearchParams();
    if (appSearch) qs.set('search', appSearch);
    if (appStatusFilter) qs.set('status', appStatusFilter);
    if (appCityFilter) qs.set('cityId', appCityFilter);
    const res = await apiFetch(`/api/admin/applications?${qs.toString()}`);
    if (res.ok) setApplications(await res.json());
  }, [token, apiFetch, appSearch, appStatusFilter, appCityFilter]);

  const loadRegisteredUsers = useCallback(async () => {
    if (!token) return;
    const qs = new URLSearchParams();
    if (userSearch) qs.set('search', userSearch);
    if (userSourceFilter) qs.set('source', userSourceFilter);
    const res = await apiFetch(`/api/admin/users?${qs.toString()}`);
    if (res.ok) setRegisteredUsers(await res.json());
  }, [token, apiFetch, userSearch, userSourceFilter]);

  useEffect(() => {
    if (token) {
      loadAllAdminData();
    }
  }, [token, loadAllAdminData]);

  useEffect(() => {
    if (token) {
      loadApplications();
    }
  }, [token, loadApplications]);

  useEffect(() => {
    if (token) {
      loadRegisteredUsers();
    }
  }, [token, loadRegisteredUsers]);

  const exportRegisteredUsersCsv = async () => {
    try {
      const res = await apiFetch('/api/admin/users/export');
      if (!res.ok) throw new Error('تعذر تصدير البيانات');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'registered-candidates.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('تم تصدير سجل المسجلين بنجاح');
    } catch (err: any) {
      notifyErr(err?.message || 'فشل تصدير الملف');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'تعذر إنشاء حساب الإدارة');
      } else {
        setToken(data.token);
        setAdminUser(data.admin);
      }
    } catch {
      setAuthError('خطأ في الاتصال بالخادم');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'بيانات الدخول غير صحيحة');
      } else {
        setToken(data.token);
        setAdminUser(data.admin);
      }
    } catch {
      setAuthError('خطأ في الاتصال بالخادم');
    } finally {
      setAuthLoading(false);
    }
  };

  const uploadAdminAsset = async (file: File | null): Promise<string | null> => {
    if (!file) return null;
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiFetch('/api/admin/upload-asset', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      notifyErr(data.error || 'فشل رفع الصورة');
      return null;
    }
    return data.url;
  };

  const downloadProtectedDocument = async (doc: DocumentMeta) => {
    try {
      const res = await apiFetch(`/api/admin/documents/${doc.id}/download`);
      if (!res.ok) {
        notifyErr('تعذر تنزيل الوثيقة');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notifyErr('فشل تنزيل الوثيقة');
    }
  };

  // =========================================================================
  // LOGIN / FIRST-RUN SETUP GATE
  // =========================================================================
  if (!token) {
    const needsSetup = authStatus?.needsSetup ?? false;
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#F97316]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {needsSetup ? 'تفعيل حساب المدير الأول' : 'بوابة لوحة الإدارة'}
                </h1>
                <p className="text-xs text-neutral-400">
                  {needsSetup ? 'قم بتعيين بريد وكلمة مرور الإدارة لتأمين اللوحة' : 'وصول محمي لإدارة المنصة والطلبات'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1"
            >
              <span>الموقع</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={needsSetup ? handleSetup : handleLogin} className="space-y-4">
            {needsSetup && (
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">الاسم</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-white/10 text-sm text-white focus:outline-none focus:border-[#F97316]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                البريد الإلكتروني {!needsSetup ? '(اختياري عند الدخول برمز الإدارة)' : ''}
              </label>
              <input
                type="email"
                dir="ltr"
                required={needsSetup}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@espana-career.example"
                className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-white/10 text-sm text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                {needsSetup ? 'كلمة المرور (8 أحرف على الأقل)' : 'كلمة المرور أو رمز الإدارة'}
              </label>
              <input
                type="password"
                dir="ltr"
                required
                minLength={needsSetup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-white/10 text-sm text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>

            {authError && <p className="text-xs text-red-400 font-medium">{authError}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-[#F97316] text-black font-bold text-sm hover:bg-[#fb8532] transition-colors disabled:opacity-50"
            >
              {authLoading ? 'جاري التحقق...' : needsSetup ? 'حفظ والدخول للوحة الإدارة' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: `المسجلون في الموقع (${overview?.metrics?.totalCandidates ?? registeredUsers.length})`, icon: <Users className="w-4 h-4" /> },
    { id: 'applications', label: 'طلبات التقديم', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'access-codes', label: 'رموز الدخول', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'documents', label: 'الوثائق المحمية', icon: <FileText className="w-4 h-4" /> },
    { id: 'cities', label: 'المدن والخريطة', icon: <MapPin className="w-4 h-4" /> },
    { id: 'companies', label: 'الشركات', icon: <Building2 className="w-4 h-4" /> },
    { id: 'jobs', label: 'عروض العمل', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'conditions', label: 'شروط التقديم', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'sliders', label: 'سلايدر الصور', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'testimonials', label: 'تجارب العملاء', icon: <MessageSquareQuote className="w-4 h-4" /> },
    { id: 'statistics', label: 'الإحصائيات', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'settings', label: 'الهوية والأقسام', icon: <Palette className="w-4 h-4" /> },
    { id: 'messages', label: 'رسائل التواصل', icon: <Mail className="w-4 h-4" /> },
    { id: 'audit', label: 'سجل التدقيق', icon: <Activity className="w-4 h-4" /> },
  ];

  const moveHomeSection = (idx: number, dir: -1 | 1) => {
    if (!settings?.homeSections) return;
    const list = [...settings.homeSections].sort((a, b) => a.order - b.order);
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    const reordered = list.map((item, i) => ({ ...item, order: i + 1 }));
    setSettings({ ...settings, homeSections: reordered });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col lg:flex-row" dir="rtl">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-e border-white/10 bg-[#111111] flex flex-col justify-between">
        <div>
          <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">لوحة الإدارة</h2>
              <p className="text-xs text-neutral-400 truncate max-w-[170px]">{adminUser?.email}</p>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[#242424] hover:bg-white/10 text-neutral-200"
            >
              الموقع
            </button>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === item.id
                    ? 'bg-[#F97316] text-black'
                    : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 hidden lg:block">
          <button
            type="button"
            onClick={() => {
              setToken(null);
              setAdminUser(null);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D1D1D] hover:bg-red-500/20 text-neutral-300 hover:text-red-300 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <h1 className="text-2xl font-bold text-white">
            {navItems.find((n) => n.id === tab)?.label}
          </h1>
          <div className="flex items-center gap-3">
            {bannerMsg && (
              <span className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {bannerMsg}
              </span>
            )}
            {errorMsg && <span className="text-xs font-semibold text-red-400">{errorMsg}</span>}
          </div>
        </div>

        {/* 1. OVERVIEW */}
        {tab === 'overview' && overview && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'إجمالي الطلبات', val: overview.metrics.totalApplications, target: 'applications' as AdminTab },
                { label: 'طلبات جديدة', val: overview.metrics.newApplications, target: 'applications' as AdminTab },
                { label: 'الطلبات المعالجة', val: overview.metrics.processedApplications, target: 'applications' as AdminTab },
                { label: 'المسجلون المحفوظون', val: overview.metrics.totalCandidates, target: 'users' as AdminTab },
                { label: 'عروض العمل النشطة', val: overview.metrics.activeJobs, target: 'jobs' as AdminTab },
                { label: 'المدن المفعلة', val: overview.metrics.totalCities, target: 'cities' as AdminTab },
                { label: 'الملفات المرفوعة', val: overview.metrics.totalDocuments, target: 'documents' as AdminTab },
                { label: 'رسائل غير مقروءة', val: overview.metrics.unreadMessages, target: 'messages' as AdminTab },
              ].map((kpi) => (
                <button
                  key={kpi.label}
                  type="button"
                  onClick={() => setTab(kpi.target)}
                  className="p-5 rounded-2xl border border-white/10 bg-[#141414] text-start hover:border-[#F97316]/60 transition-colors"
                >
                  <p className="text-xs text-neutral-400">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white mt-2 tabular-nums font-display">
                    {kpi.val ?? 0}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-white/10 bg-[#141414] space-y-4">
                <h3 className="text-base font-bold text-white">أحدث الطلبات المستلمة</h3>
                <div className="divide-y divide-white/10">
                  {overview.recentApplications.length === 0 ? (
                    <p className="text-xs text-neutral-400 py-4">لا توجد طلبات مسجلة بعد.</p>
                  ) : (
                    overview.recentApplications.map((a) => (
                      <div key={a.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-white">{a.full_name}</p>
                          <p className="text-neutral-400 mt-0.5">
                            {a.company_name_es} · {a.city_name_ar}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="font-mono-tabular text-[#F97316]">{a.reference_code}</p>
                          <p className="text-neutral-400 mt-0.5">{APP_STATUS_LABELS[a.status] || a.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-white/10 bg-[#141414] space-y-4">
                <h3 className="text-base font-bold text-white">آخر العمليات الإدارية</h3>
                <div className="divide-y divide-white/10">
                  {overview.recentAuditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-neutral-200">{log.action}</p>
                        <p className="text-neutral-400">{log.admin_email} · {log.target_type}</p>
                      </div>
                      <span className="font-mono-tabular text-neutral-500">{log.created_at.slice(0, 16)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1.5. REGISTERED USERS / CANDIDATES */}
        {tab === 'users' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'إجمالي المسجلين المحفوظين', val: registeredUsers.length },
                { label: 'عبر طلبات العمل', val: registeredUsers.filter((u) => u.source === 'application').length },
                { label: 'تسجيل مباشر بالموقع', val: registeredUsers.filter((u) => u.source === 'registration').length },
                { label: 'عبر نموذج التواصل', val: registeredUsers.filter((u) => u.source === 'contact').length },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-2xl border border-white/10 bg-[#141414]">
                  <p className="text-xs text-neutral-400">{stat.label}</p>
                  <p className="text-xl font-bold text-white mt-1.5 tabular-nums font-display">{stat.val}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  type="text"
                  placeholder="بحث بالاسم، رقم WhatsApp، البريد، المدينة، أو التخصص..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-xs text-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <select
                value={userSourceFilter}
                onChange={(e) => setUserSourceFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-xs text-white"
              >
                <option value="">كل مصادر التسجيل</option>
                <option value="application">تقديم على عرض عمل</option>
                <option value="registration">تسجيل مباشر بالموقع</option>
                <option value="contact">رسالة تواصل</option>
              </select>

              <button
                type="button"
                onClick={exportRegisteredUsersCsv}
                className="px-4 py-2.5 rounded-xl bg-[#F97316] text-black text-xs font-bold hover:bg-[#fb8532] inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>تصدير القائمة (CSV)</span>
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5 text-start">الاسم الكامل</th>
                    <th className="p-3.5 text-start">WhatsApp</th>
                    <th className="p-3.5 text-start">البريد الإلكتروني</th>
                    <th className="p-3.5 text-start">المدينة / التخصص</th>
                    <th className="p-3.5 text-start">المصدر والطلبات</th>
                    <th className="p-3.5 text-start">تاريخ التسجيل</th>
                    <th className="p-3.5 text-start">ملاحظات الإدارة</th>
                    <th className="p-3.5 text-start">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {registeredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-400">
                        لا يوجد مسجلون مطابقون للبحث حالياً
                      </td>
                    </tr>
                  ) : (
                    registeredUsers.map((u) => {
                      const noteValue = editingUserNotes[u.id] ?? u.notes ?? '';
                      return (
                        <tr key={u.id} className="hover:bg-white/5 align-top">
                          <td className="p-3.5 font-bold text-white whitespace-nowrap">
                            {u.full_name}
                            {u.experience_years && (
                              <div className="text-[11px] font-normal text-neutral-400 mt-0.5">
                                الخبرة: {u.experience_years}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono-tabular text-[#F97316] whitespace-nowrap" dir="ltr">
                            {u.whatsapp || '—'}
                          </td>
                          <td className="p-3.5 text-neutral-300" dir="ltr">
                            <div>{u.email || '—'}</div>
                            {u.registration_code_label && (
                              <div className="text-[11px] text-emerald-400 mt-0.5" dir="rtl">
                                {u.registration_code_label}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="text-white">{u.city_preference || 'غير محددة'}</div>
                            <div className="text-neutral-400">{u.sector_preference || '—'}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="text-neutral-200 font-semibold">
                              {u.source === 'application'
                                ? 'طلب عمل'
                                : u.source === 'registration'
                                ? 'تسجيل مباشر'
                                : 'تواصل'}
                            </div>
                            <div className="text-neutral-400 tabular-nums mt-0.5">
                              الطلبات: {u.applications_count ?? 0}
                              {u.latest_reference_code ? ` (${u.latest_reference_code})` : ''}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono-tabular text-neutral-400 whitespace-nowrap">
                            {(u.created_at || '').slice(0, 16)}
                          </td>
                          <td className="p-3.5 min-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="أضف ملاحظة..."
                                value={noteValue}
                                onChange={(e) =>
                                  setEditingUserNotes((prev) => ({ ...prev, [u.id]: e.target.value }))
                                }
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#1F1F1F] border border-white/10 text-white text-xs"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/admin/users/${u.id}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ notes: noteValue }),
                                  });
                                  notify('تم حفظ ملاحظة المسجل');
                                  loadRegisteredUsers();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#F97316] hover:text-black text-white font-semibold"
                              >
                                حفظ
                              </button>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                                notify('تم حذف السجل من قائمة المسجلين');
                                loadRegisteredUsers();
                                loadAllAdminData();
                              }}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. APPLICATIONS */}
        {tab === 'applications' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  type="text"
                  placeholder="بحث بالاسم، WhatsApp، أو رقم المرجع..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-xs text-white focus:outline-none focus:border-[#F97316]"
                />
              </div>
              <select
                value={appCityFilter}
                onChange={(e) => setAppCityFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-xs text-white"
              >
                <option value="">كل المدن</option>
                {cities.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name_ar}</option>
                ))}
              </select>
              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-xs text-white"
              >
                <option value="">كل الحالات</option>
                {Object.entries(APP_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5 text-start">المرجع</th>
                    <th className="p-3.5 text-start">المرشح</th>
                    <th className="p-3.5 text-start">WhatsApp</th>
                    <th className="p-3.5 text-start">الشركة والمدينة</th>
                    <th className="p-3.5 text-start">الخبرة</th>
                    <th className="p-3.5 text-start">الوثائق</th>
                    <th className="p-3.5 text-start">الحالة</th>
                    <th className="p-3.5 text-start">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-400">لا توجد طلبات مطابقة للبحث</td>
                    </tr>
                  ) : (
                    applications.map((a) => (
                      <tr key={a.id} className="hover:bg-white/5">
                        <td className="p-3.5 font-mono-tabular text-[#F97316]">{a.reference_code}</td>
                        <td className="p-3.5 font-bold text-white">{a.full_name}</td>
                        <td className="p-3.5 font-mono-tabular text-neutral-200" dir="ltr">{a.whatsapp}</td>
                        <td className="p-3.5">
                          <div className="text-white">{a.company_name_es}</div>
                          <div className="text-neutral-400">{a.city_name_ar} · {a.job_title_ar}</div>
                        </td>
                        <td className="p-3.5">{a.has_sector_experience ? 'نعم' : 'لا'}</td>
                        <td className="p-3.5">
                          {a.documents && a.documents.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {a.documents.map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => downloadProtectedDocument(d)}
                                  className="inline-flex items-center gap-1 text-[#F97316] hover:underline text-start"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>{d.doc_type.toUpperCase()}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-neutral-500">بدون وثائق</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <select
                            value={a.status}
                            onChange={async (e) => {
                              await apiFetch(`/api/admin/applications/${a.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: e.target.value }),
                              });
                              notify('تم تحديث حالة الطلب');
                              loadApplications();
                              loadAllAdminData();
                              onSiteDataChanged();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#1F1F1F] border border-white/10 text-white"
                          >
                            {Object.entries(APP_STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/applications/${a.id}`, { method: 'DELETE' });
                              notify('تم حذف الطلب');
                              loadApplications();
                              loadAllAdminData();
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. ACCESS CODES */}
        {tab === 'access-codes' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await apiFetch('/api/admin/access-codes', {
                  method: 'POST',
                  body: JSON.stringify({
                    code: newCode.code || undefined,
                    job_offer_id: newCode.job_offer_id ? Number(newCode.job_offer_id) : null,
                    max_uses: Number(newCode.max_uses),
                    expires_at: newCode.expires_at || null,
                  }),
                });
                const d = await res.json();
                if (!res.ok) notifyErr(d.error || 'خطأ في إنشاء الرمز');
                else {
                  setNewCode({ code: '', job_offer_id: '', max_uses: 3, expires_at: '' });
                  notify(`تم إنشاء الرمز: ${d.code}`);
                  loadAllAdminData();
                }
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">الرمز (يُولد تلقائياً إذا تُرك فارغاً)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="ESP-TEXTIL-01"
                  value={newCode.code}
                  onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs font-mono-tabular uppercase text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">عرض العمل المرتبط</label>
                <select
                  value={newCode.job_offer_id}
                  onChange={(e) => setNewCode({ ...newCode, job_offer_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white"
                >
                  <option value="">عام (جميع العروض)</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={String(j.id)}>{j.title_ar} — {j.company_name_es}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">الحد الأقصى للاستخدام</label>
                <input
                  type="number"
                  min={1}
                  value={newCode.max_uses}
                  onChange={(e) => setNewCode({ ...newCode, max_uses: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs tabular-nums text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">تاريخ الانتهاء</label>
                <input
                  type="date"
                  value={newCode.expires_at}
                  onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#F97316] text-black text-xs font-bold hover:bg-[#fb8532] inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء رمز</span>
              </button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5 text-start">الرمز</th>
                    <th className="p-3.5 text-start">العرض المرتبط</th>
                    <th className="p-3.5 text-start">الاستخدام</th>
                    <th className="p-3.5 text-start">الانتهاء</th>
                    <th className="p-3.5 text-start">آخر استخدام</th>
                    <th className="p-3.5 text-start">الحالة</th>
                    <th className="p-3.5 text-start">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {accessCodes.map((ac) => (
                    <tr key={ac.id}>
                      <td className="p-3.5 font-mono-tabular font-bold text-[#F97316]">{ac.code}</td>
                      <td className="p-3.5">{ac.job_title_ar || 'عام (جميع العروض)'}</td>
                      <td className="p-3.5 tabular-nums">{ac.used_count} / {ac.max_uses}</td>
                      <td className="p-3.5 font-mono-tabular">{ac.expires_at || 'غير محدد'}</td>
                      <td className="p-3.5 font-mono-tabular text-neutral-400">{ac.last_used_at || '—'}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/access-codes/${ac.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ is_active: ac.is_active ? 0 : 1, expires_at: ac.expires_at }),
                            });
                            notify(ac.is_active ? 'تم إيقاف الرمز' : 'تم تفعيل الرمز');
                            loadAllAdminData();
                          }}
                          className={`px-2.5 py-1 rounded-lg font-semibold ${
                            ac.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {ac.is_active ? 'مفعل' : 'ملغى'}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/access-codes/${ac.id}`, { method: 'DELETE' });
                            notify('تم حذف الرمز');
                            loadAllAdminData();
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. DOCUMENTS */}
        {tab === 'documents' && (
          <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                <tr>
                  <th className="p-3.5 text-start">المرشح</th>
                  <th className="p-3.5 text-start">مرجع الطلب</th>
                  <th className="p-3.5 text-start">نوع الوثيقة</th>
                  <th className="p-3.5 text-start">اسم الملف</th>
                  <th className="p-3.5 text-start">الحجم</th>
                  <th className="p-3.5 text-start">تاريخ الرفع</th>
                  <th className="p-3.5 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-400">لا توجد وثائق مرفوعة بعد</td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="p-3.5 font-bold text-white">{doc.candidate_name}</td>
                      <td className="p-3.5 font-mono-tabular text-[#F97316]">{doc.reference_code}</td>
                      <td className="p-3.5 uppercase">{doc.doc_type}</td>
                      <td className="p-3.5">{doc.original_name}</td>
                      <td className="p-3.5 tabular-nums">{Math.round(doc.size_bytes / 1024)} KB</td>
                      <td className="p-3.5 font-mono-tabular text-neutral-400">{doc.uploaded_at}</td>
                      <td className="p-3.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadProtectedDocument(doc)}
                          className="px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[#F97316] hover:text-black text-white inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تنزيل</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/documents/${doc.id}`, { method: 'DELETE' });
                            notify('تم حذف الوثيقة');
                            loadAllAdminData();
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. CITIES */}
        {tab === 'cities' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await apiFetch('/api/admin/cities', {
                  method: 'POST',
                  body: JSON.stringify(newCity),
                });
                if (!res.ok) notifyErr('تعذر إضافة المدينة');
                else {
                  setNewCity({ name_ar: '', name_es: '', name_fr: '', slug: '', map_x: 50, map_y: 50, dot_color: 'orange', description_ar: '', image_url: '' });
                  notify('تمت إضافة المدينة');
                  loadAllAdminData();
                  onSiteDataChanged();
                }
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <input type="text" required placeholder="الاسم بالعربية" value={newCity.name_ar} onChange={(e) => setNewCity({ ...newCity, name_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" required placeholder="Nombre (ES)" value={newCity.name_es} onChange={(e) => setNewCity({ ...newCity, name_es: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="number" step="0.5" placeholder="Map X (0-100)" value={newCity.map_x} onChange={(e) => setNewCity({ ...newCity, map_x: Number(e.target.value) })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="number" step="0.5" placeholder="Map Y (0-100)" value={newCity.map_y} onChange={(e) => setNewCity({ ...newCity, map_y: Number(e.target.value) })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <select value={newCity.dot_color} onChange={(e) => setNewCity({ ...newCity, dot_color: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white">
                <option value="orange">نقطة برتقالية</option>
                <option value="red">نقطة حمراء (خاص/جديد)</option>
              </select>
              <input type="text" placeholder="وصف قصير بالعربية" value={newCity.description_ar} onChange={(e) => setNewCity({ ...newCity, description_ar: e.target.value })} className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#F97316] text-black text-xs font-bold">إضافة مدينة</button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5 text-start">المدينة</th>
                    <th className="p-3.5 text-start">الإحداثيات (X, Y)</th>
                    <th className="p-3.5 text-start">لون النقطة</th>
                    <th className="p-3.5 text-start">الصورة</th>
                    <th className="p-3.5 text-start">الحالة</th>
                    <th className="p-3.5 text-start">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {cities.map((c) => (
                    <tr key={c.id}>
                      <td className="p-3.5 font-bold text-white">{c.name_ar} · {c.name_es}</td>
                      <td className="p-3.5 font-mono-tabular">{c.map_x}, {c.map_y}</td>
                      <td className="p-3.5">
                        <select
                          value={c.dot_color}
                          onChange={async (e) => {
                            await apiFetch(`/api/admin/cities/${c.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ dot_color: e.target.value }),
                            });
                            notify('تم تحديث لون المدينة');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className="px-2 py-1 rounded-lg bg-[#1F1F1F] border border-white/10 text-white"
                        >
                          <option value="orange">برتقالي</option>
                          <option value="red">أحمر</option>
                        </select>
                      </td>
                      <td className="p-3.5">
                        <label className="text-[#F97316] cursor-pointer hover:underline">
                          تغيير الصورة
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={async (e) => {
                              const url = await uploadAdminAsset(e.target.files?.[0] || null);
                              if (url) {
                                await apiFetch(`/api/admin/cities/${c.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ image_url: url }),
                                });
                                notify('تم تحديث صورة المدينة');
                                loadAllAdminData();
                                onSiteDataChanged();
                              }
                            }}
                          />
                        </label>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/cities/${c.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ is_active: c.is_active ? 0 : 1 }),
                            });
                            notify('تم تحديث حالة المدينة');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className={`px-2.5 py-1 rounded-lg ${c.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-700 text-neutral-300'}`}
                        >
                          {c.is_active ? 'مفعلة' : 'متوقفة'}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/cities/${c.id}`, { method: 'DELETE' });
                            notify('تم حذف المدينة');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. COMPANIES */}
        {tab === 'companies' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await apiFetch('/api/admin/companies', {
                  method: 'POST',
                  body: JSON.stringify({ ...newCompany, city_id: Number(newCompany.city_id) }),
                });
                if (!res.ok) notifyErr('يرجى ملء كافة حقول الشركة');
                else {
                  setNewCompany({ city_id: '', name_es: '', sector_ar: 'الخياطة وصناعة الملابس', sector_es: 'Confección y Textil', sector_fr: 'Confection et Textile', phone: '', operator_info_ar: '' });
                  notify('تمت إضافة الشركة');
                  loadAllAdminData();
                  onSiteDataChanged();
                }
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <select required value={newCompany.city_id} onChange={(e) => setNewCompany({ ...newCompany, city_id: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white">
                <option value="">اختر المدينة...</option>
                {cities.map((c) => <option key={c.id} value={String(c.id)}>{c.name_ar}</option>)}
              </select>
              <input type="text" required placeholder="اسم الشركة بالإسبانية (S.L.)" value={newCompany.name_es} onChange={(e) => setNewCompany({ ...newCompany, name_es: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" required placeholder="الهاتف الكامل (يظهر مخفياً للزوار)" dir="ltr" value={newCompany.phone} onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs font-mono-tabular text-white" />
              <input type="text" required placeholder="المجال بالعربية" value={newCompany.sector_ar} onChange={(e) => setNewCompany({ ...newCompany, sector_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" placeholder="معلومات المشغل" value={newCompany.operator_info_ar} onChange={(e) => setNewCompany({ ...newCompany, operator_info_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#F97316] text-black text-xs font-bold">إضافة شركة</button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5 text-start">الشركة (ES)</th>
                    <th className="p-3.5 text-start">المدينة</th>
                    <th className="p-3.5 text-start">المجال</th>
                    <th className="p-3.5 text-start">الهاتف الكامل (إدارة)</th>
                    <th className="p-3.5 text-start">الحالة</th>
                    <th className="p-3.5 text-start">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {companies.map((co) => (
                    <tr key={co.id}>
                      <td className="p-3.5 font-bold text-white" dir="ltr">{co.name_es}</td>
                      <td className="p-3.5">{co.city_name_ar}</td>
                      <td className="p-3.5">{co.sector_ar}</td>
                      <td className="p-3.5 font-mono-tabular text-[#F97316]" dir="ltr">{co.phone}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/companies/${co.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ is_active: co.is_active ? 0 : 1 }),
                            });
                            notify('تم تحديث حالة الشركة');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className={`px-2.5 py-1 rounded-lg ${co.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-700 text-neutral-300'}`}
                        >
                          {co.is_active ? 'نشطة' : 'متوقفة'}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/companies/${co.id}`, { method: 'DELETE' });
                            notify('تم حذف الشركة');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. JOB OFFERS */}
        {tab === 'jobs' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await apiFetch('/api/admin/jobs', {
                  method: 'POST',
                  body: JSON.stringify({ ...newJob, company_id: Number(newJob.company_id), positions_count: Number(newJob.positions_count) }),
                });
                if (!res.ok) notifyErr('يرجى تحديد الشركة وعنوان العرض');
                else {
                  setNewJob({ ...newJob, title_ar: '', title_es: '', description_ar: '' });
                  notify('تمت إضافة عرض العمل');
                  loadAllAdminData();
                  onSiteDataChanged();
                }
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <select required value={newJob.company_id} onChange={(e) => setNewJob({ ...newJob, company_id: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white">
                <option value="">اختر الشركة...</option>
                {companies.map((c) => <option key={c.id} value={String(c.id)}>{c.name_es} ({c.city_name_ar})</option>)}
              </select>
              <input type="text" required placeholder="عنوان الوظيفة بالعربية" value={newJob.title_ar} onChange={(e) => setNewJob({ ...newJob, title_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" placeholder="Título (ES)" value={newJob.title_es} onChange={(e) => setNewJob({ ...newJob, title_es: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" placeholder="المجال المهني" value={newJob.category_ar} onChange={(e) => setNewJob({ ...newJob, category_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="number" min={1} placeholder="عدد المناصب" value={newJob.positions_count} onChange={(e) => setNewJob({ ...newJob, positions_count: Number(e.target.value) })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" placeholder="وصف الوظيفة" value={newJob.description_ar} onChange={(e) => setNewJob({ ...newJob, description_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <button type="submit" className="sm:col-span-3 py-2.5 rounded-xl bg-[#F97316] text-black text-xs font-bold">نشر عرض العمل</button>
            </form>

            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                  <tr>
                    <th className="p-3.5 text-start">الوظيفة</th>
                    <th className="p-3.5 text-start">الشركة والمدينة</th>
                    <th className="p-3.5 text-start">المناصب</th>
                    <th className="p-3.5 text-start">الحالة</th>
                    <th className="p-3.5 text-start">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td className="p-3.5 font-bold text-white">{j.title_ar}</td>
                      <td className="p-3.5">{j.company_name_es} · {j.city_name_ar}</td>
                      <td className="p-3.5 tabular-nums">{j.positions_count}</td>
                      <td className="p-3.5">
                        <select
                          value={j.status}
                          onChange={async (e) => {
                            await apiFetch(`/api/admin/jobs/${j.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ status: e.target.value }),
                            });
                            notify('تم تحديث حالة العرض');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#1F1F1F] border border-white/10 text-white"
                        >
                          {Object.entries(JOB_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/jobs/${j.id}`, { method: 'DELETE' });
                            notify('تم حذف العرض');
                            loadAllAdminData();
                            onSiteDataChanged();
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. CONDITIONS */}
        {tab === 'conditions' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/admin/conditions', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...newCondition,
                    job_offer_id: newCondition.job_offer_id ? Number(newCondition.job_offer_id) : null,
                  }),
                });
                setNewCondition({ text_ar: '', text_es: '', text_fr: '', job_offer_id: '', display_order: 5 });
                notify('تمت إضافة الشرط');
                loadAllAdminData();
                onSiteDataChanged();
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input type="text" required placeholder="نص الشرط بالعربية" value={newCondition.text_ar} onChange={(e) => setNewCondition({ ...newCondition, text_ar: e.target.value })} className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <select value={newCondition.job_offer_id} onChange={(e) => setNewCondition({ ...newCondition, job_offer_id: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white">
                <option value="">شرط عام (الصفحة الرئيسية)</option>
                {jobs.map((j) => <option key={j.id} value={String(j.id)}>{j.title_ar}</option>)}
              </select>
              <button type="submit" className="sm:col-span-3 py-2 rounded-xl bg-[#F97316] text-black text-xs font-bold">إضافة شرط</button>
            </form>

            <div className="space-y-3">
              {conditions.map((cond) => (
                <div key={cond.id} className="p-4 rounded-xl border border-white/10 bg-[#141414] flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-white">{cond.text_ar}</p>
                    <p className="text-neutral-400 mt-1">{cond.job_title_ar ? `خاص بعرض: ${cond.job_title_ar}` : 'شرط عام في الصفحة الرئيسية'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/conditions/${cond.id}`, { method: 'DELETE' });
                      notify('تم حذف الشرط');
                      loadAllAdminData();
                      onSiteDataChanged();
                    }}
                    className="p-2 text-neutral-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. SLIDERS */}
        {tab === 'sliders' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/admin/sliders', { method: 'POST', body: JSON.stringify(newSlider) });
                setNewSlider({ title_ar: '', title_es: '', subtitle_ar: '', image_url: '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', display_order: 4 });
                notify('تمت إضافة شريحة السلايدر');
                loadAllAdminData();
                onSiteDataChanged();
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <input type="text" required placeholder="العنوان بالعربية" value={newSlider.title_ar} onChange={(e) => setNewSlider({ ...newSlider, title_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" placeholder="الوصف القصير" value={newSlider.subtitle_ar} onChange={(e) => setNewSlider({ ...newSlider, subtitle_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <label className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-[#F97316] cursor-pointer text-center">
                رفع صورة جديدة
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const url = await uploadAdminAsset(e.target.files?.[0] || null);
                    if (url) setNewSlider({ ...newSlider, image_url: url });
                  }}
                />
              </label>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#F97316] text-black text-xs font-bold">إضافة للسلايدر</button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sliders.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-[#141414] overflow-hidden">
                  <img src={s.image_url} alt={s.title_ar} referrerPolicy="no-referrer" className="w-full h-36 object-cover" />
                  <div className="p-4 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-white">{s.title_ar}</p>
                      <p className="text-neutral-400">ترتيب: {s.display_order}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/sliders/${s.id}`, { method: 'DELETE' });
                        notify('تم حذف الشريحة');
                        loadAllAdminData();
                        onSiteDataChanged();
                      }}
                      className="p-2 text-neutral-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10. TESTIMONIALS */}
        {tab === 'testimonials' && (
          <div className="space-y-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/admin/testimonials', { method: 'POST', body: JSON.stringify(newTestimonial) });
                setNewTestimonial({ client_name: '', city_or_service_ar: '', quote_ar: '', avatar_url: '/src/assets/images/testimonial_portrait_1_1795347962944.jpg' });
                notify('تمت إضافة تجربة العميل');
                loadAllAdminData();
                onSiteDataChanged();
              }}
              className="p-5 rounded-2xl border border-white/10 bg-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input type="text" required placeholder="اسم العميل" value={newTestimonial.client_name} onChange={(e) => setNewTestimonial({ ...newTestimonial, client_name: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <input type="text" placeholder="المدينة أو نوع الخدمة" value={newTestimonial.city_or_service_ar} onChange={(e) => setNewTestimonial({ ...newTestimonial, city_or_service_ar: e.target.value })} className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <label className="px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-[#F97316] cursor-pointer text-center">
                رفع صورة العميل
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const url = await uploadAdminAsset(e.target.files?.[0] || null);
                    if (url) setNewTestimonial({ ...newTestimonial, avatar_url: url });
                  }}
                />
              </label>
              <input type="text" required placeholder="نص التجربة" value={newTestimonial.quote_ar} onChange={(e) => setNewTestimonial({ ...newTestimonial, quote_ar: e.target.value })} className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-xs text-white" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#F97316] text-black text-xs font-bold">إضافة تجربة</button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testimonials.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl border border-white/10 bg-[#141414] flex items-start justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3">
                    <img src={item.avatar_url} alt={item.client_name} referrerPolicy="no-referrer" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    <div>
                      <p className="font-bold text-white">{item.client_name}</p>
                      <p className="text-[#F97316]">{item.city_or_service_ar}</p>
                      <p className="text-neutral-300 mt-1.5 leading-relaxed">{item.quote_ar}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/testimonials/${item.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ is_approved: item.is_approved ? 0 : 1 }),
                        });
                        notify('تم تحديث النشر');
                        loadAllAdminData();
                        onSiteDataChanged();
                      }}
                      className={`px-2 py-1 rounded-lg ${item.is_approved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-700 text-neutral-300'}`}
                    >
                      {item.is_approved ? 'منشور' : 'مخفي'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/testimonials/${item.id}`, { method: 'DELETE' });
                        notify('تم الحذف');
                        loadAllAdminData();
                        onSiteDataChanged();
                      }}
                      className="p-1.5 text-neutral-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 11. STATISTICS */}
        {tab === 'statistics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statistics.map((st) => (
              <div key={st.id} className="p-5 rounded-2xl border border-white/10 bg-[#141414] space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-white">{st.label_ar}</span>
                  <span className="font-mono-tabular text-[#F97316]">DB: {st.computed_value}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-400 mb-1">القيمة اليدوية</label>
                    <input
                      type="number"
                      defaultValue={st.manual_value}
                      onBlur={async (e) => {
                        await apiFetch(`/api/admin/statistics/${st.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ manual_value: Number(e.target.value) }),
                        });
                        notify('تم حفظ الإحصائية');
                        loadAllAdminData();
                        onSiteDataChanged();
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">مصدر الرقم</label>
                    <select
                      value={st.use_dynamic ? '1' : '0'}
                      onChange={async (e) => {
                        await apiFetch(`/api/admin/statistics/${st.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ use_dynamic: e.target.value === '1' }),
                        });
                        notify('تم تحديث مصدر الإحصائية');
                        loadAllAdminData();
                        onSiteDataChanged();
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white"
                    >
                      <option value="1">مرتبط بقاعدة البيانات</option>
                      <option value="0">تحكم يدوي فقط</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 12. SETTINGS & HOME SECTION BUILDER */}
        {tab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#141414] space-y-4 text-xs">
              <h3 className="text-base font-bold text-white">الهوية البصرية والشعار</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1.5">اسم الوكالة (عربي)</label>
                  <input type="text" value={settings.brandNameAr} onChange={(e) => setSettings({ ...settings, brandNameAr: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1.5">اسم الوكالة (إسباني/فرنسي)</label>
                  <input type="text" value={settings.brandNameEs} onChange={(e) => setSettings({ ...settings, brandNameEs: e.target.value, brandNameFr: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1.5">لون التمييز (Accent)</label>
                  <input type="color" value={settings.accentColor} onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })} className="w-full h-9 rounded-xl bg-[#1B1B1B] border border-white/10 cursor-pointer" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="px-4 py-2 rounded-xl bg-[#242424] hover:bg-white/10 text-white cursor-pointer">
                  رفع شعار جديد
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const url = await uploadAdminAsset(e.target.files?.[0] || null);
                      if (url) setSettings({ ...settings, logoUrl: url });
                    }}
                  />
                </label>
                {settings.logoUrl && (
                  <button type="button" onClick={() => setSettings({ ...settings, logoUrl: '' })} className="text-red-400 hover:underline">
                    إزالة الشعار والعودة للنص
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#141414] space-y-4 text-xs">
              <h3 className="text-base font-bold text-white">محتوى الصفحة الرئيسية والتواصل</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1.5">عنوان Hero (عربي)</label>
                  <input type="text" value={settings.heroTitleAr} onChange={(e) => setSettings({ ...settings, heroTitleAr: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1.5">الوصف الفرعي Hero (عربي)</label>
                  <input type="text" value={settings.heroSubtitleAr} onChange={(e) => setSettings({ ...settings, heroSubtitleAr: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-neutral-400 mb-1.5">نص من نحن (عربي)</label>
                  <textarea rows={3} value={settings.aboutTextAr} onChange={(e) => setSettings({ ...settings, aboutTextAr: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1.5">WhatsApp الرسمي</label>
                  <input type="text" dir="ltr" value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1.5">البريد الإلكتروني</label>
                  <input type="email" dir="ltr" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#1B1B1B] border border-white/10 text-white" />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#141414] space-y-3 text-xs">
              <h3 className="text-base font-bold text-white">ترتيب وإظهار أقسام الصفحة الرئيسية</h3>
              {[...(settings.homeSections || [])]
                .sort((a, b) => a.order - b.order)
                .map((sec, idx) => (
                  <div key={sec.id} className="p-3 rounded-xl bg-[#1B1B1B] border border-white/10 flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{sec.labelAr}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveHomeSection(idx, -1)} className="p-1.5 rounded-lg bg-[#242424] hover:bg-white/10"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moveHomeSection(idx, 1)} className="p-1.5 rounded-lg bg-[#242424] hover:bg-white/10"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = settings.homeSections.map((s) =>
                            s.id === sec.id ? { ...s, visible: !s.visible } : s
                          );
                          setSettings({ ...settings, homeSections: updated });
                        }}
                        className={`px-3 py-1 rounded-lg font-semibold ${sec.visible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-700 text-neutral-300'}`}
                      >
                        {sec.visible ? 'ظاهر' : 'مخفي'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <button
              type="button"
              onClick={async () => {
                await apiFetch('/api/admin/settings', {
                  method: 'PUT',
                  body: JSON.stringify(settings),
                });
                notify('تم حفظ إعدادات الموقع والأقسام');
                onSiteDataChanged();
              }}
              className="px-6 py-3 rounded-xl bg-[#F97316] text-black text-sm font-bold hover:bg-[#fb8532]"
            >
              حفظ كافة التعديلات
            </button>
          </div>
        )}

        {/* 13. CONTACT MESSAGES */}
        {tab === 'messages' && (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-neutral-400 py-10 text-center border border-white/10 rounded-2xl bg-[#141414]">
                لا توجد رسائل واردة بعد
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="p-5 rounded-2xl border border-white/10 bg-[#141414] flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{m.full_name}</span>
                      <span className="text-neutral-400">· {m.email}</span>
                      {m.whatsapp && <span className="font-mono-tabular text-[#F97316]" dir="ltr">{m.whatsapp}</span>}
                    </div>
                    {m.subject && <p className="font-semibold text-neutral-200">{m.subject}</p>}
                    <p className="text-neutral-300 leading-relaxed">{m.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.status}
                      onChange={async (e) => {
                        await apiFetch(`/api/admin/contact-messages/${m.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ status: e.target.value }),
                        });
                        notify('تم تحديث حالة الرسالة');
                        loadAllAdminData();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#1F1F1F] border border-white/10 text-white"
                    >
                      <option value="new">جديدة</option>
                      <option value="read">مقروءة</option>
                      <option value="resolved">تمت المعالجة</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 14. AUDIT LOGS */}
        {tab === 'audit' && (
          <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#1A1A1A] text-neutral-400 border-b border-white/10">
                <tr>
                  <th className="p-3.5 text-start">الوقت</th>
                  <th className="p-3.5 text-start">المسؤول</th>
                  <th className="p-3.5 text-start">العملية</th>
                  <th className="p-3.5 text-start">الهدف</th>
                  <th className="p-3.5 text-start">التفاصيل</th>
                  <th className="p-3.5 text-start">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-3.5 font-mono-tabular text-neutral-400">{log.created_at}</td>
                    <td className="p-3.5">{log.admin_email}</td>
                    <td className="p-3.5 font-semibold text-[#F97316]">{log.action}</td>
                    <td className="p-3.5">{log.target_type} #{log.target_id}</td>
                    <td className="p-3.5 text-neutral-300">{log.details || '—'}</td>
                    <td className="p-3.5 font-mono-tabular text-neutral-400">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

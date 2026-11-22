export type Language = 'ar' | 'es' | 'fr';

export interface City {
  id: number;
  slug: string;
  name_ar: string;
  name_es: string;
  name_fr: string;
  description_ar: string;
  description_es: string;
  description_fr: string;
  image_url: string;
  map_x: number;
  map_y: number;
  dot_color: 'orange' | 'red';
  is_active: number;
  display_order: number;
  active_jobs_count?: number;
  companies_count?: number;
}

export interface Company {
  id: number;
  city_id: number;
  name_es: string;
  sector_ar: string;
  sector_es: string;
  sector_fr: string;
  masked_phone?: string;
  phone?: string;
  operator_info_ar: string;
  operator_info_es: string;
  operator_info_fr: string;
  is_active: number;
  city_name_ar?: string;
  city_name_es?: string;
  city_name_fr?: string;
  city_slug?: string;
  jobs_count?: number;
}

export interface JobOffer {
  id: number;
  company_id: number;
  city_id: number;
  title_ar: string;
  title_es: string;
  title_fr: string;
  category_ar: string;
  category_es: string;
  category_fr: string;
  description_ar: string;
  description_es: string;
  description_fr: string;
  contract_type_ar: string;
  contract_type_es: string;
  contract_type_fr: string;
  positions_count: number;
  application_question_ar: string;
  application_question_es: string;
  application_question_fr: string;
  experience_question_ar: string;
  experience_question_es: string;
  experience_question_fr: string;
  status: 'active' | 'paused' | 'expired' | 'review';
  published_at: string;
  expires_at: string | null;
  company_name_es?: string;
  masked_phone?: string;
  operator_info_ar?: string;
  operator_info_es?: string;
  operator_info_fr?: string;
  city_slug?: string;
  city_name_ar?: string;
  city_name_es?: string;
  city_name_fr?: string;
}

export interface ConditionItem {
  id: number;
  job_offer_id: number | null;
  job_title_ar?: string | null;
  text_ar: string;
  text_es: string;
  text_fr: string;
  display_order: number;
  is_active: number;
}

export interface SliderItem {
  id: number;
  title_ar: string;
  title_es: string;
  title_fr: string;
  subtitle_ar: string;
  subtitle_es: string;
  subtitle_fr: string;
  image_url: string;
  display_order: number;
  is_active: number;
}

export interface TestimonialItem {
  id: number;
  client_name: string;
  city_or_service_ar: string;
  city_or_service_es: string;
  city_or_service_fr: string;
  quote_ar: string;
  quote_es: string;
  quote_fr: string;
  avatar_url: string;
  is_approved: number;
  display_order: number;
}

export interface StatisticItem {
  id: number;
  key_name: string;
  label_ar: string;
  label_es: string;
  label_fr: string;
  manual_value: number;
  use_dynamic: number;
  value: number;
  computed_value?: number;
  display_order: number;
  is_active: number;
}

export interface NavLinkConfig {
  id: string;
  labelAr: string;
  labelEs: string;
  labelFr: string;
  target: string;
}

export interface HomeSectionConfig {
  id: 'map' | 'slider' | 'conditions' | 'statistics' | 'about' | 'testimonials' | 'contact';
  labelAr: string;
  visible: boolean;
  order: number;
}

export interface SiteSettings {
  brandNameAr: string;
  brandNameEs: string;
  brandNameFr: string;
  logoUrl: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  heroTitleAr: string;
  heroTitleEs: string;
  heroTitleFr: string;
  heroSubtitleAr: string;
  heroSubtitleEs: string;
  heroSubtitleFr: string;
  aboutTitleAr: string;
  aboutTitleEs: string;
  aboutTitleFr: string;
  aboutTextAr: string;
  aboutTextEs: string;
  aboutTextFr: string;
  aboutImageUrl: string;
  footerBioAr: string;
  footerBioEs: string;
  footerBioFr: string;
  whatsapp: string;
  email: string;
  socialLinks: {
    linkedin: string;
    instagram: string;
    facebook: string;
  };
  navLinks: NavLinkConfig[];
  homeSections: HomeSectionConfig[];
}

export interface BootstrapData {
  settings: SiteSettings;
  cities: City[];
  sliders: SliderItem[];
  conditions: ConditionItem[];
  testimonials: TestimonialItem[];
  statistics: StatisticItem[];
  tailorContractsCount?: number;
}

export interface DocumentMeta {
  id: number;
  application_id: number;
  doc_type: 'cv' | 'motivation' | 'certificate';
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  candidate_name?: string;
  reference_code?: string;
  whatsapp?: string;
}

export interface ApplicationRecord {
  id: number;
  reference_code: string;
  job_offer_id: number;
  company_id: number;
  city_id: number;
  full_name: string;
  whatsapp: string;
  has_sector_experience: number;
  access_code_id: number | null;
  access_code_used?: string | null;
  status: 'new' | 'reviewed' | 'contacted' | 'accepted' | 'rejected' | 'completed';
  notes: string;
  created_at: string;
  city_name_ar?: string;
  city_name_es?: string;
  company_name_es?: string;
  job_title_ar?: string;
  documents?: DocumentMeta[];
}

export interface AccessCodeRecord {
  id: number;
  code: string;
  job_offer_id: number | null;
  job_title_ar?: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: number;
  last_used_at: string | null;
  created_at: string;
  linked_applications_count?: number;
}

export interface ContactMessageRecord {
  id: number;
  full_name: string;
  email: string;
  whatsapp: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  created_at: string;
}

export interface AuditLogRecord {
  id: number;
  admin_id: number | null;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface RegisteredUserRecord {
  id: number;
  full_name: string;
  whatsapp: string;
  email: string;
  city_preference: string | null;
  sector_preference: string;
  experience_years: string;
  source: string;
  notes: string;
  registration_code_label?: string;
  has_code?: number;
  created_at: string;
  updated_at: string;
  applications_count?: number;
  latest_reference_code?: string | null;
}

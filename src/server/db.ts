import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const storageDir = path.resolve(process.cwd(), 'storage', 'documents');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'spain_agency.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/\s+/g, '');
  if (digits.length <= 3) return '••••••';
  return `${digits.slice(0, 3)}••••••`;
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'super_admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      city_preference TEXT,
      sector_preference TEXT NOT NULL DEFAULT '',
      experience_years TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'application',
      notes TEXT NOT NULL DEFAULT '',
      code_hash TEXT NOT NULL DEFAULT '',
      registration_code_label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      name_es TEXT NOT NULL,
      name_fr TEXT NOT NULL,
      description_ar TEXT NOT NULL DEFAULT '',
      description_es TEXT NOT NULL DEFAULT '',
      description_fr TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      map_x REAL NOT NULL,
      map_y REAL NOT NULL,
      dot_color TEXT NOT NULL DEFAULT 'orange',
      is_active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      name_es TEXT NOT NULL,
      sector_ar TEXT NOT NULL,
      sector_es TEXT NOT NULL,
      sector_fr TEXT NOT NULL,
      phone TEXT NOT NULL,
      operator_info_ar TEXT NOT NULL DEFAULT '',
      operator_info_es TEXT NOT NULL DEFAULT '',
      operator_info_fr TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      title_ar TEXT NOT NULL,
      title_es TEXT NOT NULL,
      title_fr TEXT NOT NULL,
      category_ar TEXT NOT NULL,
      category_es TEXT NOT NULL,
      category_fr TEXT NOT NULL,
      description_ar TEXT NOT NULL,
      description_es TEXT NOT NULL,
      description_fr TEXT NOT NULL,
      contract_type_ar TEXT NOT NULL,
      contract_type_es TEXT NOT NULL,
      contract_type_fr TEXT NOT NULL,
      positions_count INTEGER NOT NULL DEFAULT 1,
      application_question_ar TEXT NOT NULL,
      application_question_es TEXT NOT NULL,
      application_question_fr TEXT NOT NULL,
      experience_question_ar TEXT NOT NULL,
      experience_question_es TEXT NOT NULL,
      experience_question_fr TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_offer_id INTEGER REFERENCES job_offers(id) ON DELETE CASCADE,
      text_ar TEXT NOT NULL,
      text_es TEXT NOT NULL,
      text_fr TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS access_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      job_offer_id INTEGER REFERENCES job_offers(id) ON DELETE SET NULL,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      job_offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      has_sector_experience INTEGER NOT NULL DEFAULT 0,
      access_code_id INTEGER REFERENCES access_codes(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      city_or_service_ar TEXT NOT NULL,
      city_or_service_es TEXT NOT NULL,
      city_or_service_fr TEXT NOT NULL,
      quote_ar TEXT NOT NULL,
      quote_es TEXT NOT NULL,
      quote_fr TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      is_approved INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sliders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_ar TEXT NOT NULL,
      title_es TEXT NOT NULL,
      title_fr TEXT NOT NULL,
      subtitle_ar TEXT NOT NULL DEFAULT '',
      subtitle_es TEXT NOT NULL DEFAULT '',
      subtitle_fr TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT NOT NULL UNIQUE,
      label_ar TEXT NOT NULL,
      label_es TEXT NOT NULL,
      label_fr TEXT NOT NULL,
      manual_value INTEGER NOT NULL DEFAULT 0,
      use_dynamic INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      whatsapp TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      admin_email TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrateUsersTable();
  seedInitialData();
}

function migrateUsersTable() {
  const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  const addCol = (name: string, ddl: string) => {
    if (!colNames.has(name)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
    }
  };

  addCol('email', "email TEXT NOT NULL DEFAULT ''");
  addCol('sector_preference', "sector_preference TEXT NOT NULL DEFAULT ''");
  addCol('experience_years', "experience_years TEXT NOT NULL DEFAULT ''");
  addCol('source', "source TEXT NOT NULL DEFAULT 'application'");
  addCol('notes', "notes TEXT NOT NULL DEFAULT ''");
  addCol('code_hash', "code_hash TEXT NOT NULL DEFAULT ''");
  addCol('registration_code_label', "registration_code_label TEXT NOT NULL DEFAULT ''");
  addCol('updated_at', "updated_at TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE users SET updated_at = created_at WHERE updated_at = '' OR updated_at IS NULL");

  // Backfill any contact messages not yet in users
  const contacts = db.prepare('SELECT full_name, email, whatsapp, subject, created_at FROM contact_messages').all() as Array<{
    full_name: string;
    email: string;
    whatsapp: string;
    subject: string;
    created_at: string;
  }>;
  for (const c of contacts) {
    upsertRegisteredUser({
      fullName: c.full_name,
      whatsapp: c.whatsapp,
      email: c.email,
      sectorPreference: c.subject,
      source: 'contact',
      createdAt: c.created_at,
    });
  }
}

export function upsertRegisteredUser(input: {
  fullName: string;
  whatsapp?: string;
  email?: string;
  cityPreference?: string;
  sectorPreference?: string;
  experienceYears?: string;
  source?: string;
  codeHash?: string;
  registrationCodeLabel?: string;
  createdAt?: string;
}): number {
  const fullName = String(input.fullName || '').trim().slice(0, 120);
  const whatsapp = String(input.whatsapp || '').trim().slice(0, 40);
  const email = String(input.email || '').trim().toLowerCase().slice(0, 140);
  const cityPref = String(input.cityPreference || '').trim().slice(0, 80);
  const sectorPref = String(input.sectorPreference || '').trim().slice(0, 120);
  const expYears = String(input.experienceYears || '').trim().slice(0, 60);
  const source = String(input.source || 'registration').trim().slice(0, 40);
  const codeHash = String(input.codeHash || '').trim();
  const codeLabel = String(input.registrationCodeLabel || '').trim().slice(0, 80);

  let existing: {
    id: number;
    full_name: string;
    whatsapp: string;
    email: string;
    city_preference: string | null;
    sector_preference: string;
    experience_years: string;
  } | undefined;

  if (whatsapp) {
    const cleanDigits = whatsapp.replace(/\D/g, '');
    if (cleanDigits.length >= 6) {
      existing = db
        .prepare("SELECT id, full_name, whatsapp, email, city_preference, sector_preference, experience_years FROM users WHERE whatsapp = ? OR replace(replace(replace(whatsapp, ' ', ''), '+', ''), '-', '') = ? LIMIT 1")
        .get(whatsapp, cleanDigits) as typeof existing;
    } else {
      existing = db
        .prepare('SELECT id, full_name, whatsapp, email, city_preference, sector_preference, experience_years FROM users WHERE whatsapp = ? LIMIT 1')
        .get(whatsapp) as typeof existing;
    }
  }

  if (!existing && email) {
    existing = db
      .prepare('SELECT id, full_name, whatsapp, email, city_preference, sector_preference, experience_years FROM users WHERE lower(email) = ? LIMIT 1')
      .get(email) as typeof existing;
  }

  if (existing) {
    db.prepare(`
      UPDATE users SET
        full_name = CASE WHEN ? != '' THEN ? ELSE full_name END,
        whatsapp = CASE WHEN ? != '' AND whatsapp = '' THEN ? ELSE whatsapp END,
        email = CASE WHEN ? != '' THEN ? ELSE email END,
        city_preference = CASE WHEN ? != '' THEN ? ELSE city_preference END,
        sector_preference = CASE WHEN ? != '' THEN ? ELSE sector_preference END,
        experience_years = CASE WHEN ? != '' THEN ? ELSE experience_years END,
        code_hash = CASE WHEN ? != '' THEN ? ELSE code_hash END,
        registration_code_label = CASE WHEN ? != '' THEN ? ELSE registration_code_label END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      fullName, fullName,
      whatsapp, whatsapp,
      email, email,
      cityPref, cityPref,
      sectorPref, sectorPref,
      expYears, expYears,
      codeHash, codeHash,
      codeLabel, codeLabel,
      existing.id
    );
    return existing.id;
  }

  const res = db
    .prepare(
      `
    INSERT INTO users (
      full_name, whatsapp, email, city_preference, sector_preference, experience_years, source, code_hash, registration_code_label, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))
  `
    )
    .run(fullName, whatsapp, email, cityPref, sectorPref, expYears, source, codeHash, codeLabel, input.createdAt || null);

  return Number(res.lastInsertRowid);
}

function seedInitialData() {
  const cityCount = (db.prepare('SELECT COUNT(*) as c FROM cities').get() as { c: number }).c;
  if (cityCount === 0) {
    const insertCity = db.prepare(`
      INSERT INTO cities (slug, name_ar, name_es, name_fr, description_ar, description_es, description_fr, image_url, map_x, map_y, dot_color, is_active, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const seedCities = [
      ['madrid', 'مدريد', 'Madrid', 'Madrid', 'العاصمة الإدارية والاقتصادية لإسبانيا، تضم مراكز صناعية ولوجستية كبرى.', 'Capital administrativa y económica con grandes centros industriales y logísticos.', 'Capitale administrative et économique abritant de grands pôles industriels.', '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', 47, 46, 'orange', 1],
      ['barcelona', 'برشلونة', 'Barcelona', 'Barcelone', 'قطب أوروبي رائد في صناعة النسيج والخياطة والخدمات اللوجستية.', 'Polo europeo líder en confección textil, industria y logística.', 'Pôle européen majeur du textile, de la confection et de la logistique.', '/src/assets/images/slider_barcelona_industry_1795347963937.jpg', 83, 31, 'red', 2],
      ['valencia', 'فالنسيا', 'Valencia', 'Valence', 'ميناء متوسطي استراتيجي ومركز نشط للمستودعات والنسيج والصناعات.', 'Puerto estratégico mediterráneo y centro activo de almacenes y textil.', 'Port stratégique méditerranéen et centre dynamique d’entrepôts et de textile.', '/src/assets/images/slider_valencia_logistics_1795347963529.jpg', 69, 53, 'orange', 3],
      ['malaga', 'ملقا', 'Málaga', 'Malaga', 'مركز اقتصادي نشط في الأندلس في مجالات الخدمات والضيافة واللوجستيك.', 'Motor económico andaluz en servicios, hostelería y logística.', 'Pôle économique andalou actif dans les services et la logistique.', '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', 39, 84, 'orange', 4],
      ['sevilla', 'إشبيلية', 'Sevilla', 'Séville', 'حاضرة جنوب إسبانيا، تحتضن مستودعات توزيع كبرى ومشاريع فلاحية وصناعية.', 'Metrópoli del sur español con grandes centros de distribución y agroindustria.', 'Métropole du sud espagnol dotée de grands centres logistiques et agricoles.', '/src/assets/images/slider_valencia_logistics_1795347963529.jpg', 28, 78, 'orange', 5],
      ['zaragoza', 'سرقسطة', 'Zaragoza', 'Saragosse', 'تقاطع لوجستي وصناعي محوري بين مدريد وبرشلونة وبلاد الباسك.', 'Nudo logístico e industrial clave entre Madrid, Barcelona y el País Vasco.', 'Carrefour logistique et industriel clé entre Madrid et Barcelone.', '/src/assets/images/slider_valencia_logistics_1795347963529.jpg', 65, 30, 'orange', 6],
      ['alicante', 'أليكانتي', 'Alicante', 'Alicante', 'منطقة نشطة في صناعة الملابس والأحذية والنسيج والخدمات السياحية.', 'Región dinámica en confección textil, calzado y servicios.', 'Région dynamique dans le textile, la chaussure et les services.', '/src/assets/images/slider_barcelona_industry_1795347963937.jpg', 68, 65, 'red', 7],
      ['murcia', 'مرسية', 'Murcia', 'Murcie', 'من أكبر الأقطاب الفلاحية والتصنيعية الغذائية في أوروبا.', 'Uno de los mayores polos agrícolas y agroindustriales de Europa.', 'L’un des plus grands pôles agricoles et agro-industriels d’Europe.', '/src/assets/images/slider_valencia_logistics_1795347963529.jpg', 63, 71, 'orange', 8],
      ['bilbao', 'بلباو', 'Bilbao', 'Bilbao', 'مركز صناعي وتقني متطور في شمال إسبانيا.', 'Centro industrial y técnico avanzado en el norte de España.', 'Centre industriel et technique avancé dans le nord de l’Espagne.', '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', 49, 12, 'orange', 9],
      ['granada', 'غرناطة', 'Granada', 'Grenade', 'منطقة تاريخية تضم فرصاً في الفلاحة والخدمات اللوجستية والسياحية.', 'Zona histórica con oportunidades agrícolas, logísticas y de servicios.', 'Région historique offrant des opportunités agricoles et de services.', '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', 46, 81, 'orange', 10],
      ['girona', 'جيرونا', 'Girona', 'Gérone', 'تجمع بين الصناعات النسيجية والخدمات والقرب من الحدود الفرنسية.', 'Combina industria textil, servicios y proximidad a la frontera francesa.', 'Allie industrie textile, services et proximité de la frontière française.', '/src/assets/images/slider_barcelona_industry_1795347963937.jpg', 88, 23, 'orange', 11],
      ['toledo', 'طليطلة', 'Toledo', 'Tolède', 'مركز توزيع ولوجستيك متنامي بالقرب من منطقة مدريد الكبرى.', 'Centro logístico y de distribución en crecimiento junto a Madrid.', 'Centre logistique et de distribution en plein essor près de Madrid.', '/src/assets/images/slider_valencia_logistics_1795347963529.jpg', 44, 52, 'orange', 12],
      ['cordoba', 'قرطبة', 'Córdoba', 'Cordoue', 'قطب أندلسي للصناعات التحويلية والفلاحية والحرفية.', 'Polo andaluz de agroindustria, manufactura y oficios.', 'Pôle andalou d’agro-industrie, de fabrication et d’artisanat.', '/src/assets/images/slider_madrid_skyline_1795347961385.jpg', 36, 73, 'orange', 13],
      ['valladolid', 'بلد الوليد', 'Valladolid', 'Valladolid', 'مركز صناعي بارز في قشتالة وليون في قطاع المصانع والسيارات.', 'Centro industrial destacado en Castilla y León en manufactura y automoción.', 'Centre industriel majeur en Castille-et-León.', '/src/assets/images/slider_valencia_logistics_1795347963529.jpg', 38, 29, 'orange', 14]
    ];

    for (const row of seedCities) {
      insertCity.run(...row);
    }
  }

  const companyCount = (db.prepare('SELECT COUNT(*) as c FROM companies').get() as { c: number }).c;
  if (companyCount === 0) {
    const cityRows = db.prepare('SELECT id, slug FROM cities').all() as Array<{ id: number; slug: string }>;
    const cityMap = new Map(cityRows.map((c) => [c.slug, c.id]));

    const insertCompany = db.prepare(`
      INSERT INTO companies (city_id, name_es, sector_ar, sector_es, sector_fr, phone, operator_info_ar, operator_info_es, operator_info_fr, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const seedCompanies = [
      ['barcelona', 'Talleres Textiles Ibéricos S.L.', 'الخياطة وصناعة الملابس', 'Confección y Textil', 'Confection et Textile', '612489310', 'ورشة صناعية متخصصة في الخياطة الراقية والملابس الجاهزة.', 'Taller industrial especializado en confección y moda.', 'Atelier industriel spécialisé dans la confection haut de gamme.'],
      ['alicante', 'Textil Alicante Moda S.L.', 'الخياطة وصناعة الملابس', 'Confección y Textil', 'Confection et Textile', '644912087', 'وحدة إنتاجية لتصنيع الملابس الجاهزة والأقمشة.', 'Planta de producción de prendas y textiles.', 'Unité de production de vêtements et textiles.'],
      ['valencia', 'Logística Puerto de Valencia S.L.', 'المستودعات', 'Almacenes y Logística', 'Entrepôts et Logistique', '629104552', 'مجموعة لوجستية لتجهيز الشحنات وتخزين البضائع.', 'Grupo logístico de preparación de pedidos y almacenamiento.', 'Groupe logistique de préparation de commandes.'],
      ['madrid', 'Manufacturas del Centro S.L.', 'المصانع', 'Fábricas y Producción', 'Usines et Production', '618334720', 'مصنع خطوط إنتاج وتعبئة صناعية في ضواحي مدريد.', 'Fábrica de líneas de producción y envasado industrial.', 'Usine de lignes de production et conditionnement.'],
      ['murcia', 'AgroExport Mediterráneo S.L.', 'الفلاحة', 'Agricultura y Agroindustria', 'Agriculture et Agroalimentaire', '655720194', 'ضيعات ومراكز فرز وتغليف المنتجات الفلاحية للتصدير.', 'Fincas y centros de envasado agrícola de exportación.', 'Exploitations et centres de conditionnement agricole.'],
      ['malaga', 'Servicios Costa del Sol S.L.', 'الخدمات', 'Servicios y Hostelería', 'Services et Hôtellerie', '671209445', 'شركة خدمات مهنية وصيانة منشآت في ملقا.', 'Empresa de servicios profesionales y mantenimiento.', 'Entreprise de services professionnels et maintenance.'],
      ['sevilla', 'Grupo Logístico Andalucía S.L.', 'المستودعات', 'Almacenes y Logística', 'Entrepôts et Logistique', '633841220', 'مستودعات توزيع إقليمية في الأندلس.', 'Almacenes de distribución regional en Andalucía.', 'Entrepôts de distribution régionale en Andalousie.'],
      ['zaragoza', 'Industrias Metálicas Ebro S.L.', 'المصانع', 'Fábricas y Metalurgia', 'Usines et Métallurgie', '622510983', 'مصنع تشكيل ومعالجة المعادن الخفيفة.', 'Planta de conformado y tratamiento industrial.', 'Usine de transformation industrielle.'],
      ['bilbao', 'Talleres Bilbao Precisión S.L.', 'المصانع', 'Fábricas y Mecanizado', 'Usines et Usinage', '688120334', 'وحدة تصنيع مكونات صناعية دقيقة.', 'Unidad de fabricación de componentes industriales.', 'Unité de fabrication de composants industriels.'],
      ['granada', 'Huerta de Granada S.L.', 'الفلاحة', 'Agricultura', 'Agriculture', '691452870', 'إنتاج وتوضيب المحاصيل الفلاحية.', 'Producción y empaquetado de cultivos agrícolas.', 'Production et conditionnement de cultures agricoles.'],
      ['girona', 'Confección Girona Atelier S.L.', 'الخياطة وصناعة الملابس', 'Confección y Textil', 'Confection et Textile', '615780241', 'مشغل خياطة صناعية بمواصفات أوروبية.', 'Taller de confección industrial con estándares europeos.', 'Atelier de confection industrielle aux normes européennes.'],
      ['toledo', 'Logística Castilla S.L.', 'المستودعات', 'Almacenes y Distribución', 'Entrepôts et Distribution', '647892110', 'مركز توزيع وتخزين بضائع في وسط إسبانيا.', 'Centro de distribución y almacenaje en el centro de España.', 'Centre de distribution et de stockage.'],
      ['cordoba', 'AgroOlivar Córdoba S.L.', 'الفلاحة', 'Agricultura y Olivar', 'Agriculture et Oléiculture', '663119042', 'مؤسسة فلاحية متخصصة في جني وعصر وتعبئة الزيتون.', 'Empresa agrícola especializada en olivar y envasado.', 'Entreprise agricole spécialisée dans l’oléiculture.'],
      ['valladolid', 'Industrias Valladolid S.L.', 'المصانع', 'Fábricas y Ensamblaje', 'Usines et Assemblage', '639004512', 'مصنع تجميع وتعبئة مكونات ميكانيكية.', 'Planta de ensamblaje y embalaje industrial.', 'Usine d’assemblage et d’emballage industriel.']
    ];

    for (const [slug, ...rest] of seedCompanies) {
      const cid = cityMap.get(slug);
      if (cid) insertCompany.run(cid, ...rest);
    }
  }

  const jobCount = (db.prepare('SELECT COUNT(*) as c FROM job_offers').get() as { c: number }).c;
  if (jobCount === 0) {
    const companies = db.prepare(`
      SELECT co.id as company_id, co.city_id, co.name_es, co.sector_ar, co.sector_es, co.sector_fr, c.slug as city_slug
      FROM companies co JOIN cities c ON co.city_id = c.id
    `).all() as Array<{
      company_id: number;
      city_id: number;
      name_es: string;
      sector_ar: string;
      sector_es: string;
      sector_fr: string;
      city_slug: string;
    }>;

    const insertJob = db.prepare(`
      INSERT INTO job_offers (
        company_id, city_id,
        title_ar, title_es, title_fr,
        category_ar, category_es, category_fr,
        description_ar, description_es, description_fr,
        contract_type_ar, contract_type_es, contract_type_fr,
        positions_count,
        application_question_ar, application_question_es, application_question_fr,
        experience_question_ar, experience_question_es, experience_question_fr,
        status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', date('now', '+90 days'))
    `);

    const jobTemplates: Record<string, {
      title_ar: string; title_es: string; title_fr: string;
      desc_ar: string; desc_es: string; desc_fr: string;
      contract_ar: string; contract_es: string; contract_fr: string;
      positions: number;
      appQ_ar: string; appQ_es: string; appQ_fr: string;
      expQ_ar: string; expQ_es: string; expQ_fr: string;
    }> = {
      barcelona: {
        title_ar: 'خياطون وخياطات صناعيون — خطوط الملابس الجاهزة',
        title_es: 'Costureros/as Industriales — Confección Textil',
        title_fr: 'Couturiers Industriels — Confection Textile',
        desc_ar: 'مطلوب عمال وعاملات ذوو خبرة عملية في تشغيل آلات الخياطة الصناعية (Piqueuse / Surjeteuse) ضمن ورشة منظمة في برشلونة. يخضع الملف لدراسة الشركة المشغلة والجهات الإدارية المختصة.',
        desc_es: 'Se requieren operarios con experiencia en maquinaria industrial de confección textil en taller organizado en Barcelona. Sujeto a validación de la empresa y autoridades.',
        desc_fr: 'Opérateurs expérimentés sur machines de couture industrielles recherchés à Barcelone. Soumis à l’examen de l’entreprise et des autorités compétentes.',
        contract_ar: 'عقد عمل مؤقت قابل للتجديد',
        contract_es: 'Contrato laboral temporal renovable',
        contract_fr: 'Contrat de travail temporaire renouvelable',
        positions: 12,
        appQ_ar: 'هل ترغب في التقدم للحصول على عقد عمل في مجال الخياطة لدى هذه الشركة؟',
        appQ_es: '¿Desea postularse para un contrato de trabajo en confección textil con esta empresa?',
        appQ_fr: 'Souhaitez-vous postuler pour un contrat de travail en couture auprès de cette entreprise ?',
        expQ_ar: 'هل سبق لك العمل في شركة متخصصة في الخياطة أو صناعة الملابس في المغرب؟',
        expQ_es: '¿Ha trabajado anteriormente en una empresa de confección o textil en Marruecos?',
        expQ_fr: 'Avez-vous déjà travaillé dans une entreprise de confection ou de textile au Maroc ?'
      },
      alicante: {
        title_ar: 'فنيو خياطة وتشطيب الملابس الجاهزة',
        title_es: 'Operarios de Confección y Acabado Textil',
        title_fr: 'Opérateurs de Confection et Finition Textile',
        desc_ar: 'فرصة للعمل في خطوط الخياطة والتجميع الصناعي للملابس في أليكانتي. يشترط الالتزام بمعايير الجودة والدقة الزمنية.',
        desc_es: 'Oportunidad en líneas de confección y ensamblaje de prendas en Alicante con altos estándares de calidad.',
        desc_fr: 'Opportunité sur les lignes de confection et d’assemblage textile à Alicante.',
        contract_ar: 'عقد عمل بدوام كامل',
        contract_es: 'Contrato a jornada completa',
        contract_fr: 'Contrat à temps plein',
        positions: 8,
        appQ_ar: 'هل ترغب في التقدم للحصول على عقد عمل في مجال الخياطة لدى هذه الشركة؟',
        appQ_es: '¿Desea postularse para un contrato de trabajo en confección textil con esta empresa?',
        appQ_fr: 'Souhaitez-vous postuler pour un contrat de travail en couture auprès de cette entreprise ?',
        expQ_ar: 'هل سبق لك العمل في شركة متخصصة في الخياطة أو صناعة الملابس في المغرب؟',
        expQ_es: '¿Ha trabajado anteriormente en una empresa de confección o textil en Marruecos?',
        expQ_fr: 'Avez-vous déjà travaillé dans une entreprise de confection ou de textile au Maroc ?'
      },
      valencia: {
        title_ar: 'موظفو مستودعات وتجهيز الطلبيات اللوجستية',
        title_es: 'Mozos de Almacén y Preparación de Pedidos',
        title_fr: 'Préparateurs de Commandes et Magasiniers',
        desc_ar: 'العمل في مستودعات الميناء اللوجستية بمدينة فالنسيا في فرز وتغليف وتجهيز الشحنات التجارية.',
        desc_es: 'Trabajo en almacenes portuarios de Valencia para clasificación, embalaje y preparación de envíos.',
        desc_fr: 'Travail dans les entrepôts portuaires de Valence pour le tri et la préparation des expéditions.',
        contract_ar: 'عقد عمل محدد المدة',
        contract_es: 'Contrato laboral de duración determinada',
        contract_fr: 'Contrat à durée déterminée',
        positions: 10,
        appQ_ar: 'هل ترغب في التقدم للحصول على عقد عمل في مجال المستودعات لدى هذه الشركة؟',
        appQ_es: '¿Desea postularse para este puesto de almacén en esta empresa?',
        appQ_fr: 'Souhaitez-vous postuler pour ce poste en entrepôt auprès de cette entreprise ?',
        expQ_ar: 'هل سبق لك العمل في المستودعات أو اللوجستيك في المغرب؟',
        expQ_es: '¿Tiene experiencia previa en almacenes o logística en Marruecos?',
        expQ_fr: 'Avez-vous déjà travaillé dans la logistique ou les entrepôts au Maroc ?'
      }
    };

    for (const co of companies) {
      const tpl = jobTemplates[co.city_slug] || {
        title_ar: `فرصة عمل في مجال ${co.sector_ar}`,
        title_es: `Oferta de empleo en ${co.sector_es}`,
        title_fr: `Offre d’emploi en ${co.sector_fr}`,
        desc_ar: `تدعو شركة ${co.name_es} المترشحين المؤهلين للاطلاع على متطلبات العمل في مجال ${co.sector_ar}. جميع الطلبات تخضع للمراجعة والقبول من طرف الشركة والسلطات المختصة.`,
        desc_es: `${co.name_es} abre proceso de selección en el sector ${co.sector_es}. Sujeto a evaluación empresarial y trámites legales vigentes.`,
        desc_fr: `${co.name_es} recherche des candidats qualifiés dans le secteur ${co.sector_fr}. Sous réserve d’approbation par l’employeur et les autorités.`,
        contract_ar: 'عقد عمل حسب القوانين الإسبانية',
        contract_es: 'Contrato según normativa española vigente',
        contract_fr: 'Contrat conforme à la législation espagnole',
        positions: 5,
        appQ_ar: `هل ترغب في التقدم للحصول على عقد عمل في مجال ${co.sector_ar} لدى هذه الشركة؟`,
        appQ_es: `¿Desea postularse para un contrato en ${co.sector_es} con esta empresa?`,
        appQ_fr: `Souhaitez-vous postuler pour un contrat en ${co.sector_fr} auprès de cette entreprise ?`,
        expQ_ar: `هل سبق لك العمل في شركة متخصصة في ${co.sector_ar} في المغرب؟`,
        expQ_es: `¿Ha trabajado anteriormente en el sector de ${co.sector_es} en Marruecos?`,
        expQ_fr: `Avez-vous déjà travaillé dans le secteur ${co.sector_fr} au Maroc ?`
      };

      insertJob.run(
        co.company_id,
        co.city_id,
        tpl.title_ar, tpl.title_es, tpl.title_fr,
        co.sector_ar, co.sector_es, co.sector_fr,
        tpl.desc_ar, tpl.desc_es, tpl.desc_fr,
        tpl.contract_ar, tpl.contract_es, tpl.contract_fr,
        tpl.positions,
        tpl.appQ_ar, tpl.appQ_es, tpl.appQ_fr,
        tpl.expQ_ar, tpl.expQ_es, tpl.expQ_fr
      );
    }
  }

  const condCount = (db.prepare('SELECT COUNT(*) as c FROM conditions').get() as { c: number }).c;
  if (condCount === 0) {
    const insertCond = db.prepare(`
      INSERT INTO conditions (job_offer_id, text_ar, text_es, text_fr, display_order, is_active)
      VALUES (NULL, ?, ?, ?, ?, 1)
    `);
    insertCond.run(
      'الوضعية القانونية السليمة وعدم وجود مانع قانوني.',
      'Situación legal regular y ausencia de impedimentos legales.',
      'Situation juridique régulière et absence d’empêchement légal.',
      1
    );
    insertCond.run(
      'عدم وجود سوابق عدلية مانعة وفق الشروط المعمول بها.',
      'Carecer de antecedentes penales que impidan la contratación conforme a la normativa vigente.',
      'Absence de casier judiciaire incompatible selon la réglementation en vigueur.',
      2
    );
    insertCond.run(
      'ألا يتجاوز عمر المرشح 50 سنة، إذا كان هذا شرطاً خاصاً بعرض العمل المعني.',
      'No superar los 50 años de edad, cuando sea un requisito específico de la oferta.',
      'Ne pas dépasser 50 ans, lorsque cette condition est requise pour l’offre concernée.',
      3
    );
  }

  const sliderCount = (db.prepare('SELECT COUNT(*) as c FROM sliders').get() as { c: number }).c;
  if (sliderCount === 0) {
    const insertSlider = db.prepare(`
      INSERT INTO sliders (title_ar, title_es, title_fr, subtitle_ar, subtitle_es, subtitle_fr, image_url, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertSlider.run(
      'مدريد — قلب الفرص الاقتصادية والإدارية',
      'Madrid — Centro Económico y Corporativo',
      'Madrid — Pôle Économique et Administratif',
      'مواكبة مهنية منظمة تربط الكفاءات بالشركات الإسبانية المعتمدة في العاصمة.',
      'Acompañamiento profesional que conecta talento con empresas en la capital.',
      'Accompagnement structuré reliant les talents aux entreprises de la capitale.',
      '/src/assets/images/slider_madrid_skyline_1795347961385.jpg',
      1
    );
    insertSlider.run(
      'برشلونة — صناعة النسيج والخياطة الاحترافية',
      'Barcelona — Industria Textil y Confección',
      'Barcelone — Industrie Textile et Confection',
      'فرص مخصصة للحرفيين المتمرسين في الخياطة الصناعية وتصميم الملابس.',
      'Oportunidades especializadas para profesionales de la confección industrial.',
      'Opportunités dédiées aux professionnels de la couture industrielle.',
      '/src/assets/images/slider_barcelona_industry_1795347963937.jpg',
      2
    );
    insertSlider.run(
      'فالنسيا — البوابة المتوسطية للوجستيك والمستودعات',
      'Valencia — Puerto Logístico del Mediterráneo',
      'Valence — Pôle Logistique Méditerranéen',
      'منصات تخزين وتوزيع حديثة تستقطب اليد العاملة المؤهلة بوضوح وشفافية.',
      'Plataformas logísticas modernas con procesos de selección transparentes.',
      'Plateformes logistiques modernes avec des processus transparents.',
      '/src/assets/images/slider_valencia_logistics_1795347963529.jpg',
      3
    );
  }

  const testimonialCount = (db.prepare('SELECT COUNT(*) as c FROM testimonials').get() as { c: number }).c;
  if (testimonialCount === 0) {
    const insertTesti = db.prepare(`
      INSERT INTO testimonials (client_name, city_or_service_ar, city_or_service_es, city_or_service_fr, quote_ar, quote_es, quote_fr, avatar_url, is_approved, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    insertTesti.run(
      'كريم ب.',
      'برشلونة · الخياطة الصناعية',
      'Barcelona · Confección Textil',
      'Barcelone · Couture Industrielle',
      'سعيد جداً بوضوح المراحل منذ أول تواصل. تمت مراجعة ملف الخبرة وشرح كافة الشروط الواقعية قبل إرسال الوثائق عبر رمز الدخول المحمي.',
      'Muy satisfecho con la claridad de cada etapa y la transparencia en los requisitos antes de enviar mis documentos.',
      'Très satisfait de la clarté des étapes et de la transparence des conditions avant l’envoi sécurisé de mon dossier.',
      '/src/assets/images/testimonial_portrait_1_1795347962944.jpg',
      1
    );
    insertTesti.run(
      'نادية م.',
      'فالنسيا · المستودعات واللوجستيك',
      'Valencia · Almacenes y Logística',
      'Valence · Entrepôts et Logistique',
      'المنصة سهلت علي اختيار المدينة المناسبة ومعرفة تفاصيل الشركة ومتطلبات العقد دون أي وعود غير واقعية.',
      'La plataforma facilitó elegir la ciudad adecuada y conocer los requisitos reales sin falsas promesas.',
      'La plateforme m’a permis de choisir la ville adaptée et de comprendre les conditions réelles avec clarté.',
      '/src/assets/images/testimonial_portrait_1_1795347962944.jpg',
      2
    );
    insertTesti.run(
      'رشيد ت.',
      'أليكانتي · صناعة الملابس',
      'Alicante · Industria de la Moda',
      'Alicante · Confection',
      'نظام رفع السيرة الذاتية والشهادات برمز الدخول يمنح ثقة كبيرة في حماية المعطيات الشخصية وسرية الملفات.',
      'El sistema con código de acceso transmite gran confianza en la protección de datos y documentos.',
      'Le système protégé par code d’accès offre une vraie tranquillité concernant la confidentialité des documents.',
      '/src/assets/images/testimonial_portrait_1_1795347962944.jpg',
      3
    );
  }

  const statCount = (db.prepare('SELECT COUNT(*) as c FROM statistics').get() as { c: number }).c;
  if (statCount === 0) {
    const insertStat = db.prepare(`
      INSERT INTO statistics (key_name, label_ar, label_es, label_fr, manual_value, use_dynamic, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertStat.run('registered_candidates', 'عدد المسجلين', 'Candidatos Registrados', 'Candidats Inscrits', 1240, 0, 1);
    insertStat.run('applications_received', 'الطلبات المستلمة', 'Solicitudes Recibidas', 'Demandes Reçues', 865, 1, 2);
    insertStat.run('processed_files', 'الملفات المعالجة', 'Expedientes Procesados', 'Dossiers Traités', 612, 1, 3);
    insertStat.run('available_cities', 'المدن الإسبانية المتاحة', 'Ciudades Disponibles', 'Villes Disponibles', 14, 1, 4);
  }

  const settingsRow = db.prepare("SELECT value_json FROM site_settings WHERE key = 'main'").get() as
    | { value_json: string }
    | undefined;
  if (!settingsRow) {
    const defaultSettings = {
      themeVersion: 3,
      brandNameAr: 'إسبانيا كارير',
      brandNameEs: 'España Career',
      brandNameFr: 'España Career',
      logoUrl: '',
      accentColor: '#C81E1E',
      headingFont: 'Cairo',
      bodyFont: 'Almarai',
      heroTitleAr: 'بسّط رحلتك المهنية، وحقّق طموحك في إسبانيا',
      heroTitleEs: 'Simplifica tu camino y alcanza tus metas en España',
      heroTitleFr: 'Simplifiez votre parcours et concrétisez vos ambitions en Espagne',
      heroSubtitleAr: 'استكشف 14 مدينة إسبانية، تعرف على الشركات المشغلة وشروط كل عرض عمل بشفافية تامة، وقدّم ملفك عبر نظام وثائق محمي.',
      heroSubtitleEs: 'Explora 14 ciudades españolas, conoce las empresas y requisitos reales de cada oferta y envía tu candidatura de forma segura.',
      heroSubtitleFr: 'Explorez 14 villes espagnoles, découvrez les entreprises et postulez en toute transparence via un espace sécurisé.',
      aboutTitleAr: 'من نحن؟',
      aboutTitleEs: '¿Quiénes somos?',
      aboutTitleFr: 'Qui sommes-nous ?',
      aboutTextAr: 'نحن وكالة متخصصة في مواكبة الأشخاص الراغبين في الحصول على فرص عمل في إسبانيا. نعمل على تسهيل التواصل بين الباحثين عن العمل والشركات والمشغلين، ومساعدتهم على التعرف على الفرص المتاحة والتقدم إليها بكل شفافية ووضوح.\n\nنسعى إلى توفير تجربة احترافية تساعد المرشحين على فهم متطلبات التوظيف ومراحل تقديم الطلبات.',
      aboutTextEs: 'Somos una agencia especializada en acompañar a las personas que buscan oportunidades laborales en España. Facilitamos el contacto entre candidatos y empresas empleadoras, ayudando a conocer las ofertas disponibles y postularse con total transparencia y claridad.',
      aboutTextFr: 'Nous sommes une agence spécialisée dans l’accompagnement des personnes souhaitant accéder à des opportunités d’emploi en Espagne. Nous facilitons la mise en relation entre candidats et entreprises en toute transparence.',
      aboutImageUrl: '/src/assets/images/about_agency_consultation_1795347962650.jpg',
      footerBioAr: 'وكالة متخصصة في المواكبة المهنية والربط بين الكفاءات الباحثة عن العمل والشركات الإسبانية وفق ضوابط الشفافية وحماية المعطيات.',
      footerBioEs: 'Agencia especializada en acompañamiento profesional y conexión transparente entre candidatos y empresas en España.',
      footerBioFr: 'Agence spécialisée dans l’accompagnement professionnel et la mise en relation transparente avec les entreprises en Espagne.',
      whatsapp: '+34 600 000 000',
      email: 'contact@espana-career.example',
      socialLinks: {
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com',
        facebook: 'https://facebook.com'
      },
      navLinks: [
        { id: 'home', labelAr: 'الرئيسية', labelEs: 'Inicio', labelFr: 'Accueil', target: 'home' },
        { id: 'jobs', labelAr: 'عروض العمل', labelEs: 'Ofertas', labelFr: 'Offres', target: 'jobs' },
        { id: 'cities', labelAr: 'المدن', labelEs: 'Ciudades', labelFr: 'Villes', target: 'cities' },
        { id: 'about', labelAr: 'من نحن', labelEs: 'Nosotros', labelFr: 'À propos', target: 'about' },
        { id: 'contact', labelAr: 'اتصل بنا', labelEs: 'Contacto', labelFr: 'Contact', target: 'contact' }
      ],
      homeSections: [
        { id: 'about', labelAr: 'من نحن', visible: true, order: 1 },
        { id: 'statistics', labelAr: 'الإحصائيات', visible: true, order: 2 },
        { id: 'map', labelAr: 'خريطة إسبانيا التفاعلية والمدن', visible: true, order: 3 },
        { id: 'slider', labelAr: 'معرض الصور', visible: true, order: 4 },
        { id: 'conditions', labelAr: 'شروط التقديم', visible: true, order: 5 },
        { id: 'contact', labelAr: 'تواصل معنا', visible: true, order: 6 },
        { id: 'testimonials', labelAr: 'تجارب العملاء', visible: true, order: 7 }
      ]
    };

    db.prepare('INSERT INTO site_settings (key, value_json) VALUES (?, ?)').run(
      'main',
      JSON.stringify(defaultSettings)
    );
  } else {
    try {
      const parsed = JSON.parse(settingsRow.value_json);
      if (!parsed.themeVersion || parsed.themeVersion < 3) {
        parsed.themeVersion = 3;
        if (parsed.accentColor === '#F97316') {
          parsed.accentColor = '#C81E1E';
        }
        parsed.homeSections = [
          { id: 'about', labelAr: 'من نحن', visible: true, order: 1 },
          { id: 'statistics', labelAr: 'الإحصائيات', visible: true, order: 2 },
          { id: 'map', labelAr: 'خريطة إسبانيا التفاعلية والمدن', visible: true, order: 3 },
          { id: 'slider', labelAr: 'معرض الصور', visible: true, order: 4 },
          { id: 'conditions', labelAr: 'شروط التقديم', visible: true, order: 5 },
          { id: 'contact', labelAr: 'تواصل معنا', visible: true, order: 6 },
          { id: 'testimonials', labelAr: 'تجارب العملاء', visible: true, order: 7 }
        ];
        db.prepare("UPDATE site_settings SET value_json = ?, updated_at = datetime('now') WHERE key = 'main'").run(
          JSON.stringify(parsed)
        );
      }
    } catch {
      // ignore malformed JSON
    }
  }

  seedTailorContracts65();
}

function seedTailorContracts65() {
  const marker = db.prepare("SELECT value_json FROM site_settings WHERE key = 'tailor_contracts_65_seeded'").get();
  if (marker) return;

  const cityRows = db.prepare('SELECT id, slug FROM cities').all() as Array<{ id: number; slug: string }>;
  const cityMap = new Map(cityRows.map((c) => [c.slug, c.id]));

  // Upgrade Girona tailoring offer if it still has the generic fallback title
  const gironaId = cityMap.get('girona');
  if (gironaId) {
    db.prepare(`
      UPDATE job_offers
      SET title_ar = 'خياطو الأقمشة الفاخرة والبدل الرسمية',
          title_es = 'Sastres y Costureros de Confección Fina',
          title_fr = 'Tailleurs et Couturiers de Confection Fine',
          description_ar = 'فرصة عمل لخياطين متمرسين في تفصيل وخياطة الأقمشة الفاخرة والبدل ضمن ورشة متخصصة في جيرونا.',
          description_es = 'Oportunidad para sastres y costureros con experiencia en tejidos finos y trajes en taller de Girona.',
          description_fr = 'Opportunité pour tailleurs expérimentés dans la confection fine à Gérone.'
      WHERE city_id = ? AND category_ar = 'الخياطة وصناعة الملابس' AND title_ar LIKE 'فرصة عمل في مجال%'
    `).run(gironaId);
  }

  const extraTailorOffers: Array<{
    slug: string;
    companyName: string;
    phone: string;
    operatorInfoAr: string;
    operatorInfoEs: string;
    operatorInfoFr: string;
    titleAr: string;
    titleEs: string;
    titleFr: string;
    descAr: string;
    descEs: string;
    descFr: string;
    contractAr: string;
    contractEs: string;
    contractFr: string;
    positions: number;
  }> = [
    {
      slug: 'madrid',
      companyName: 'Moda y Confección Madrid S.L.',
      phone: '619482105',
      operatorInfoAr: 'ورشة خياطة وتفصيل متخصصة في البدل الرسمية والأزياء في مدريد.',
      operatorInfoEs: 'Taller de sastrería y confección de moda formal en Madrid.',
      operatorInfoFr: 'Atelier de couture et confection de tenues formelles à Madrid.',
      titleAr: 'خياطو البدل والملابس الرسمية — قص وتفصيل',
      titleEs: 'Sastres de Trajes y Prendas Formales — Corte y Confección',
      titleFr: 'Tailleurs de Costumes — Coupe et Confection',
      descAr: 'مطلوب خياطون متقنون لتفصيل وتجميع البدل والقمصان والملابس الرسمية باستخدام الآلات الصناعية في مدريد.',
      descEs: 'Se buscan sastres especializados en patronaje, corte y ensamblaje de trajes en Madrid.',
      descFr: 'Recherche de tailleurs qualifiés en coupe et assemblage de costumes à Madrid.',
      contractAr: 'عقد عمل بدوام كامل',
      contractEs: 'Contrato laboral a jornada completa',
      contractFr: 'Contrat de travail à temps plein',
      positions: 8,
    },
    {
      slug: 'valencia',
      companyName: 'Textiles del Turia S.L.',
      phone: '624731890',
      operatorInfoAr: 'مشغل صناعي لتفصيل المفروشات والستائر والأقمشة المنزلية في فالنسيا.',
      operatorInfoEs: 'Planta industrial de confección textil para el hogar y tapicería en Valencia.',
      operatorInfoFr: 'Atelier industriel de confection textile et ameublement à Valence.',
      titleAr: 'خياطو المفروشات والستائر والأقمشة المنزلية',
      titleEs: 'Costureros/as de Tapicería y Textil Hogar',
      titleFr: 'Couturiers d’Ameublement et Linge de Maison',
      descAr: 'فرصة عمل في تفصيل وخياطة الستائر والأغطية والمفروشات الفندقية بمواصفات قياسية في فالنسيا.',
      descEs: 'Puesto en confección de cortinas, tapicería y lencería hotelera en Valencia.',
      descFr: 'Poste en confection de rideaux, tapisserie et textile hôtelier à Valence.',
      contractAr: 'عقد عمل مؤقت قابل للتجديد',
      contractEs: 'Contrato temporal renovable',
      contractFr: 'Contrat temporaire renouvelable',
      positions: 6,
    },
    {
      slug: 'sevilla',
      companyName: 'Atelier Textil Sevilla S.L.',
      phone: '638519044',
      operatorInfoAr: 'ورشة أندلسية لإنتاج الملابس الجاهزة والأزياء الموسمية في إشبيلية.',
      operatorInfoEs: 'Taller andaluz de confección de prendas de vestir y moda de temporada en Sevilla.',
      operatorInfoFr: 'Atelier andalou de confection de prêt-à-porter à Séville.',
      titleAr: 'خياطو الأزياء والملابس النسائية الجاهزة',
      titleEs: 'Modistas y Costureros/as de Moda Prêt-à-Porter',
      titleFr: 'Couturiers Prêt-à-Porter et Mode',
      descAr: 'مطلوب خياطون وخياطات بخبرة في خياطة الفساتين والألبسة الجاهزة والتعديلات الدقيقة في إشبيلية.',
      descEs: 'Se requieren profesionales en costura de prendas de vestir, arreglos y acabados en Sevilla.',
      descFr: 'Professionnels recherchés en couture de prêt-à-porter et retouches à Séville.',
      contractAr: 'عقد عمل بدوام كامل',
      contractEs: 'Contrato a jornada completa',
      contractFr: 'Contrat à temps plein',
      positions: 6,
    },
    {
      slug: 'malaga',
      companyName: 'Confecciones Costa del Sol S.L.',
      phone: '674108392',
      operatorInfoAr: 'مركز خياطة وتشطيب وتجهيز الملابس السياحية والفندقية في ملقا.',
      operatorInfoEs: 'Centro de confección, acabado y preparación textil en Málaga.',
      operatorInfoFr: 'Centre de confection, finition et préparation textile à Malaga.',
      titleAr: 'فنيو التشطيب والكيّ ومراقبة جودة الخياطة',
      titleEs: 'Operarios de Acabado, Planchado y Control de Costura',
      titleFr: 'Opérateurs Finition et Contrôle Qualité Couture',
      descAr: 'العمل ضمن فريق التشطيب النهائي وخياطة الأزرار والعراوي ومراقبة جودة القطع المخيطة في ملقا.',
      descEs: 'Trabajo en equipo de acabado final, ojales, planchado y control de calidad textil en Málaga.',
      descFr: 'Travail en équipe de finition finale, repassage et contrôle qualité textile à Malaga.',
      contractAr: 'عقد عمل محدد المدة',
      contractEs: 'Contrato laboral de duración determinada',
      contractFr: 'Contrat à durée déterminée',
      positions: 6,
    },
    {
      slug: 'zaragoza',
      companyName: 'Confección Aragón S.L.',
      phone: '628903417',
      operatorInfoAr: 'وحدة صناعية لخطوط الخياطة السريعة بالآلات متعددة الإبر في سرقسطة.',
      operatorInfoEs: 'Unidad industrial de líneas de costura con máquinas overlock en Zaragoza.',
      operatorInfoFr: 'Unité industrielle de couture sur machines surjeteuses à Saragosse.',
      titleAr: 'مشغلو آلات الخياطة متعددة الإبر (Overlock / Surjeteuse)',
      titleEs: 'Operarios de Máquinas Overlock y Costura Industrial',
      titleFr: 'Opérateurs Machines Surjeteuses (Overlock)',
      descAr: 'مطلوب مشغلو آلات السورجي والبيكوز ذوو كفاءة في سرعة التجميع والدقة ضمن مصنع نسيج في سرقسطة.',
      descEs: 'Se solicitan operarios con dominio de máquinas overlock y plana en planta textil de Zaragoza.',
      descFr: 'Opérateurs maîtrisant la surjeteuse et la piqueuse recherchés à Saragosse.',
      contractAr: 'عقد عمل وفق القوانين الإسبانية',
      contractEs: 'Contrato según normativa española vigente',
      contractFr: 'Contrat conforme à la législation espagnole',
      positions: 5,
    },
    {
      slug: 'toledo',
      companyName: 'Talleres Toledo Textil S.L.',
      phone: '642715803',
      operatorInfoAr: 'مشغل خياطة ملابس العمل والبدلات المهنية والوقاية في طليطلة.',
      operatorInfoEs: 'Taller de confección de vestuario laboral y uniformes profesionales en Toledo.',
      operatorInfoFr: 'Atelier de confection de vêtements professionnels à Tolède.',
      titleAr: 'خياطو ملابس العمل والبدلات المهنية الواقية',
      titleEs: 'Costureros/as de Vestuario Laboral y Uniformes',
      titleFr: 'Couturiers de Vêtements Professionnels et Uniformes',
      descAr: 'خياطة الأقمشة المتينة وتجهيز بدلات العمل والزي المهني الموحد للشركات في طليطلة.',
      descEs: 'Confección de tejidos resistentes y uniformes laborales para empresas en Toledo.',
      descFr: 'Confection de tissus résistants et uniformes professionnels à Tolède.',
      contractAr: 'عقد عمل مؤقت قابل للتجديد',
      contractEs: 'Contrato temporal renovable',
      contractFr: 'Contrat temporaire renouvelable',
      positions: 5,
    },
    {
      slug: 'cordoba',
      companyName: 'Moda Andaluza Córdoba S.L.',
      phone: '665309821',
      operatorInfoAr: 'ورشة خياطة وتجميع القطع الأولية والتطريز في قرطبة.',
      operatorInfoEs: 'Taller de confección, ensamblaje de piezas y bordado en Córdoba.',
      operatorInfoFr: 'Atelier de couture, assemblage et broderie à Cordoue.',
      titleAr: 'مساعدو الخياطة وتجميع القطع والباترون',
      titleEs: 'Ayudantes de Costura, Ensamblaje y Patronaje',
      titleFr: 'Aides-Couturiers, Assemblage et Patronage',
      descAr: 'دعم خطوط الخياطة في تحضير القطع وتجميع الأكمام والياقات والعمل على الباترون في قرطبة.',
      descEs: 'Apoyo en líneas de confección, preparación de piezas y ensamblaje en Córdoba.',
      descFr: 'Soutien sur lignes de confection, préparation et assemblage de pièces à Cordoue.',
      contractAr: 'عقد عمل بدوام كامل',
      contractEs: 'Contrato a jornada completa',
      contractFr: 'Contrat à temps plein',
      positions: 4,
    },
  ];

  const insertCompany = db.prepare(`
    INSERT INTO companies (city_id, name_es, sector_ar, sector_es, sector_fr, phone, operator_info_ar, operator_info_es, operator_info_fr, is_active)
    VALUES (?, ?, 'الخياطة وصناعة الملابس', 'Confección y Textil', 'Confection et Textile', ?, ?, ?, ?, 1)
  `);

  const insertJob = db.prepare(`
    INSERT INTO job_offers (
      company_id, city_id,
      title_ar, title_es, title_fr,
      category_ar, category_es, category_fr,
      description_ar, description_es, description_fr,
      contract_type_ar, contract_type_es, contract_type_fr,
      positions_count,
      application_question_ar, application_question_es, application_question_fr,
      experience_question_ar, experience_question_es, experience_question_fr,
      status, expires_at
    ) VALUES (?, ?, ?, ?, ?, 'الخياطة وصناعة الملابس', 'Confección y Textil', 'Confection et Textile', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', date('now', '+90 days'))
  `);

  const tx = db.transaction(() => {
    for (const item of extraTailorOffers) {
      const cityId = cityMap.get(item.slug);
      if (!cityId) continue;

      let company = db
        .prepare('SELECT id FROM companies WHERE city_id = ? AND name_es = ?')
        .get(cityId, item.companyName) as { id: number } | undefined;

      if (!company) {
        const res = insertCompany.run(
          cityId,
          item.companyName,
          item.phone,
          item.operatorInfoAr,
          item.operatorInfoEs,
          item.operatorInfoFr
        );
        company = { id: Number(res.lastInsertRowid) };
      }

      const existingJob = db
        .prepare('SELECT id FROM job_offers WHERE company_id = ? AND title_ar = ?')
        .get(company.id, item.titleAr);

      if (!existingJob) {
        insertJob.run(
          company.id,
          cityId,
          item.titleAr,
          item.titleEs,
          item.titleFr,
          item.descAr,
          item.descEs,
          item.descFr,
          item.contractAr,
          item.contractEs,
          item.contractFr,
          item.positions,
          'هل ترغب في التقدم للحصول على عقد عمل في مجال الخياطة لدى هذه الشركة؟',
          '¿Desea postularse para un contrato de trabajo en confección textil con esta empresa?',
          'Souhaitez-vous postuler pour un contrat de travail en couture auprès de cette entreprise ?',
          'هل سبق لك العمل في شركة متخصصة في الخياطة أو صناعة الملابس في المغرب؟',
          '¿Ha trabajado anteriormente en una empresa de confección o textil en Marruecos?',
          'Avez-vous déjà travaillé dans une entreprise de confection ou de textile au Maroc ?'
        );
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO site_settings (key, value_json, updated_at) VALUES ('tailor_contracts_65_seeded', 'true', datetime('now'))"
    ).run();
  });

  tx();
}

export function logAudit(params: {
  adminId?: number | null;
  adminEmail?: string;
  action: string;
  targetType: string;
  targetId?: string | number;
  details?: string;
  ipAddress?: string;
}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (admin_id, admin_email, action, target_type, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.adminId ?? null,
      params.adminEmail || 'system',
      params.action,
      params.targetType,
      String(params.targetId ?? ''),
      params.details || '',
      params.ipAddress || ''
    );
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

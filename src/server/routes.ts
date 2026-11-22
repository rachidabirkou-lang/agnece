import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import {
  createRateLimiter,
  hashPassword,
  requireAdmin,
  signToken,
  signUploadGrant,
  verifyEnvPasscode,
  verifyPassword,
  verifyUploadGrant,
  type AdminRequest,
} from './auth.ts';
import { db, logAudit, maskPhone, storageDir, upsertRegisteredUser } from './db.ts';

const assetsDir = path.resolve(process.cwd(), 'storage', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_DOC_MIMES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const ALLOWED_IMG_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function matchesMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 4) return false;
  if (mime === 'application/pdf') {
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  }
  if (mime === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === 'image/png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mime === 'image/webp') {
    return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  }
  if (mime === 'application/msword') {
    return buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  }
  return false;
}

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || '';
}

function computeDynamicStat(keyName: string, manualValue: number): number {
  if (keyName === 'applications_received') {
    const c = (db.prepare('SELECT COUNT(*) as c FROM applications').get() as { c: number }).c;
    return c;
  }
  if (keyName === 'processed_files') {
    const c = (
      db.prepare("SELECT COUNT(*) as c FROM applications WHERE status IN ('reviewed', 'contacted', 'accepted', 'completed')").get() as {
        c: number;
      }
    ).c;
    return c;
  }
  if (keyName === 'available_cities') {
    const c = (db.prepare('SELECT COUNT(*) as c FROM cities WHERE is_active = 1').get() as { c: number }).c;
    return c;
  }
  if (keyName === 'registered_candidates') {
    const c = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    return c;
  }
  return manualValue;
}

export function registerRoutes(app: express.Application) {
  const authLimiter = createRateLimiter('admin-auth', 15, 15 * 60 * 1000);
  const codeLimiter = createRateLimiter('access-code', 20, 10 * 60 * 1000);
  const submitLimiter = createRateLimiter('public-submit', 20, 15 * 60 * 1000);

  // Serve uploaded branding/slider/city/testimonial image assets safely
  app.get('/api/assets/:filename', (req, res) => {
    const safeName = path.basename(String(req.params.filename || ''));
    if (!/^[a-zA-Z0-9._-]+$/.test(safeName)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    const resolved = path.resolve(assetsDir, safeName);
    if (!resolved.startsWith(assetsDir + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolved);
  });

  // =========================================================================
  // PUBLIC API ROUTES
  // =========================================================================

  app.get('/api/bootstrap', (_req, res) => {
    try {
      const settingsRow = db.prepare("SELECT value_json FROM site_settings WHERE key = 'main'").get() as
        | { value_json: string }
        | undefined;
      const settings = settingsRow ? JSON.parse(settingsRow.value_json) : {};

      const cities = db
        .prepare(
          `
        SELECT c.*,
          (SELECT COUNT(*) FROM job_offers j WHERE j.city_id = c.id AND j.status = 'active') as active_jobs_count,
          (SELECT COUNT(*) FROM companies co WHERE co.city_id = c.id AND co.is_active = 1) as companies_count
        FROM cities c
        WHERE c.is_active = 1
        ORDER BY c.display_order ASC, c.id ASC
      `
        )
        .all();

      const sliders = db
        .prepare('SELECT * FROM sliders WHERE is_active = 1 ORDER BY display_order ASC, id ASC')
        .all();

      const conditions = db
        .prepare('SELECT * FROM conditions WHERE is_active = 1 AND job_offer_id IS NULL ORDER BY display_order ASC, id ASC')
        .all();

      const testimonials = db
        .prepare('SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY display_order ASC, id DESC')
        .all();

      const rawStats = db
        .prepare('SELECT * FROM statistics WHERE is_active = 1 ORDER BY display_order ASC, id ASC')
        .all() as Array<{
        id: number;
        key_name: string;
        label_ar: string;
        label_es: string;
        label_fr: string;
        manual_value: number;
        use_dynamic: number;
        display_order: number;
      }>;

      const statistics = rawStats.map((s) => ({
        ...s,
        value: s.use_dynamic ? Math.max(computeDynamicStat(s.key_name, s.manual_value), s.manual_value) : s.manual_value,
      }));

      const tailorRow = db
        .prepare("SELECT COALESCE(SUM(positions_count), 0) as total FROM job_offers WHERE status = 'active' AND category_ar = 'الخياطة وصناعة الملابس'")
        .get() as { total: number };

      res.json({
        settings,
        cities,
        sliders,
        conditions,
        testimonials,
        statistics,
        tailorContractsCount: tailorRow?.total ?? 0,
      });
    } catch (err) {
      console.error('Bootstrap error:', err);
      res.status(500).json({ error: 'Failed to load site data' });
    }
  });

  app.get('/api/cities', (_req, res) => {
    try {
      const cities = db
        .prepare(
          `
        SELECT c.*,
          (SELECT COUNT(*) FROM job_offers j WHERE j.city_id = c.id AND j.status = 'active') as active_jobs_count,
          (SELECT COUNT(*) FROM companies co WHERE co.city_id = c.id AND co.is_active = 1) as companies_count
        FROM cities c
        WHERE c.is_active = 1
        ORDER BY c.display_order ASC, c.id ASC
      `
        )
        .all();
      res.json(cities);
    } catch (err) {
      console.error('GET /api/cities error:', err);
      res.status(500).json({ error: 'Failed to load cities' });
    }
  });

  app.get('/api/cities/:slug', (req, res) => {
    try {
      const city = db.prepare('SELECT * FROM cities WHERE slug = ? AND is_active = 1').get(req.params.slug) as
        | Record<string, unknown>
        | undefined;
      if (!city) {
        res.status(404).json({ error: 'City not found' });
        return;
      }

      const companiesRaw = db
        .prepare('SELECT id, city_id, name_es, sector_ar, sector_es, sector_fr, phone, operator_info_ar, operator_info_es, operator_info_fr FROM companies WHERE city_id = ? AND is_active = 1 ORDER BY id ASC')
        .all(city.id) as Array<Record<string, unknown> & { phone: string }>;

      const companies = companiesRaw.map(({ phone, ...rest }) => ({
        ...rest,
        masked_phone: maskPhone(phone),
      }));

      const jobsRaw = db
        .prepare(
          `
        SELECT j.*, co.name_es as company_name_es, co.phone as company_phone,
          co.operator_info_ar, co.operator_info_es, co.operator_info_fr
        FROM job_offers j
        JOIN companies co ON j.company_id = co.id
        WHERE j.city_id = ? AND j.status = 'active' AND co.is_active = 1
        ORDER BY j.id DESC
      `
        )
        .all(city.id) as Array<Record<string, unknown> & { company_phone: string }>;

      const jobs = jobsRaw.map(({ company_phone, ...rest }) => ({
        ...rest,
        masked_phone: maskPhone(company_phone),
      }));

      res.json({ city, companies, jobs });
    } catch (err) {
      console.error('GET /api/cities/:slug error:', err);
      res.status(500).json({ error: 'Failed to load city details' });
    }
  });

  app.get('/api/companies', (_req, res) => {
    try {
      const rows = db
        .prepare(
          `
        SELECT co.id, co.city_id, co.name_es, co.sector_ar, co.sector_es, co.sector_fr, co.phone,
          co.operator_info_ar, co.operator_info_es, co.operator_info_fr,
          c.name_ar as city_name_ar, c.name_es as city_name_es, c.name_fr as city_name_fr, c.slug as city_slug
        FROM companies co
        JOIN cities c ON co.city_id = c.id
        WHERE co.is_active = 1 AND c.is_active = 1
        ORDER BY c.display_order ASC, co.id ASC
      `
        )
        .all() as Array<Record<string, unknown> & { phone: string }>;

      const companies = rows.map(({ phone, ...rest }) => ({
        ...rest,
        masked_phone: maskPhone(phone),
      }));
      res.json(companies);
    } catch (err) {
      console.error('GET /api/companies error:', err);
      res.status(500).json({ error: 'Failed to load companies' });
    }
  });

  app.get('/api/jobs', (req, res) => {
    try {
      const cityId = req.query.cityId ? Number(req.query.cityId) : null;
      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

      let sql = `
        SELECT j.*, co.name_es as company_name_es, co.phone as company_phone,
          co.operator_info_ar, co.operator_info_es, co.operator_info_fr,
          c.slug as city_slug, c.name_ar as city_name_ar, c.name_es as city_name_es, c.name_fr as city_name_fr
        FROM job_offers j
        JOIN companies co ON j.company_id = co.id
        JOIN cities c ON j.city_id = c.id
        WHERE j.status = 'active' AND co.is_active = 1 AND c.is_active = 1
      `;
      const params: unknown[] = [];

      if (cityId && Number.isFinite(cityId)) {
        sql += ' AND j.city_id = ?';
        params.push(cityId);
      }
      if (category) {
        sql += ' AND (j.category_ar = ? OR j.category_es = ? OR j.category_fr = ?)';
        params.push(category, category, category);
      }
      sql += ' ORDER BY j.id DESC';

      const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown> & { company_phone: string }>;
      const jobs = rows.map(({ company_phone, ...rest }) => ({
        ...rest,
        masked_phone: maskPhone(company_phone),
      }));
      res.json(jobs);
    } catch (err) {
      console.error('GET /api/jobs error:', err);
      res.status(500).json({ error: 'Failed to load jobs' });
    }
  });

  app.get('/api/jobs/:id', (req, res) => {
    try {
      const jobId = Number(req.params.id);
      if (!Number.isFinite(jobId)) {
        res.status(400).json({ error: 'Invalid job ID' });
        return;
      }

      const row = db
        .prepare(
          `
        SELECT j.*, co.name_es as company_name_es, co.phone as company_phone,
          co.operator_info_ar, co.operator_info_es, co.operator_info_fr,
          c.slug as city_slug, c.name_ar as city_name_ar, c.name_es as city_name_es, c.name_fr as city_name_fr
        FROM job_offers j
        JOIN companies co ON j.company_id = co.id
        JOIN cities c ON j.city_id = c.id
        WHERE j.id = ? AND j.status = 'active'
      `
        )
        .get(jobId) as (Record<string, unknown> & { company_phone: string }) | undefined;

      if (!row) {
        res.status(404).json({ error: 'Job offer not found' });
        return;
      }

      const conditions = db
        .prepare(
          `
        SELECT * FROM conditions
        WHERE is_active = 1 AND (job_offer_id IS NULL OR job_offer_id = ?)
        ORDER BY job_offer_id DESC, display_order ASC
      `
        )
        .all(jobId);

      const { company_phone, ...jobPublic } = row;
      res.json({
        job: {
          ...jobPublic,
          masked_phone: maskPhone(company_phone),
        },
        conditions,
      });
    } catch (err) {
      console.error('GET /api/jobs/:id error:', err);
      res.status(500).json({ error: 'Failed to load job offer' });
    }
  });

  // Access code verification (server-side only)
  app.post('/api/access-codes/verify', codeLimiter, (req, res) => {
    try {
      const codeInput = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      const jobOfferId = Number(req.body?.jobOfferId);

      if (!codeInput || !Number.isFinite(jobOfferId)) {
        res.status(400).json({ valid: false, error: 'Code and job offer are required' });
        return;
      }

      const row = db
        .prepare('SELECT * FROM access_codes WHERE UPPER(code) = ?')
        .get(codeInput) as
        | {
            id: number;
            code: string;
            job_offer_id: number | null;
            max_uses: number;
            used_count: number;
            expires_at: string | null;
            is_active: number;
          }
        | undefined;

      if (!row || !row.is_active) {
        res.status(403).json({ valid: false, error: 'Invalid or disabled access code' });
        return;
      }

      if (row.job_offer_id !== null && row.job_offer_id !== jobOfferId) {
        res.status(403).json({ valid: false, error: 'This access code is not valid for this job offer' });
        return;
      }

      if (row.used_count >= row.max_uses) {
        res.status(403).json({ valid: false, error: 'Access code usage limit reached' });
        return;
      }

      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        res.status(403).json({ valid: false, error: 'Access code has expired' });
        return;
      }

      const uploadGrant = signUploadGrant(row.id, jobOfferId);
      res.json({ valid: true, uploadGrant });
    } catch (err) {
      console.error('POST /api/access-codes/verify error:', err);
      res.status(500).json({ valid: false, error: 'Verification error' });
    }
  });

  // Pre-upload document endpoint (requires verified uploadGrant)
  app.post(
    '/api/documents/upload',
    submitLimiter,
    uploadMemory.single('file'),
    (req, res) => {
      try {
        const grantToken = String(req.body?.uploadGrant || req.headers['x-upload-grant'] || '');
        const docType = String(req.body?.docType || '');
        const grant = verifyUploadGrant(grantToken);

        if (!grant) {
          res.status(403).json({ error: 'Access code verification required before uploading documents' });
          return;
        }
        if (!['cv', 'motivation', 'certificate'].includes(docType)) {
          res.status(400).json({ error: 'Invalid document type' });
          return;
        }
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'No file provided' });
          return;
        }
        const ext = ALLOWED_DOC_MIMES[file.mimetype];
        if (!ext || !matchesMagicBytes(file.buffer, file.mimetype)) {
          res.status(400).json({ error: 'Unsupported or corrupted file format (allowed: PDF, DOCX, DOC, JPG, PNG)' });
          return;
        }

        const storedName = `${crypto.randomUUID()}${ext}`;
        const destPath = path.resolve(storageDir, storedName);
        if (!destPath.startsWith(storageDir + path.sep)) {
          res.status(400).json({ error: 'Invalid storage path' });
          return;
        }
        fs.writeFileSync(destPath, file.buffer);

        res.json({
          uploaded: true,
          fileMeta: {
            docType,
            originalName: path.basename(file.originalname).slice(0, 120),
            storedName,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
      } catch (err) {
        console.error('POST /api/documents/upload error:', err);
        res.status(500).json({ error: 'Document upload failed' });
      }
    }
  );

  // Submit application (supports multipart files OR pre-uploaded fileMeta JSON, verified by server)
  app.post(
    '/api/applications',
    submitLimiter,
    uploadMemory.fields([
      { name: 'cv', maxCount: 1 },
      { name: 'motivation', maxCount: 1 },
      { name: 'certificate', maxCount: 1 },
    ]),
    (req, res) => {
      try {
        const jobOfferId = Number(req.body?.jobOfferId);
        const fullName = String(req.body?.fullName || '').trim();
        const whatsapp = String(req.body?.whatsapp || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const hasSectorExperience =
          req.body?.hasSectorExperience === true ||
          req.body?.hasSectorExperience === 'true' ||
          req.body?.hasSectorExperience === '1' ||
          req.body?.hasSectorExperience === 'yes';
        const uploadGrantToken = String(req.body?.uploadGrant || '');

        if (!Number.isFinite(jobOfferId) || fullName.length < 2 || whatsapp.length < 6) {
          res.status(400).json({ error: 'Please provide valid full name, WhatsApp number, and job offer.' });
          return;
        }

        const job = db
          .prepare(
            "SELECT j.id, j.company_id, j.city_id, j.category_ar, c.name_ar as city_name_ar FROM job_offers j JOIN cities c ON j.city_id = c.id WHERE j.id = ? AND j.status = 'active'"
          )
          .get(jobOfferId) as
          | { id: number; company_id: number; city_id: number; category_ar: string; city_name_ar: string }
          | undefined;

        if (!job) {
          res.status(404).json({ error: 'Selected job offer is not active or does not exist.' });
          return;
        }

        const filesObj = (req.files || {}) as Record<string, Express.Multer.File[]>;
        const directFiles: Array<{ docType: string; file: Express.Multer.File }> = [];
        for (const docType of ['cv', 'motivation', 'certificate']) {
          if (filesObj[docType]?.[0]) {
            directFiles.push({ docType, file: filesObj[docType][0] });
          }
        }

        let preUploadedDocs: Array<{
          docType: string;
          originalName: string;
          storedName: string;
          mimeType: string;
          sizeBytes: number;
        }> = [];
        if (typeof req.body?.uploadedDocs === 'string' && req.body.uploadedDocs.trim()) {
          try {
            const parsed = JSON.parse(req.body.uploadedDocs);
            if (Array.isArray(parsed)) preUploadedDocs = parsed;
          } catch {
            res.status(400).json({ error: 'Invalid uploadedDocs payload' });
            return;
          }
        }

        let verifiedAccessCodeId: number | null = null;
        if (directFiles.length > 0 || preUploadedDocs.length > 0 || uploadGrantToken) {
          const grant = verifyUploadGrant(uploadGrantToken);
          if (!grant || grant.jobOfferId !== jobOfferId) {
            res.status(403).json({ error: 'Valid Access Code verification is required for document uploads.' });
            return;
          }

          // Re-verify access code capacity atomically inside transaction
          const codeRow = db
            .prepare('SELECT id, max_uses, used_count, is_active, expires_at FROM access_codes WHERE id = ?')
            .get(grant.accessCodeId) as
            | { id: number; max_uses: number; used_count: number; is_active: number; expires_at: string | null }
            | undefined;
          if (
            !codeRow ||
            !codeRow.is_active ||
            codeRow.used_count >= codeRow.max_uses ||
            (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now())
          ) {
            res.status(403).json({ error: 'Access code is no longer valid or has reached its limit.' });
            return;
          }
          verifiedAccessCodeId = codeRow.id;
        }

        // Validate direct files before touching DB
        const savedDocsToInsert: Array<{
          docType: string;
          originalName: string;
          storedName: string;
          mimeType: string;
          sizeBytes: number;
        }> = [];

        for (const item of directFiles) {
          const ext = ALLOWED_DOC_MIMES[item.file.mimetype];
          if (!ext || !matchesMagicBytes(item.file.buffer, item.file.mimetype)) {
            res.status(400).json({ error: `Invalid file type for ${item.docType}. Allowed: PDF, DOCX, DOC, JPG, PNG.` });
            return;
          }
          const storedName = `${crypto.randomUUID()}${ext}`;
          const destPath = path.resolve(storageDir, storedName);
          if (!destPath.startsWith(storageDir + path.sep)) {
            res.status(400).json({ error: 'Invalid storage path' });
            return;
          }
          fs.writeFileSync(destPath, item.file.buffer);
          savedDocsToInsert.push({
            docType: item.docType,
            originalName: path.basename(item.file.originalname).slice(0, 120),
            storedName,
            mimeType: item.file.mimetype,
            sizeBytes: item.file.size,
          });
        }

        for (const doc of preUploadedDocs) {
          const safeName = path.basename(String(doc.storedName || ''));
          const resolved = path.resolve(storageDir, safeName);
          if (
            ['cv', 'motivation', 'certificate'].includes(doc.docType) &&
            /^[a-f0-9-]+\.[a-z]+$/i.test(safeName) &&
            resolved.startsWith(storageDir + path.sep) &&
            fs.existsSync(resolved)
          ) {
            savedDocsToInsert.push({
              docType: doc.docType,
              originalName: path.basename(String(doc.originalName || safeName)).slice(0, 120),
              storedName: safeName,
              mimeType: String(doc.mimeType || 'application/octet-stream'),
              sizeBytes: Number(doc.sizeBytes || 0),
            });
          }
        }

        const refCode = `ESP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const tx = db.transaction(() => {
          const userId = upsertRegisteredUser({
            fullName,
            whatsapp,
            email,
            cityPreference: job.city_name_ar || String(job.city_id),
            sectorPreference: job.category_ar,
            source: 'application',
          });

          const appRes = db
            .prepare(
              `
            INSERT INTO applications (
              reference_code, user_id, job_offer_id, company_id, city_id,
              full_name, whatsapp, has_sector_experience, access_code_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
          `
            )
            .run(
              refCode,
              userId,
              job.id,
              job.company_id,
              job.city_id,
              fullName,
              whatsapp,
              hasSectorExperience ? 1 : 0,
              verifiedAccessCodeId
            );

          const appId = appRes.lastInsertRowid;
          const insertDoc = db.prepare(`
            INSERT INTO documents (application_id, doc_type, original_name, stored_name, mime_type, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const d of savedDocsToInsert) {
            insertDoc.run(appId, d.docType, d.originalName, d.storedName, d.mimeType, d.sizeBytes);
          }

          if (verifiedAccessCodeId !== null && savedDocsToInsert.length > 0) {
            db.prepare("UPDATE access_codes SET used_count = used_count + 1, last_used_at = datetime('now') WHERE id = ?").run(
              verifiedAccessCodeId
            );
          }

          return appId;
        });

        const applicationId = tx();
        res.status(201).json({
          success: true,
          applicationId,
          referenceCode: refCode,
          documentsCount: savedDocsToInsert.length,
        });
      } catch (err) {
        console.error('POST /api/applications error:', err);
        res.status(500).json({ error: 'Failed to submit application' });
      }
    }
  );

  app.post('/api/contact', submitLimiter, (req, res) => {
    try {
      const fullName = String(req.body?.fullName || '').trim();
      const email = String(req.body?.email || '').trim();
      const whatsapp = String(req.body?.whatsapp || '').trim();
      const subject = String(req.body?.subject || '').trim();
      const message = String(req.body?.message || '').trim();

      if (fullName.length < 2 || !email.includes('@') || message.length < 5) {
        res.status(400).json({ error: 'Please complete all required contact fields.' });
        return;
      }

      db.prepare(
        'INSERT INTO contact_messages (full_name, email, whatsapp, subject, message) VALUES (?, ?, ?, ?, ?)'
      ).run(fullName, email, whatsapp, subject, message);

      upsertRegisteredUser({
        fullName,
        whatsapp,
        email,
        sectorPreference: subject,
        source: 'contact',
      });

      res.status(201).json({ success: true });
    } catch (err) {
      console.error('POST /api/contact error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Direct Candidate Registration endpoint (Email + Code + Profile, persisted permanently for Admin)
  app.post('/api/register', submitLimiter, (req, res) => {
    try {
      const fullName = String(req.body?.fullName || '').trim();
      const whatsapp = String(req.body?.whatsapp || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const code = String(req.body?.code || '').trim();
      const cityPreference = String(req.body?.cityPreference || '').trim();
      const sectorPreference = String(req.body?.sectorPreference || 'الخياطة وصناعة الملابس').trim();
      const experienceYears = String(req.body?.experienceYears || '').trim();

      if (!email.includes('@') || code.length < 4 || fullName.length < 2 || whatsapp.length < 6) {
        res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني والكود (4 أحرف على الأقل) والاسم الكامل ورقم WhatsApp.' });
        return;
      }

      // Check if entered code matches an active admin-issued Access Code
      const matchedAccessCode = db
        .prepare('SELECT code FROM access_codes WHERE upper(code) = upper(?) AND is_active = 1 LIMIT 1')
        .get(code) as { code: string } | undefined;

      const codeHash = hashPassword(code);
      const registrationCodeLabel = matchedAccessCode ? matchedAccessCode.code : 'كود شخصي مفعّل';

      const userId = upsertRegisteredUser({
        fullName,
        whatsapp,
        email,
        cityPreference,
        sectorPreference,
        experienceYears,
        source: 'registration',
        codeHash,
        registrationCodeLabel,
      });

      res.status(201).json({
        success: true,
        userId,
        email,
        codeStatus: registrationCodeLabel,
      });
    } catch (err) {
      console.error('POST /api/register error:', err);
      res.status(500).json({ error: 'Failed to register candidate' });
    }
  });

  // Candidate Email + Code Sign-In (returns saved profile and linked applications)
  app.post('/api/users/login', authLimiter, (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const code = String(req.body?.code || '').trim();

      if (!email.includes('@') || !code) {
        res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني والكود.' });
        return;
      }

      const user = db
        .prepare(
          'SELECT id, full_name, whatsapp, email, city_preference, sector_preference, experience_years, code_hash, registration_code_label, created_at FROM users WHERE lower(email) = ? LIMIT 1'
        )
        .get(email) as
        | {
            id: number;
            full_name: string;
            whatsapp: string;
            email: string;
            city_preference: string | null;
            sector_preference: string;
            experience_years: string;
            code_hash: string;
            registration_code_label: string;
            created_at: string;
          }
        | undefined;

      if (!user || !user.code_hash || !verifyPassword(code, user.code_hash)) {
        res.status(401).json({ error: 'البريد الإلكتروني أو الكود غير صحيح.' });
        return;
      }

      const apps = db
        .prepare(
          `
        SELECT a.id, a.reference_code, a.status, a.created_at, j.title_ar, co.name_es as company_name_es, c.name_ar as city_name_ar
        FROM applications a
        JOIN job_offers j ON a.job_offer_id = j.id
        JOIN companies co ON a.company_id = co.id
        JOIN cities c ON a.city_id = c.id
        WHERE a.user_id = ?
        ORDER BY a.id DESC
      `
        )
        .all(user.id);

      const { code_hash: _omit, ...safeUser } = user;
      res.json({ user: safeUser, applications: apps });
    } catch (err) {
      console.error('POST /api/users/login error:', err);
      res.status(500).json({ error: 'Sign-in failed' });
    }
  });

  // =========================================================================
  // ADMIN AUTH ROUTES
  // =========================================================================

  app.get('/api/admin/auth/status', (_req, res) => {
    const count = (db.prepare('SELECT COUNT(*) as c FROM admins').get() as { c: number }).c;
    const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    res.json({
      needsSetup: count === 0 && !hasEnvPasscode,
      hasEnvPasscode,
    });
  });

  app.post('/api/admin/auth/setup', authLimiter, (req, res) => {
    try {
      const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
      if (hasEnvPasscode) {
        res.status(403).json({ error: 'Setup is disabled when ADMIN_PASSCODE environment secret is configured.' });
        return;
      }
      const count = (db.prepare('SELECT COUNT(*) as c FROM admins').get() as { c: number }).c;
      if (count > 0) {
        res.status(403).json({ error: 'Admin account already exists. Please sign in.' });
        return;
      }

      const email = String(req.body?.email || '').trim().toLowerCase();
      const name = String(req.body?.name || 'مدير المنصة').trim();
      const password = String(req.body?.password || '');

      if (!email.includes('@') || password.length < 8) {
        res.status(400).json({ error: 'Valid email and password (min 8 chars) required.' });
        return;
      }

      const hash = hashPassword(password);
      const info = db
        .prepare("INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, 'super_admin')")
        .run(email, name, hash);

      const adminId = Number(info.lastInsertRowid);
      const token = signToken({ sub: `admin:${adminId}`, adminId, email, name, role: 'super_admin' });

      logAudit({
        adminId,
        adminEmail: email,
        action: 'ADMIN_SETUP',
        targetType: 'admins',
        targetId: adminId,
        details: 'Initial super admin account claimed',
        ipAddress: getClientIp(req),
      });

      res.status(201).json({
        token,
        admin: { id: adminId, email, name, role: 'super_admin' },
      });
    } catch (err) {
      console.error('POST /api/admin/auth/setup error:', err);
      res.status(500).json({ error: 'Admin setup failed' });
    }
  });

  app.post('/api/admin/auth/login', authLimiter, (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      // Check ADMIN_PASSCODE override if configured
      if (password && verifyEnvPasscode(password)) {
        const token = signToken({
          sub: 'env-admin',
          adminId: null,
          email: email || 'admin@system',
          name: 'System Administrator',
          role: 'super_admin',
        });
        logAudit({
          adminId: null,
          adminEmail: email || 'env-admin',
          action: 'ADMIN_LOGIN',
          targetType: 'auth',
          details: 'Logged in with environment passcode',
          ipAddress: getClientIp(req),
        });
        res.json({
          token,
          admin: { id: 0, email: email || 'admin@system', name: 'System Administrator', role: 'super_admin' },
        });
        return;
      }

      if (!password) {
        res.status(400).json({ error: 'Password or admin code is required' });
        return;
      }

      type AdminRow = { id: number; email: string; name: string; password_hash: string; role: string };
      let admin: AdminRow | undefined;

      if (email) {
        const candidate = db.prepare('SELECT * FROM admins WHERE LOWER(email) = ?').get(email) as AdminRow | undefined;
        if (candidate && verifyPassword(password, candidate.password_hash)) {
          admin = candidate;
        }
      } else {
        const allAdmins = db.prepare('SELECT * FROM admins ORDER BY id ASC').all() as AdminRow[];
        admin = allAdmins.find((row) => verifyPassword(password, row.password_hash));
      }

      if (!admin) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = signToken({
        sub: `admin:${admin.id}`,
        adminId: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      });

      logAudit({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ADMIN_LOGIN',
        targetType: 'auth',
        ipAddress: getClientIp(req),
      });

      res.json({
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      });
    } catch (err) {
      console.error('POST /api/admin/auth/login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/admin/auth/me', requireAdmin, (req: AdminRequest, res) => {
    res.json({ admin: req.admin });
  });

  // =========================================================================
  // ADMIN PROTECTED MANAGEMENT ROUTES
  // =========================================================================

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    try {
      const totalApplications = (db.prepare('SELECT COUNT(*) as c FROM applications').get() as { c: number }).c;
      const totalCandidates = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
      const activeJobs = (db.prepare("SELECT COUNT(*) as c FROM job_offers WHERE status = 'active'").get() as { c: number }).c;
      const totalCities = (db.prepare('SELECT COUNT(*) as c FROM cities WHERE is_active = 1').get() as { c: number }).c;
      const totalDocuments = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as { c: number }).c;
      const newApplications = (db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'new'").get() as { c: number }).c;
      const processedApplications = (
        db.prepare("SELECT COUNT(*) as c FROM applications WHERE status != 'new'").get() as { c: number }
      ).c;
      const unreadMessages = (db.prepare("SELECT COUNT(*) as c FROM contact_messages WHERE status = 'new'").get() as { c: number }).c;

      const recentApplications = db
        .prepare(
          `
        SELECT a.*, c.name_ar as city_name_ar, co.name_es as company_name_es, j.title_ar as job_title_ar
        FROM applications a
        JOIN cities c ON a.city_id = c.id
        JOIN companies co ON a.company_id = co.id
        JOIN job_offers j ON a.job_offer_id = j.id
        ORDER BY a.id DESC LIMIT 6
      `
        )
        .all();

      const recentAuditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8').all();

      res.json({
        metrics: {
          totalApplications,
          totalCandidates,
          activeJobs,
          totalCities,
          totalDocuments,
          newApplications,
          processedApplications,
          unreadMessages,
        },
        recentApplications,
        recentAuditLogs,
      });
    } catch (err) {
      console.error('GET /api/admin/overview error:', err);
      res.status(500).json({ error: 'Failed to load dashboard overview' });
    }
  });

  // Upload image assets (logo, sliders, cities, testimonials, about)
  app.post('/api/admin/upload-asset', requireAdmin, uploadMemory.single('image'), (req: AdminRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Image file required' });
        return;
      }
      const ext = ALLOWED_IMG_MIMES[file.mimetype];
      if (!ext || !matchesMagicBytes(file.buffer, file.mimetype)) {
        res.status(400).json({ error: 'Invalid image format (allowed: JPG, PNG, WEBP)' });
        return;
      }
      const filename = `asset_${crypto.randomUUID()}${ext}`;
      const dest = path.resolve(assetsDir, filename);
      if (!dest.startsWith(assetsDir + path.sep)) {
        res.status(400).json({ error: 'Invalid destination path' });
        return;
      }
      fs.writeFileSync(dest, file.buffer);
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'UPLOAD_ASSET',
        targetType: 'assets',
        targetId: filename,
        ipAddress: getClientIp(req),
      });
      res.json({ url: `/api/assets/${filename}` });
    } catch (err) {
      console.error('POST /api/admin/upload-asset error:', err);
      res.status(500).json({ error: 'Asset upload failed' });
    }
  });

  // Cities CRUD
  app.get('/api/admin/cities', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM cities ORDER BY display_order ASC, id ASC').all();
    res.json(rows);
  });

  app.post('/api/admin/cities', requireAdmin, (req: AdminRequest, res) => {
    try {
      const b = req.body || {};
      const slug = String(b.slug || b.name_es || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      if (!slug || !b.name_ar || !b.name_es) {
        res.status(400).json({ error: 'City slug, Arabic name, and Spanish name are required' });
        return;
      }
      const info = db
        .prepare(
          `
        INSERT INTO cities (slug, name_ar, name_es, name_fr, description_ar, description_es, description_fr, image_url, map_x, map_y, dot_color, is_active, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          slug,
          String(b.name_ar),
          String(b.name_es),
          String(b.name_fr || b.name_es),
          String(b.description_ar || ''),
          String(b.description_es || ''),
          String(b.description_fr || ''),
          String(b.image_url || ''),
          Number(b.map_x ?? 50),
          Number(b.map_y ?? 50),
          b.dot_color === 'red' ? 'red' : 'orange',
          b.is_active === false || b.is_active === 0 ? 0 : 1,
          Number(b.display_order ?? 99)
        );
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'CREATE_CITY',
        targetType: 'cities',
        targetId: info.lastInsertRowid.toString(),
        details: String(b.name_es),
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
      console.error('POST /api/admin/cities error:', err);
      res.status(400).json({ error: 'Could not create city (check duplicate slug)' });
    }
  });

  app.put('/api/admin/cities/:id', requireAdmin, (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      db.prepare(
        `
        UPDATE cities SET
          name_ar = COALESCE(?, name_ar),
          name_es = COALESCE(?, name_es),
          name_fr = COALESCE(?, name_fr),
          description_ar = COALESCE(?, description_ar),
          description_es = COALESCE(?, description_es),
          description_fr = COALESCE(?, description_fr),
          image_url = COALESCE(?, image_url),
          map_x = COALESCE(?, map_x),
          map_y = COALESCE(?, map_y),
          dot_color = COALESCE(?, dot_color),
          is_active = COALESCE(?, is_active),
          display_order = COALESCE(?, display_order)
        WHERE id = ?
      `
      ).run(
        b.name_ar ?? null,
        b.name_es ?? null,
        b.name_fr ?? null,
        b.description_ar ?? null,
        b.description_es ?? null,
        b.description_fr ?? null,
        b.image_url ?? null,
        b.map_x !== undefined ? Number(b.map_x) : null,
        b.map_y !== undefined ? Number(b.map_y) : null,
        b.dot_color ? (b.dot_color === 'red' ? 'red' : 'orange') : null,
        b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
        b.display_order !== undefined ? Number(b.display_order) : null,
        id
      );
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'UPDATE_CITY',
        targetType: 'cities',
        targetId: id,
        ipAddress: getClientIp(req),
      });
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/admin/cities/:id error:', err);
      res.status(500).json({ error: 'Failed to update city' });
    }
  });

  app.delete('/api/admin/cities/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM cities WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_CITY',
      targetType: 'cities',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Companies CRUD (Admin sees full phone)
  app.get('/api/admin/companies', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT co.*, c.name_ar as city_name_ar, c.name_es as city_name_es,
        (SELECT COUNT(*) FROM job_offers j WHERE j.company_id = co.id) as jobs_count
      FROM companies co
      JOIN cities c ON co.city_id = c.id
      ORDER BY co.id DESC
    `
      )
      .all();
    res.json(rows);
  });

  app.post('/api/admin/companies', requireAdmin, (req: AdminRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.city_id || !b.name_es || !b.sector_ar || !b.phone) {
        res.status(400).json({ error: 'City, Spanish company name, sector, and phone are required' });
        return;
      }
      const info = db
        .prepare(
          `
        INSERT INTO companies (city_id, name_es, sector_ar, sector_es, sector_fr, phone, operator_info_ar, operator_info_es, operator_info_fr, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          Number(b.city_id),
          String(b.name_es),
          String(b.sector_ar),
          String(b.sector_es || b.sector_ar),
          String(b.sector_fr || b.sector_ar),
          String(b.phone),
          String(b.operator_info_ar || ''),
          String(b.operator_info_es || ''),
          String(b.operator_info_fr || ''),
          b.is_active === false || b.is_active === 0 ? 0 : 1
        );
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'CREATE_COMPANY',
        targetType: 'companies',
        targetId: info.lastInsertRowid.toString(),
        details: String(b.name_es),
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
      console.error('POST /api/admin/companies error:', err);
      res.status(500).json({ error: 'Failed to create company' });
    }
  });

  app.put('/api/admin/companies/:id', requireAdmin, (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      db.prepare(
        `
        UPDATE companies SET
          city_id = COALESCE(?, city_id),
          name_es = COALESCE(?, name_es),
          sector_ar = COALESCE(?, sector_ar),
          sector_es = COALESCE(?, sector_es),
          sector_fr = COALESCE(?, sector_fr),
          phone = COALESCE(?, phone),
          operator_info_ar = COALESCE(?, operator_info_ar),
          operator_info_es = COALESCE(?, operator_info_es),
          operator_info_fr = COALESCE(?, operator_info_fr),
          is_active = COALESCE(?, is_active)
        WHERE id = ?
      `
      ).run(
        b.city_id !== undefined ? Number(b.city_id) : null,
        b.name_es ?? null,
        b.sector_ar ?? null,
        b.sector_es ?? null,
        b.sector_fr ?? null,
        b.phone ?? null,
        b.operator_info_ar ?? null,
        b.operator_info_es ?? null,
        b.operator_info_fr ?? null,
        b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
        id
      );
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'UPDATE_COMPANY',
        targetType: 'companies',
        targetId: id,
        ipAddress: getClientIp(req),
      });
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/admin/companies/:id error:', err);
      res.status(500).json({ error: 'Failed to update company' });
    }
  });

  app.delete('/api/admin/companies/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_COMPANY',
      targetType: 'companies',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Job Offers CRUD
  app.get('/api/admin/jobs', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT j.*, co.name_es as company_name_es, c.name_ar as city_name_ar, c.name_es as city_name_es
      FROM job_offers j
      JOIN companies co ON j.company_id = co.id
      JOIN cities c ON j.city_id = c.id
      ORDER BY j.id DESC
    `
      )
      .all();
    res.json(rows);
  });

  app.post('/api/admin/jobs', requireAdmin, (req: AdminRequest, res) => {
    try {
      const b = req.body || {};
      const company = db.prepare('SELECT id, city_id FROM companies WHERE id = ?').get(Number(b.company_id)) as
        | { id: number; city_id: number }
        | undefined;
      if (!company || !b.title_ar) {
        res.status(400).json({ error: 'Valid company and job title are required' });
        return;
      }
      const cityId = Number(b.city_id || company.city_id);
      const info = db
        .prepare(
          `
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          company.id,
          cityId,
          String(b.title_ar),
          String(b.title_es || b.title_ar),
          String(b.title_fr || b.title_ar),
          String(b.category_ar || 'الخدمات'),
          String(b.category_es || b.category_ar || 'Servicios'),
          String(b.category_fr || b.category_ar || 'Services'),
          String(b.description_ar || ''),
          String(b.description_es || b.description_ar || ''),
          String(b.description_fr || b.description_ar || ''),
          String(b.contract_type_ar || 'عقد عمل مؤقت قابل للتجديد'),
          String(b.contract_type_es || 'Contrato temporal renovable'),
          String(b.contract_type_fr || 'Contrat temporaire renouvelable'),
          Number(b.positions_count ?? 5),
          String(b.application_question_ar || 'هل ترغب في التقدم للحصول على عقد عمل لدى هذه الشركة؟'),
          String(b.application_question_es || '¿Desea postularse para esta oferta de empleo?'),
          String(b.application_question_fr || 'Souhaitez-vous postuler pour cette offre d’emploi ?'),
          String(b.experience_question_ar || 'هل سبق لك العمل في هذا المجال في المغرب؟'),
          String(b.experience_question_es || '¿Tiene experiencia previa en este sector en Marruecos?'),
          String(b.experience_question_fr || 'Avez-vous déjà travaillé dans ce secteur au Maroc ?'),
          ['active', 'paused', 'expired', 'review'].includes(b.status) ? b.status : 'active',
          b.expires_at || null
        );
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'CREATE_JOB',
        targetType: 'job_offers',
        targetId: info.lastInsertRowid.toString(),
        details: String(b.title_ar),
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
      console.error('POST /api/admin/jobs error:', err);
      res.status(500).json({ error: 'Failed to create job offer' });
    }
  });

  app.put('/api/admin/jobs/:id', requireAdmin, (req: AdminRequest, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      db.prepare(
        `
        UPDATE job_offers SET
          company_id = COALESCE(?, company_id),
          city_id = COALESCE(?, city_id),
          title_ar = COALESCE(?, title_ar),
          title_es = COALESCE(?, title_es),
          title_fr = COALESCE(?, title_fr),
          category_ar = COALESCE(?, category_ar),
          category_es = COALESCE(?, category_es),
          category_fr = COALESCE(?, category_fr),
          description_ar = COALESCE(?, description_ar),
          description_es = COALESCE(?, description_es),
          description_fr = COALESCE(?, description_fr),
          contract_type_ar = COALESCE(?, contract_type_ar),
          contract_type_es = COALESCE(?, contract_type_es),
          contract_type_fr = COALESCE(?, contract_type_fr),
          positions_count = COALESCE(?, positions_count),
          application_question_ar = COALESCE(?, application_question_ar),
          experience_question_ar = COALESCE(?, experience_question_ar),
          status = COALESCE(?, status),
          expires_at = COALESCE(?, expires_at)
        WHERE id = ?
      `
      ).run(
        b.company_id !== undefined ? Number(b.company_id) : null,
        b.city_id !== undefined ? Number(b.city_id) : null,
        b.title_ar ?? null,
        b.title_es ?? null,
        b.title_fr ?? null,
        b.category_ar ?? null,
        b.category_es ?? null,
        b.category_fr ?? null,
        b.description_ar ?? null,
        b.description_es ?? null,
        b.description_fr ?? null,
        b.contract_type_ar ?? null,
        b.contract_type_es ?? null,
        b.contract_type_fr ?? null,
        b.positions_count !== undefined ? Number(b.positions_count) : null,
        b.application_question_ar ?? null,
        b.experience_question_ar ?? null,
        b.status && ['active', 'paused', 'expired', 'review'].includes(b.status) ? b.status : null,
        b.expires_at ?? null,
        id
      );
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'UPDATE_JOB',
        targetType: 'job_offers',
        targetId: id,
        ipAddress: getClientIp(req),
      });
      res.json({ success: true });
    } catch (err) {
      console.error('PUT /api/admin/jobs/:id error:', err);
      res.status(500).json({ error: 'Failed to update job offer' });
    }
  });

  app.delete('/api/admin/jobs/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM job_offers WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_JOB',
      targetType: 'job_offers',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Conditions CRUD
  app.get('/api/admin/conditions', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT cond.*, j.title_ar as job_title_ar
      FROM conditions cond
      LEFT JOIN job_offers j ON cond.job_offer_id = j.id
      ORDER BY cond.display_order ASC, cond.id ASC
    `
      )
      .all();
    res.json(rows);
  });

  app.post('/api/admin/conditions', requireAdmin, (req: AdminRequest, res) => {
    const b = req.body || {};
    if (!b.text_ar) {
      res.status(400).json({ error: 'Arabic text is required' });
      return;
    }
    const info = db
      .prepare(
        'INSERT INTO conditions (job_offer_id, text_ar, text_es, text_fr, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        b.job_offer_id ? Number(b.job_offer_id) : null,
        String(b.text_ar),
        String(b.text_es || b.text_ar),
        String(b.text_fr || b.text_ar),
        Number(b.display_order ?? 10),
        b.is_active === false || b.is_active === 0 ? 0 : 1
      );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'CREATE_CONDITION',
      targetType: 'conditions',
      targetId: info.lastInsertRowid.toString(),
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.put('/api/admin/conditions/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    db.prepare(
      `
      UPDATE conditions SET
        job_offer_id = ?,
        text_ar = COALESCE(?, text_ar),
        text_es = COALESCE(?, text_es),
        text_fr = COALESCE(?, text_fr),
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `
    ).run(
      b.job_offer_id ? Number(b.job_offer_id) : null,
      b.text_ar ?? null,
      b.text_es ?? null,
      b.text_fr ?? null,
      b.display_order !== undefined ? Number(b.display_order) : null,
      b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
      id
    );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_CONDITION',
      targetType: 'conditions',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/conditions/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM conditions WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_CONDITION',
      targetType: 'conditions',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Applications Management
  app.get('/api/admin/applications', requireAdmin, (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const cityId = req.query.cityId ? Number(req.query.cityId) : null;
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let sql = `
      SELECT a.*, c.name_ar as city_name_ar, c.name_es as city_name_es,
        co.name_es as company_name_es, j.title_ar as job_title_ar,
        ac.code as access_code_used
      FROM applications a
      JOIN cities c ON a.city_id = c.id
      JOIN companies co ON a.company_id = co.id
      JOIN job_offers j ON a.job_offer_id = j.id
      LEFT JOIN access_codes ac ON a.access_code_id = ac.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (cityId && Number.isFinite(cityId)) {
      sql += ' AND a.city_id = ?';
      params.push(cityId);
    }
    if (companyId && Number.isFinite(companyId)) {
      sql += ' AND a.company_id = ?';
      params.push(companyId);
    }
    if (search) {
      sql += ' AND (a.full_name LIKE ? OR a.whatsapp LIKE ? OR a.reference_code LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY a.id DESC';

    const apps = db.prepare(sql).all(...params) as Array<Record<string, unknown> & { id: number }>;
    const docStmt = db.prepare('SELECT id, application_id, doc_type, original_name, mime_type, size_bytes, uploaded_at FROM documents WHERE application_id = ?');
    const enriched = apps.map((a) => ({
      ...a,
      documents: docStmt.all(a.id),
    }));
    res.json(enriched);
  });

  app.get('/api/admin/applications/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const appRow = db
      .prepare(
        `
      SELECT a.*, c.name_ar as city_name_ar, co.name_es as company_name_es, j.title_ar as job_title_ar,
        ac.code as access_code_used
      FROM applications a
      JOIN cities c ON a.city_id = c.id
      JOIN companies co ON a.company_id = co.id
      JOIN job_offers j ON a.job_offer_id = j.id
      LEFT JOIN access_codes ac ON a.access_code_id = ac.id
      WHERE a.id = ?
    `
      )
      .get(id);
    if (!appRow) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const documents = db
      .prepare('SELECT id, application_id, doc_type, original_name, mime_type, size_bytes, uploaded_at FROM documents WHERE application_id = ?')
      .all(id);
    res.json({ application: appRow, documents });
  });

  app.put('/api/admin/applications/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const allowedStatuses = ['new', 'reviewed', 'contacted', 'accepted', 'rejected', 'completed'];
    const nextStatus = b.status && allowedStatuses.includes(b.status) ? b.status : null;
    db.prepare(
      `
      UPDATE applications SET
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `
    ).run(nextStatus, b.notes ?? null, id);

    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_APPLICATION',
      targetType: 'applications',
      targetId: id,
      details: `status=${nextStatus || 'unchanged'}`,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/applications/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const docs = db.prepare('SELECT stored_name FROM documents WHERE application_id = ?').all(id) as Array<{
      stored_name: string;
    }>;
    for (const d of docs) {
      const resolved = path.resolve(storageDir, path.basename(d.stored_name));
      if (resolved.startsWith(storageDir + path.sep) && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    }
    db.prepare('DELETE FROM applications WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_APPLICATION',
      targetType: 'applications',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Registered Users / Candidates Directory Management
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const source = typeof req.query.source === 'string' ? req.query.source.trim() : '';

    let sql = `
      SELECT u.id, u.full_name, u.whatsapp, u.email, u.city_preference, u.sector_preference,
        u.experience_years, u.source, u.notes, u.registration_code_label,
        CASE WHEN u.code_hash != '' THEN 1 ELSE 0 END as has_code,
        u.created_at, u.updated_at,
        (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) as applications_count,
        (SELECT a.reference_code FROM applications a WHERE a.user_id = u.id ORDER BY a.id DESC LIMIT 1) as latest_reference_code
      FROM users u
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (source) {
      sql += ' AND u.source = ?';
      params.push(source);
    }
    if (search) {
      sql += ' AND (u.full_name LIKE ? OR u.whatsapp LIKE ? OR u.email LIKE ? OR u.city_preference LIKE ? OR u.sector_preference LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    sql += ' ORDER BY u.id DESC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  });

  app.get('/api/admin/users/export', requireAdmin, (req: AdminRequest, res) => {
    const rows = db
      .prepare(
        `
      SELECT u.*,
        (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) as applications_count
      FROM users u
      ORDER BY u.id DESC
    `
      )
      .all() as Array<Record<string, unknown>>;

    const sanitizeCsvCell = (val: unknown): string => {
      const s = String(val ?? '');
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const headers = ['ID', 'Full Name', 'WhatsApp', 'Email', 'City', 'Sector', 'Experience', 'Source', 'Applications', 'Notes', 'Registered At'];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.id,
          r.full_name,
          r.whatsapp,
          r.email,
          r.city_preference,
          r.sector_preference,
          r.experience_years,
          r.source,
          r.applications_count,
          r.notes,
          r.created_at,
        ]
          .map(sanitizeCsvCell)
          .join(',')
      ),
    ];

    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'EXPORT_USERS_CSV',
      targetType: 'users',
      details: `count=${rows.length}`,
      ipAddress: getClientIp(req),
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="registered-candidates.csv"');
    res.send('\uFEFF' + lines.join('\r\n'));
  });

  app.put('/api/admin/users/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    db.prepare(
      `
      UPDATE users SET
        full_name = COALESCE(?, full_name),
        whatsapp = COALESCE(?, whatsapp),
        email = COALESCE(?, email),
        city_preference = COALESCE(?, city_preference),
        sector_preference = COALESCE(?, sector_preference),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
      WHERE id = ?
    `
    ).run(
      b.full_name ?? null,
      b.whatsapp ?? null,
      b.email ?? null,
      b.city_preference ?? null,
      b.sector_preference ?? null,
      b.notes ?? null,
      id
    );

    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_USER',
      targetType: 'users',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/users/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_USER',
      targetType: 'users',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Access Codes Management
  app.get('/api/admin/access-codes', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT ac.*, j.title_ar as job_title_ar,
        (SELECT COUNT(*) FROM applications a WHERE a.access_code_id = ac.id) as linked_applications_count
      FROM access_codes ac
      LEFT JOIN job_offers j ON ac.job_offer_id = j.id
      ORDER BY ac.id DESC
    `
      )
      .all();
    res.json(rows);
  });

  app.post('/api/admin/access-codes', requireAdmin, (req: AdminRequest, res) => {
    try {
      const b = req.body || {};
      const rawCode =
        typeof b.code === 'string' && b.code.trim()
          ? b.code.trim().toUpperCase()
          : `ESP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const maxUses = Math.max(1, Number(b.max_uses ?? 1));
      const jobOfferId = b.job_offer_id ? Number(b.job_offer_id) : null;
      const expiresAt = b.expires_at ? String(b.expires_at) : null;

      const info = db
        .prepare(
          'INSERT INTO access_codes (code, job_offer_id, max_uses, expires_at, is_active) VALUES (?, ?, ?, ?, 1)'
        )
        .run(rawCode, jobOfferId, maxUses, expiresAt);

      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'CREATE_ACCESS_CODE',
        targetType: 'access_codes',
        targetId: info.lastInsertRowid.toString(),
        details: `code=${rawCode}, maxUses=${maxUses}`,
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ id: info.lastInsertRowid, code: rawCode });
    } catch (err) {
      console.error('POST /api/admin/access-codes error:', err);
      res.status(400).json({ error: 'Could not create access code (check duplicate code)' });
    }
  });

  app.put('/api/admin/access-codes/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    db.prepare(
      `
      UPDATE access_codes SET
        is_active = COALESCE(?, is_active),
        max_uses = COALESCE(?, max_uses),
        expires_at = ?
      WHERE id = ?
    `
    ).run(
      b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
      b.max_uses !== undefined ? Math.max(1, Number(b.max_uses)) : null,
      b.expires_at !== undefined ? b.expires_at : null,
      id
    );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_ACCESS_CODE',
      targetType: 'access_codes',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/access-codes/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM access_codes WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_ACCESS_CODE',
      targetType: 'access_codes',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Protected Documents Management
  app.get('/api/admin/documents', requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT d.id, d.application_id, d.doc_type, d.original_name, d.mime_type, d.size_bytes, d.uploaded_at,
        a.full_name as candidate_name, a.reference_code, a.whatsapp
      FROM documents d
      JOIN applications a ON d.application_id = a.id
      ORDER BY d.id DESC
    `
      )
      .all();
    res.json(rows);
  });

  app.get('/api/admin/documents/:id/download', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as
      | { id: number; original_name: string; stored_name: string; mime_type: string }
      | undefined;
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const safeStored = path.basename(doc.stored_name);
    const resolved = path.resolve(storageDir, safeStored);
    if (!resolved.startsWith(storageDir + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Document file missing from storage' });
      return;
    }

    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DOWNLOAD_DOCUMENT',
      targetType: 'documents',
      targetId: id,
      details: doc.original_name,
      ipAddress: getClientIp(req),
    });

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`
    );
    res.sendFile(resolved);
  });

  app.delete('/api/admin/documents/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const doc = db.prepare('SELECT stored_name, original_name FROM documents WHERE id = ?').get(id) as
      | { stored_name: string; original_name: string }
      | undefined;
    if (doc) {
      const resolved = path.resolve(storageDir, path.basename(doc.stored_name));
      if (resolved.startsWith(storageDir + path.sep) && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
      db.prepare('DELETE FROM documents WHERE id = ?').run(id);
      logAudit({
        adminId: req.admin?.adminId,
        adminEmail: req.admin?.email,
        action: 'DELETE_DOCUMENT',
        targetType: 'documents',
        targetId: id,
        details: doc.original_name,
        ipAddress: getClientIp(req),
      });
    }
    res.json({ success: true });
  });

  // Sliders CRUD
  app.get('/api/admin/sliders', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM sliders ORDER BY display_order ASC, id ASC').all());
  });

  app.post('/api/admin/sliders', requireAdmin, (req: AdminRequest, res) => {
    const b = req.body || {};
    if (!b.title_ar || !b.image_url) {
      res.status(400).json({ error: 'Title and image URL are required' });
      return;
    }
    const info = db
      .prepare(
        'INSERT INTO sliders (title_ar, title_es, title_fr, subtitle_ar, subtitle_es, subtitle_fr, image_url, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        String(b.title_ar),
        String(b.title_es || b.title_ar),
        String(b.title_fr || b.title_ar),
        String(b.subtitle_ar || ''),
        String(b.subtitle_es || ''),
        String(b.subtitle_fr || ''),
        String(b.image_url),
        Number(b.display_order ?? 10),
        b.is_active === false || b.is_active === 0 ? 0 : 1
      );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'CREATE_SLIDER',
      targetType: 'sliders',
      targetId: info.lastInsertRowid.toString(),
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.put('/api/admin/sliders/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    db.prepare(
      `
      UPDATE sliders SET
        title_ar = COALESCE(?, title_ar),
        title_es = COALESCE(?, title_es),
        title_fr = COALESCE(?, title_fr),
        subtitle_ar = COALESCE(?, subtitle_ar),
        subtitle_es = COALESCE(?, subtitle_es),
        subtitle_fr = COALESCE(?, subtitle_fr),
        image_url = COALESCE(?, image_url),
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `
    ).run(
      b.title_ar ?? null,
      b.title_es ?? null,
      b.title_fr ?? null,
      b.subtitle_ar ?? null,
      b.subtitle_es ?? null,
      b.subtitle_fr ?? null,
      b.image_url ?? null,
      b.display_order !== undefined ? Number(b.display_order) : null,
      b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
      id
    );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_SLIDER',
      targetType: 'sliders',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/sliders/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM sliders WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_SLIDER',
      targetType: 'sliders',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Testimonials CRUD
  app.get('/api/admin/testimonials', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM testimonials ORDER BY display_order ASC, id DESC').all());
  });

  app.post('/api/admin/testimonials', requireAdmin, (req: AdminRequest, res) => {
    const b = req.body || {};
    if (!b.client_name || !b.quote_ar) {
      res.status(400).json({ error: 'Client name and quote are required' });
      return;
    }
    const info = db
      .prepare(
        `
      INSERT INTO testimonials (client_name, city_or_service_ar, city_or_service_es, city_or_service_fr, quote_ar, quote_es, quote_fr, avatar_url, is_approved, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        String(b.client_name),
        String(b.city_or_service_ar || ''),
        String(b.city_or_service_es || b.city_or_service_ar || ''),
        String(b.city_or_service_fr || b.city_or_service_ar || ''),
        String(b.quote_ar),
        String(b.quote_es || b.quote_ar),
        String(b.quote_fr || b.quote_ar),
        String(b.avatar_url || '/src/assets/images/testimonial_portrait_1_1795347962944.jpg'),
        b.is_approved === false || b.is_approved === 0 ? 0 : 1,
        Number(b.display_order ?? 10)
      );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'CREATE_TESTIMONIAL',
      targetType: 'testimonials',
      targetId: info.lastInsertRowid.toString(),
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.put('/api/admin/testimonials/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    db.prepare(
      `
      UPDATE testimonials SET
        client_name = COALESCE(?, client_name),
        city_or_service_ar = COALESCE(?, city_or_service_ar),
        city_or_service_es = COALESCE(?, city_or_service_es),
        city_or_service_fr = COALESCE(?, city_or_service_fr),
        quote_ar = COALESCE(?, quote_ar),
        quote_es = COALESCE(?, quote_es),
        quote_fr = COALESCE(?, quote_fr),
        avatar_url = COALESCE(?, avatar_url),
        is_approved = COALESCE(?, is_approved),
        display_order = COALESCE(?, display_order)
      WHERE id = ?
    `
    ).run(
      b.client_name ?? null,
      b.city_or_service_ar ?? null,
      b.city_or_service_es ?? null,
      b.city_or_service_fr ?? null,
      b.quote_ar ?? null,
      b.quote_es ?? null,
      b.quote_fr ?? null,
      b.avatar_url ?? null,
      b.is_approved !== undefined ? (b.is_approved ? 1 : 0) : null,
      b.display_order !== undefined ? Number(b.display_order) : null,
      id
    );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_TESTIMONIAL',
      targetType: 'testimonials',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/testimonials/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'DELETE_TESTIMONIAL',
      targetType: 'testimonials',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Statistics Management
  app.get('/api/admin/statistics', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM statistics ORDER BY display_order ASC, id ASC').all() as Array<{
      id: number;
      key_name: string;
      manual_value: number;
      use_dynamic: number;
    }>;
    res.json(
      rows.map((s) => ({
        ...s,
        computed_value: computeDynamicStat(s.key_name, s.manual_value),
      }))
    );
  });

  app.put('/api/admin/statistics/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    db.prepare(
      `
      UPDATE statistics SET
        label_ar = COALESCE(?, label_ar),
        label_es = COALESCE(?, label_es),
        label_fr = COALESCE(?, label_fr),
        manual_value = COALESCE(?, manual_value),
        use_dynamic = COALESCE(?, use_dynamic),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `
    ).run(
      b.label_ar ?? null,
      b.label_es ?? null,
      b.label_fr ?? null,
      b.manual_value !== undefined ? Number(b.manual_value) : null,
      b.use_dynamic !== undefined ? (b.use_dynamic ? 1 : 0) : null,
      b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
      id
    );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_STATISTIC',
      targetType: 'statistics',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  // Site Settings & Home Section Ordering/Visibility
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    const row = db.prepare("SELECT value_json FROM site_settings WHERE key = 'main'").get() as
      | { value_json: string }
      | undefined;
    res.json(row ? JSON.parse(row.value_json) : {});
  });

  app.put('/api/admin/settings', requireAdmin, (req: AdminRequest, res) => {
    const currentRow = db.prepare("SELECT value_json FROM site_settings WHERE key = 'main'").get() as
      | { value_json: string }
      | undefined;
    const current = currentRow ? JSON.parse(currentRow.value_json) : {};
    const merged = { ...current, ...(req.body || {}) };
    db.prepare("INSERT OR REPLACE INTO site_settings (key, value_json, updated_at) VALUES ('main', ?, datetime('now'))").run(
      JSON.stringify(merged)
    );
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_SETTINGS',
      targetType: 'site_settings',
      targetId: 'main',
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, settings: merged });
  });

  // Contact Messages Management
  app.get('/api/admin/contact-messages', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM contact_messages ORDER BY id DESC').all());
  });

  app.put('/api/admin/contact-messages/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const status = ['new', 'read', 'resolved'].includes(req.body?.status) ? req.body.status : 'read';
    db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, id);
    logAudit({
      adminId: req.admin?.adminId,
      adminEmail: req.admin?.email,
      action: 'UPDATE_CONTACT_MESSAGE',
      targetType: 'contact_messages',
      targetId: id,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true });
  });

  app.delete('/api/admin/contact-messages/:id', requireAdmin, (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Audit Logs
  app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
    res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all());
  });
}

import React, { useState } from 'react';
import { CheckCircle2, FileText, KeyRound, Lock, ShieldCheck, Unlock, Upload, X } from 'lucide-react';
import { tField, UI_TEXT } from '../i18n';
import type { JobOffer, Language } from '../types';

interface ApplicationModalProps {
  job: JobOffer;
  lang: Language;
  onClose: () => void;
}

interface UploadedFileMeta {
  docType: 'cv' | 'motivation' | 'certificate';
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
}

export const ApplicationModal: React.FC<ApplicationModalProps> = ({ job, lang, onClose }) => {
  const t = UI_TEXT[lang];
  const [step, setStep] = useState<'confirm' | 'form' | 'success'>('confirm');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [hasExperience, setHasExperience] = useState<'yes' | 'no'>('yes');

  const [accessCode, setAccessCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [uploadGrant, setUploadGrant] = useState<string | null>(null);

  const [uploadedDocs, setUploadedDocs] = useState<Partial<Record<'cv' | 'motivation' | 'certificate', UploadedFileMeta>>>({});
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');

  const handleVerifyCode = async () => {
    if (!accessCode.trim()) return;
    setVerifyingCode(true);
    setCodeError('');
    try {
      const res = await fetch('/api/access-codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode.trim(), jobOfferId: job.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCodeError(data.error || 'Invalid access code');
        setUploadGrant(null);
      } else {
        setUploadGrant(data.uploadGrant);
      }
    } catch {
      setCodeError('Connection error while verifying access code');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleFileUpload = async (docType: 'cv' | 'motivation' | 'certificate', file: File | null) => {
    if (!file || !uploadGrant) return;
    setUploadingSlot(docType);
    setCodeError('');
    try {
      const formData = new FormData();
      formData.append('uploadGrant', uploadGrant);
      formData.append('docType', docType);
      formData.append('file', file);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.uploaded) {
        setCodeError(data.error || 'Upload failed');
      } else {
        setUploadedDocs((prev) => ({ ...prev, [docType]: data.fileMeta }));
      }
    } catch {
      setCodeError('Network error uploading document');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (fullName.trim().length < 2 || whatsapp.trim().length < 6) {
      setSubmitError(lang === 'ar' ? 'يرجى إدخال الاسم الكامل ورقم WhatsApp صحيح.' : 'Please complete required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const docsList = Object.values(uploadedDocs).filter(Boolean);
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobOfferId: job.id,
          fullName: fullName.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          hasSectorExperience: hasExperience === 'yes',
          uploadGrant: uploadGrant || '',
          uploadedDocs: JSON.stringify(docsList),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to submit application');
      } else {
        setReferenceCode(data.referenceCode);
        setStep('success');
      }
    } catch {
      setSubmitError('Network error submitting application');
    } finally {
      setSubmitting(false);
    }
  };

  const docSlots: Array<{ key: 'cv' | 'motivation' | 'certificate'; label: string }> = [
    { key: 'cv', label: t.cvLabel },
    { key: 'motivation', label: t.motivationLabel },
    { key: 'certificate', label: t.certificateLabel },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#121316] text-white shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 bg-[#18191E]">
          <div>
            <p className="text-xs text-[#C81E1E] font-bold">
              {job.company_name_es} · {tField(job, 'city_name', lang)}
            </p>
            <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
              {tField(job, 'title', lang)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-neutral-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {step === 'confirm' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-[#C81E1E]/15 border border-[#C81E1E]/30 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-[#C81E1E]" />
              </div>
              <h4 className="text-xl sm:text-2xl font-bold text-white leading-relaxed max-w-lg mx-auto">
                {tField(job, 'application_question', lang)}
              </h4>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="px-6 py-3 rounded-lg bg-[#C81E1E] text-white font-bold text-sm hover:bg-[#A61717] transition-colors"
                >
                  {t.yesApply}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-lg bg-[#1F2127] border border-white/10 text-neutral-200 font-semibold text-sm hover:bg-white/10 transition-colors"
                >
                  {t.noThanks}
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmitApplication} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-2">
                    {t.fullName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1B1D22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#C81E1E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-2">
                    {t.whatsapp} *
                  </label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="+212 6..."
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1B1D22] border border-white/10 text-white text-sm font-mono-tabular focus:outline-none focus:border-[#C81E1E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-2">
                    {t.email}
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1B1D22] border border-white/10 text-white text-sm focus:outline-none focus:border-[#C81E1E]"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#18191E] border border-white/10 space-y-3">
                <p className="text-sm font-bold text-white">
                  {tField(job, 'experience_question', lang)}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHasExperience('yes')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      hasExperience === 'yes'
                        ? 'bg-[#C81E1E] text-white border-[#C81E1E]'
                        : 'bg-[#22242A] text-neutral-300 border-white/10'
                    }`}
                  >
                    {t.yes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasExperience('no')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      hasExperience === 'no'
                        ? 'bg-[#C81E1E] text-white border-[#C81E1E]'
                        : 'bg-[#22242A] text-neutral-300 border-white/10'
                    }`}
                  >
                    {t.no}
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#18191E] border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {uploadGrant ? (
                      <Unlock className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-[#C81E1E]" />
                    )}
                    <h4 className="text-sm font-bold text-white">{t.documentsSectionTitle}</h4>
                  </div>
                  <span className={`text-xs font-semibold ${uploadGrant ? 'text-emerald-400' : 'text-neutral-400'}`}>
                    {uploadGrant ? t.uploadReady : t.locked}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {uploadGrant ? t.documentsUnlockedHint : t.documentsLockedHint}
                </p>

                {!uploadGrant && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3" />
                      <input
                        type="text"
                        dir="ltr"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        placeholder={t.accessCodePlaceholder}
                        className="w-full ps-9 pe-3 py-2.5 rounded-lg bg-[#0E0F12] border border-white/15 text-white text-sm font-mono-tabular uppercase focus:outline-none focus:border-[#C81E1E]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={verifyingCode || !accessCode.trim()}
                      onClick={handleVerifyCode}
                      className="px-5 py-2.5 rounded-lg bg-[#24262B] hover:bg-[#C81E1E] text-white text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {verifyingCode ? t.verifying : t.verifyCode}
                    </button>
                  </div>
                )}

                {codeError && (
                  <p className="text-xs text-red-400 font-semibold">{codeError}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {docSlots.map((slot) => {
                    const uploaded = uploadedDocs[slot.key];
                    const isUploading = uploadingSlot === slot.key;
                    return (
                      <label
                        key={slot.key}
                        className={`relative p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2 min-h-[104px] ${
                          uploadGrant
                            ? 'border-white/20 bg-[#1F2127] hover:border-[#C81E1E] cursor-pointer'
                            : 'border-white/10 bg-[#0E0F12]/70 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <FileText className="w-4 h-4 text-[#C81E1E] shrink-0 mt-0.5" />
                          {!uploadGrant ? (
                            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          ) : uploaded ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white leading-snug">{slot.label}</p>
                          <p className="text-[11px] text-neutral-400 mt-1 truncate">
                            {isUploading
                              ? '...'
                              : uploaded
                              ? uploaded.originalName
                              : uploadGrant
                              ? 'PDF / DOCX / JPG'
                              : t.locked}
                          </p>
                        </div>
                        <input
                          type="file"
                          disabled={!uploadGrant || isUploading}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          className="sr-only"
                          onChange={(e) => handleFileUpload(slot.key, e.target.files?.[0] || null)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-red-400 font-semibold">{submitError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg bg-[#22242A] text-neutral-300 text-xs font-semibold hover:bg-white/10"
                >
                  {t.noThanks}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg bg-[#C81E1E] text-white text-xs sm:text-sm font-bold hover:bg-[#A61717] transition-colors disabled:opacity-50"
                >
                  {submitting ? t.submitting : t.submitApplication}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-2xl font-bold text-white">{t.applicationSuccessTitle}</h4>
              <p className="text-sm text-neutral-300">{t.applicationSuccessDesc}</p>
              <div className="inline-block px-6 py-3 rounded-xl bg-[#1B1D22] border border-white/15 font-mono-tabular text-lg font-bold text-[#C81E1E]">
                {referenceCode}
              </div>
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-7 py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
                >
                  {t.backHome}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiGetSettings, apiUpdateSettings } from '@/lib/api/settings';
import type { StoreSettings } from '@/lib/api/settings';
import type { ApiError } from '@/lib/api/client';
import SettingsTabs from './SettingsTabs';

function Skeleton() {
  return (
    <div className="dash-form-card">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="dash-field">
          <span className="dash-skeleton" style={{ width: 90, height: 11 }} />
          <span className="dash-skeleton" style={{ width: '100%', height: 36, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

type BrandForm = {
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
};

type SettingsForm = {
  currency: string;
  locale: string;
  vatPct: string;
  brand: BrandForm;
};

function settingsToForm(s: StoreSettings): SettingsForm {
  return {
    currency: s.currency,
    locale: s.locale,
    vatPct: String(s.taxRules.find((r) => r.country === 'EG')?.vatPct ?? 14),
    brand: {
      storeName: s.brand.storeName,
      contactEmail: s.brand.contactEmail,
      contactPhone: s.brand.contactPhone ?? '',
      logoUrl: s.brand.logoUrl ?? '',
    },
  };
}

export default function SettingsClient() {
  const [form, setForm] = useState<SettingsForm>({
    currency: 'EGP',
    locale: 'ar-EG',
    vatPct: '14',
    brand: { storeName: '', contactEmail: '', contactPhone: '', logoUrl: '' },
  });
  const [raw, setRaw] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiGetSettings();
      setRaw(data);
      setForm(settingsToForm(data));
    } catch (e) {
      setLoadError((e as ApiError).message ?? 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (field: keyof Omit<SettingsForm, 'brand'>) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => { setSaved(false); setForm((p) => ({ ...p, [field]: e.target.value })); };

  const setBrand = (field: keyof BrandForm) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => { setSaved(false); setForm((p) => ({ ...p, brand: { ...p.brand, [field]: e.target.value } })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raw) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const patch: Partial<StoreSettings> = {
        currency: form.currency,
        locale: form.locale,
        brand: {
          storeName: form.brand.storeName,
          contactEmail: form.brand.contactEmail,
          contactPhone: form.brand.contactPhone || null,
          logoUrl: form.brand.logoUrl || null,
        },
        taxRules: raw.taxRules.map((r) =>
          r.country === 'EG' ? { ...r, vatPct: parseFloat(form.vatPct) || r.vatPct } : r,
        ),
      };
      const updated = await apiUpdateSettings(patch);
      setRaw(updated);
      setForm(settingsToForm(updated));
      setSaved(true);
    } catch (err) {
      setSaveError((err as ApiError).message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton />;
  if (loadError) {
    return (
      <div className="dash-card">
        <p className="dash-inline-error">{loadError}</p>
        <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Settings</h1>
      </div>

      <SettingsTabs />

      <form onSubmit={handleSubmit}>
        <div className="dash-form-card">
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label">Store name <span className="dash-required">*</span></label>
              <input type="text" className="dash-input" value={form.brand.storeName} onChange={setBrand('storeName')} required />
            </div>
            <div className="dash-field">
              <label className="dash-label">Currency</label>
              <input type="text" className="dash-input" value={form.currency} onChange={setField('currency')} placeholder="EGP" maxLength={3} />
              <p className="dash-help-text">ISO 4217 — e.g. EGP, USD</p>
            </div>
          </div>

          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label">Contact Email</label>
              <input type="email" className="dash-input" value={form.brand.contactEmail} onChange={setBrand('contactEmail')} />
            </div>
            <div className="dash-field">
              <label className="dash-label">Contact Phone</label>
              <input type="text" className="dash-input" value={form.brand.contactPhone} onChange={setBrand('contactPhone')} placeholder="+20…" />
            </div>
          </div>

          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label">VAT % (Egypt)</label>
              <input type="number" className="dash-input" value={form.vatPct} onChange={setField('vatPct')} min="0" max="100" step="0.01" />
            </div>
            <div className="dash-field">
              <label className="dash-label">Locale</label>
              <input type="text" className="dash-input" value={form.locale} onChange={setField('locale')} placeholder="ar-EG" />
              <p className="dash-help-text">BCP 47 — e.g. ar-EG, en-US</p>
            </div>
          </div>

          <div className="dash-field">
            <label className="dash-label">Logo URL</label>
            <input type="url" className="dash-input" value={form.brand.logoUrl} onChange={setBrand('logoUrl')} placeholder="https://…" />
            <p className="dash-help-text">Leave blank to use the default wordmark.</p>
          </div>

          {saveError && <p className="dash-inline-error">{saveError}</p>}

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span style={{ fontSize: 13, color: 'var(--mr-st-ok-fg)' }}>Saved</span>}
          </div>
        </div>
      </form>
    </>
  );
}

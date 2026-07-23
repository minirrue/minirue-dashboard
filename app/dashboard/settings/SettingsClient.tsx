'use client';

import React, {useState, useCallback, useRef } from 'react';
import { apiGetSettings, apiUpdateSettings, apiUploadBrandLogo } from '@/lib/api/settings';
import type { StoreSettings } from '@/lib/api/settings';
import type { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/hooks/use-auth';
import { apiUpdateMyProfile, apiUploadMyAvatar } from '@/lib/api/auth';
import { useQueryClient } from '@tanstack/react-query';
import RoleBadge from '@/components/dashboard/RoleBadge';
import DataResetPanel from '@/components/dashboard/DataResetPanel';
import SuperAdminPanel from '@/components/dashboard/SuperAdminPanel';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function AdminProfileCard({ onLogoUploaded }: { onLogoUploaded: () => void }) {
  const { data: user, isLoading } = useUser();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useMountedEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    setNameError(null);
    try {
      const updated = await apiUpdateMyProfile(name.trim());
      queryClient.setQueryData(['auth', 'me'], updated);
    } catch (e) {
      setNameError((e as ApiError).message ?? 'Failed to save name');
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const updated = await apiUploadMyAvatar(file);
      queryClient.setQueryData(['auth', 'me'], updated);
    } catch (err) {
      setAvatarError((err as ApiError).message ?? 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    setAvatarError(null);
    try {
      await apiUploadBrandLogo(file);
      onLogoUploaded();
    } catch (err) {
      setAvatarError((err as ApiError).message ?? 'Failed to upload brand logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="dash-form-card" style={{ marginBottom: 20 }}>
        <span className="dash-skeleton" style={{ width: 200, height: 60 }} />
      </div>
    );
  }

  return (
    <div className="dash-form-card" style={{ marginBottom: 20 }}>
      <h2 className="dash-section-title" style={{ marginBottom: 16 }}>Profile</h2>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="dash-enlargeable-image-btn"
            onClick={() => avatarInputRef.current?.click()}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid var(--mr-dash-hair)',
              background: 'var(--mr-dash-sub)',
              padding: 0,
              cursor: 'pointer',
            }}
            title="Change avatar"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ margin: '20px auto' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          <span className="dash-help-text" style={{ fontSize: 11 }}>
            {uploadingAvatar ? 'Uploading…' : 'Tap to change'}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="dash-field" style={{ marginBottom: 12 }}>
            <label className="dash-label">Your name</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="dash-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
              <button
                type="button"
                className="dash-btn-secondary"
                disabled={savingName || !name.trim() || name.trim() === user.name}
                onClick={handleSaveName}
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
            {nameError && <p className="dash-inline-error">{nameError}</p>}
          </div>
          <RoleBadge role={user.role} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="dash-enlargeable-image-btn"
            onClick={() => logoInputRef.current?.click()}
            style={{
              width: 72,
              height: 72,
              borderRadius: 'var(--mr-radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--mr-dash-hair)',
              background: 'var(--mr-dash-sub)',
              padding: 0,
              cursor: 'pointer',
            }}
            title="Change brand logo"
          >
            {/* Logo preview intentionally left blank here — form below shows the live value */}
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ margin: '20px auto' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: 'none' }}
            onChange={handleLogoChange}
          />
          <span className="dash-help-text" style={{ fontSize: 11 }}>
            {uploadingLogo ? 'Uploading…' : 'Brand logo'}
          </span>
        </div>
      </div>
      {avatarError && <p className="dash-inline-error">{avatarError}</p>}
    </div>
  );
}

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
    // Optional-chained: a store with no tax rules yet (a fresh database) returns
    // settings with no taxRules key at all, and an unguarded .find() there took
    // the whole Settings page down with "Cannot read properties of undefined".
    vatPct: String(s.taxRules?.find((r) => r.country === 'EG')?.vatPct ?? 14),
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

  useMountedEffect(() => { load(); }, [load]);

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
        // A fresh store has no tax rules at all. Mapping over an empty/absent
        // list would silently save no VAT rule and lose what the admin typed,
        // so create the EG rule when it is missing rather than dropping it.
        taxRules: (() => {
          const existing = raw.taxRules ?? [];
          const vatPct = parseFloat(form.vatPct);
          if (!existing.some((r) => r.country === 'EG')) {
            return [
              ...existing,
              { country: 'EG', vatPct: Number.isFinite(vatPct) ? vatPct : 14 },
            ];
          }
          return existing.map((r) =>
            r.country === 'EG'
              ? { ...r, vatPct: Number.isFinite(vatPct) ? vatPct : r.vatPct }
              : r,
          );
        })(),
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

      <AdminProfileCard onLogoUploaded={load} />

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

      {/* Owner-and-above only; hides itself on a 403 like the panel below. */}
      <SuperAdminPanel />

      {/* Renders nothing unless the signed-in account is a super admin AND the
          environment allows a reset — the panel asks the server and hides
          itself on a 403 (specs 2026-07-22-platform-reset). */}
      <DataResetPanel />
    </>
  );
}

'use client';

import React, {useState, useCallback, useRef } from 'react';
import { apiGetSettings, apiUpdateSettings, apiUploadBrandLogo } from '@/lib/api/settings';
import type { StoreSettings } from '@/lib/api/settings';
import type { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/hooks/use-auth';
import { apiUpdateMyProfile, apiUploadMyAvatar } from '@/lib/api/auth';
import { useQueryClient } from '@tanstack/react-query';
import { Role } from '@/lib/auth/role';
import RoleBadge from '@/components/dashboard/RoleBadge';
import DataResetPanel from '@/components/dashboard/DataResetPanel';
import SuperAdminPanel from '@/components/dashboard/SuperAdminPanel';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import { GenericAvatarIcon } from '@/components/GenericAvatarIcon';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';

/**
 * Exported (not just used locally) so the profile-by-role tests can render it
 * directly with a mocked `useUser()` rather than standing up the whole
 * Settings page.
 */
export function AdminProfileCard({
  logoUrl,
  onLogoUploaded,
}: {
  /** The store's current resolved brand logo URL, or null/empty if unset —
   *  lifted from SettingsClient's `raw.brand.logoUrl` so this tile can show
   *  the real image instead of a permanent placeholder icon. */
  logoUrl: string | null;
  onLogoUploaded: (updated: StoreSettings) => void;
}) {
  const { data: user, isLoading } = useUser();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Task FF (2026-07-30), hardened 2026-07-31 after an owner report on the
  // storefront's equivalent card ("upload succeeded, but the account still
  // showed the generic icon"): the cropped bytes for an avatar just uploaded
  // THIS session, so the tile renders locally instead of a
  // guaranteed-cold-miss remote fetch of the exact bytes the browser is
  // already holding.
  //
  // `uploadedAvatarUrl` is tracked in STATE (not only a ref) because the
  // render below must not gate on `user?.avatarUrl` alone — a component test
  // on the storefront's identical pattern (ProfileForm.tsx) proved that if
  // that value from `useUser()` lags even one render behind the upload, for
  // any reason, gating on it alone silently discards local bytes that were
  // sitting right there and falls back to the generic icon. `avatarSrc`
  // below reads our own known-good URL as a fallback so the icon can never
  // mask a photo this session knows was just uploaded.
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  // Same pattern for the brand logo: the tile below used to render a fixed
  // placeholder SVG NO MATTER WHAT — never the real logo, uploaded or not,
  // and never an error unless one happened to also touch the shared
  // `avatarError` state. An admin who uploaded a logo had zero visual
  // confirmation it worked short of scrolling to the unrelated "Logo URL"
  // text field far down the page, so a real success and a swallowed failure
  // looked identical. `pendingLogoFile`/`uploadedLogoUrl` let this tile show
  // the just-uploaded bytes immediately, same as the avatar above.
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string | null>(null);

  // `user.name` is deliberately the GREETING form — first name only, business
  // rule shared with every "Hi, {name}" in the app (see auth.controller.ts's
  // `me()`). Editing that here and saving it back would silently truncate
  // any multi-word name to its first word the moment this effect re-ran off
  // a fresh `/auth/me` fetch — which is exactly what the owner reported
  // ("typed MINI RUE, it saved MINI"). `user.fullName` is the untouched
  // stored value; older cached responses without it fall back to `name`.
  useMountedEffect(() => {
    const full = user?.fullName ?? user?.name;
    if (full) setName(full);
  }, [user?.fullName, user?.name]);

  // Only clear on a CONFLICTING truthy value (a different account via "sign
  // in as", a real external change) — never merely because `user?.avatarUrl`
  // hasn't caught up to ours yet, which would silently reproduce the bug.
  useMountedEffect(() => {
    if (uploadedAvatarUrl !== null && user?.avatarUrl && user.avatarUrl !== uploadedAvatarUrl) {
      setPendingAvatarFile(null);
      setUploadedAvatarUrl(null);
    }
  }, [user?.avatarUrl, uploadedAvatarUrl]);

  useMountedEffect(() => {
    if (uploadedLogoUrl !== null && logoUrl && logoUrl !== uploadedLogoUrl) {
      setPendingLogoFile(null);
      setUploadedLogoUrl(null);
    }
  }, [logoUrl, uploadedLogoUrl]);

  const avatarSrc = user?.avatarUrl ?? uploadedAvatarUrl;
  const logoSrc = logoUrl ?? uploadedLogoUrl;

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

  const cropImage = useImageCrop();
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Avatars render as a circle, so the cropper opens square; the free crop
    // and every other ratio are still available.
    const cropped = await cropImage(file, { title: 'Crop your photo', initialAspect: 1 });
    if (!cropped) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const updated = await apiUploadMyAvatar(cropped);
      queryClient.setQueryData(['auth', 'me'], updated);
      setUploadedAvatarUrl(updated.avatarUrl ?? null);
      setPendingAvatarFile(cropped);
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
    // SVG logos are vector — cropping would rasterise them, so they pass
    // straight through; raster logos get the same crop step as everything else.
    const cropped =
      file.type === 'image/svg+xml'
        ? file
        : await cropImage(file, { title: 'Crop shop logo' });
    if (!cropped) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const updated = await apiUploadBrandLogo(cropped);
      setUploadedLogoUrl(updated.brand?.logoUrl ?? null);
      setPendingLogoFile(cropped);
      onLogoUploaded(updated);
    } catch (err) {
      setLogoError((err as ApiError).message ?? 'Failed to upload brand logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="dash-form-card" style={{ marginBottom: 20 }}>
        <span className="dash-skeleton" style={{ width: '100%', maxWidth: 200, height: 60 }} />
      </div>
    );
  }

  // Super Admin is a platform-level account, not a store persona: it has no
  // face to put on a support message and no store to put a logo on. The name
  // field and RoleBadge stay for every role (a Super Admin still needs to set
  // their own name) — only the avatar and brand-logo tiles are role-gated.
  const isSuperAdmin = user.role === Role.SUPERADMIN;

  return (
    <div className="dash-form-card" style={{ marginBottom: 20 }}>
      <h2 className="dash-section-title" style={{ marginBottom: 16 }}>Profile</h2>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {!isSuperAdmin && (
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
              {avatarSrc ? (
                <UploadPreviewImage
                  src={avatarSrc}
                  localFile={pendingAvatarFile}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <GenericAvatarIcon size={32} style={{ margin: '20px auto' }} />
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
        )}

        <div style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}>
          <div className="dash-field" style={{ marginBottom: 12 }}>
            <label className="dash-label">Your name</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                className="dash-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                style={{ flex: '1 1 140px', minWidth: 0 }}
              />
              <button
                type="button"
                className="dash-btn-secondary"
                disabled={savingName || !name.trim() || name.trim() === (user.fullName ?? user.name)}
                onClick={handleSaveName}
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
            {nameError && <p className="dash-inline-error">{nameError}</p>}
          </div>
          <RoleBadge role={user.role} />
        </div>

        {/* This tile edits the STORE's logo (StoreSettings.brand.logoUrl below),
            not a personal picture — that is precisely why it has no business
            on a platform-level Super Admin account, which belongs to no
            single store. Collaborators get their own equivalent (their own
            brand's logo) in CollabBrandClient.tsx, alongside a personal
            avatar of their own. */}
        {!isSuperAdmin && (
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
              {logoSrc ? (
                <UploadPreviewImage
                  src={logoSrc}
                  localFile={pendingLogoFile}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ margin: '20px auto' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
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
            {logoError && (
              <p className="dash-inline-error" style={{ fontSize: 11, textAlign: 'center' }}>{logoError}</p>
            )}
          </div>
        )}
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
          <span className="dash-skeleton" style={{ width: '100%', maxWidth: 90, height: 11 }} />
          <span className="dash-skeleton" style={{ width: '100%', height: 36, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

type BrandForm = {
  /**
   * The ONE admin-editable shop display name (2026-07-31 owner ask: "i want
   * to set freely MINI RUE" — free casing, free internal spaces, no
   * slugifying). Read by the storefront header/footer, the support chat
   * sender name (staff and admin alike), and this dashboard's own chrome —
   * see `useShopName` (lib/hooks/use-shop-name.ts). Sent as `null` (not an
   * empty string) when blank, so the backend's `nullable().min(1)` schema
   * treats it as "unconfigured" rather than rejecting an empty write.
   */
  displayName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
};

type SettingsForm = {
  currency: string;
  vatPct: string;
  brand: BrandForm;
  /** What MiniRue charges to ship, in major units as typed (e.g. "50.00"). */
  shippingFlatRate: string;
  /** Order subtotal at or above which shipping is free. Blank or 0 disables it. */
  shippingFreeOver: string;
};

/** Minor units (what the API stores) to a major-unit string for an input. */
function centsToInput(cents: number | undefined | null): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return (cents / 100).toFixed(2);
}

/** Major units as typed back to integer minor units. */
function inputToCents(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

function settingsToForm(s: StoreSettings): SettingsForm {
  return {
    currency: s.currency,
    // Optional-chained: a store with no tax rules yet (a fresh database) returns
    // settings with no taxRules key at all, and an unguarded .find() there took
    // the whole Settings page down with "Cannot read properties of undefined".
    vatPct: String(s.taxRules?.find((r) => r.country === 'EG')?.vatPct ?? 14),
    // Optional-chained like taxRules above: a settings document that comes back
    // without a `brand` object (older row, or a partial save response) made
    // `s.brand.storeName` throw and crashed the page with a React error right
    // as the admin saved the shop name.
    brand: {
      displayName: s.brand?.displayName ?? '',
      contactEmail: s.brand?.contactEmail ?? '',
      contactPhone: s.brand?.contactPhone ?? '',
      logoUrl: s.brand?.logoUrl ?? '',
    },
    // Blank when unset, so the form shows the server default rather than
    // pretending the admin chose 0.
    shippingFlatRate: centsToInput(s.shipping?.flatRateCents),
    shippingFreeOver: centsToInput(s.shipping?.freeOverCents),
  };
}

export default function SettingsClient() {
  const [form, setForm] = useState<SettingsForm>({
    currency: 'EGP',
    vatPct: '14',
    brand: { displayName: '', contactEmail: '', contactPhone: '', logoUrl: '' },
    shippingFlatRate: '',
    shippingFreeOver: '',
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

  // Used by AdminProfileCard after a logo upload. Deliberately does NOT go
  // through `load()` — `load()` flips `loading` back to true, which blanks
  // this whole page (including the profile card that just updated) behind
  // <Skeleton /> for the round trip. The upload response already IS the
  // fresh settings document, so apply it directly.
  const applyUpdatedSettings = useCallback((updated: StoreSettings) => {
    setRaw(updated);
    setForm(settingsToForm(updated));
  }, []);

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
        // `locale` is deliberately NOT sent here: the field was removed from
        // this form (owner request, 2026-07-31) but the stored value is still
        // read by nothing in-app today — see git history / task report for
        // what was checked. Omitting the key (not sending `locale: undefined`)
        // means the merge in settings.service.ts's updateSettings leaves
        // whatever is already stored untouched, rather than blanking it.
        // Only sent when a rate has been typed: sending 0 for a blank field would
        // silently make shipping free for the whole store.
        ...(form.shippingFlatRate.trim()
          ? {
              shipping: {
                flatRateCents: inputToCents(form.shippingFlatRate),
                currency: form.currency || 'EGP',
                freeOverCents: inputToCents(form.shippingFreeOver),
              },
            }
          : {}),
        brand: {
          // Sent EXACTLY as typed — free casing, free internal spaces
          // ("MINI RUE" must survive as "MINI RUE", never collapsed or
          // title-cased). Only leading/trailing whitespace is trimmed, by
          // the backend's zod schema (update-settings.dto.ts), same as
          // contactPhone/logoUrl below. Blank means "unconfigured": sent as
          // `null`, never `''`, so the nullable-but-required schema key
          // reads as "no display name set" rather than a rejected empty write.
          displayName: form.brand.displayName || null,
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

      <AdminProfileCard logoUrl={raw?.brand?.logoUrl ?? null} onLogoUploaded={applyUpdatedSettings} />

      <form onSubmit={handleSubmit}>
        <div className="dash-form-card">
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label">Shop name</label>
              <input
                type="text"
                className="dash-input"
                value={form.brand.displayName}
                onChange={setBrand('displayName')}
                maxLength={120}
                placeholder="MiniRue"
              />
              {/*
                Owner, 2026-07-31: "highlight the settings name with warning
                that this is your global name across anything" — a visible,
                highlighted callout, not a muted `dash-help-text` hint. This
                is the ONE field that becomes the shop's name everywhere a
                customer or staff member sees it: the storefront header and
                footer, support chat (for the admin AND every staff member —
                staff inherit this one name rather than their own), and this
                dashboard's own chrome. Free casing and free internal spaces
                are preserved exactly as typed ("MINI RUE" stays "MINI RUE") —
                only leading/trailing whitespace is trimmed.
              */}
              <p
                style={{
                  marginTop: 6,
                  padding: '8px 12px',
                  borderRadius: 'var(--mr-radius-sm)',
                  background: 'var(--mr-st-warn-bg)',
                  color: 'var(--mr-st-warn-fg)',
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                This is your shop&apos;s ONE global name. It replaces every other
                spelling everywhere customers see it — the storefront header
                and footer, support chat, and this dashboard — so change it
                carefully.
              </p>
            </div>
          </div>

          <div className="dash-field-row">
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
          </div>

          {/* Shipping was hardcoded in checkout, so what customers were charged
              could only be changed by a deploy. */}
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label">Shipping fee ({form.currency || 'EGP'})</label>
              <input
                type="number"
                className="dash-input"
                value={form.shippingFlatRate}
                onChange={setField('shippingFlatRate')}
                min="0"
                step="0.01"
                placeholder="50.00"
              />
              <p className="dash-help-text">
                Charged on every order. Leave blank to keep the current default.
              </p>
            </div>
            <div className="dash-field">
              <label className="dash-label">Free shipping over ({form.currency || 'EGP'})</label>
              <input
                type="number"
                className="dash-input"
                value={form.shippingFreeOver}
                onChange={setField('shippingFreeOver')}
                min="0"
                step="0.01"
                placeholder="0"
              />
              <p className="dash-help-text">
                Order subtotal at or above which shipping is free. 0 disables it.
              </p>
            </div>
          </div>

          <div className="dash-field">
            {/*
              Field contract (2026-07-31, owner report "logo url is
              forbidden becuase brand logo upload is broken"): this box
              always DISPLAYS the server's resolved link for whatever logo is
              live — normally the file uploaded via the tile above — so an
              admin can copy it out or confirm what is live. Saving it back
              unchanged (the common case: editing an unrelated field like
              currency) is explicitly safe: the backend's
              `resolveBrandLogoForWrite` (settings.service.ts) recognises its
              own resolved URLs on write and re-normalises them back to the
              stable object key, so this round trip can never persist a
              signed/expiring link. Typing a genuinely different,
              externally-hosted image URL here OVERRIDES the uploaded logo
              with that link instead — it is stored and served exactly as
              typed, never touched by that normalisation.
            */}
            <label className="dash-label">Logo URL</label>
            <input type="url" className="dash-input" value={form.brand.logoUrl} onChange={setBrand('logoUrl')} placeholder="https://…" />
            <p className="dash-help-text">
              Shows the logo uploaded above. Leave as-is to keep it, paste a different
              image&apos;s URL to use that instead, or clear it to use the default wordmark.
            </p>
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

'use client';

import React, {useState, useCallback, useRef } from 'react';
import { apiGetSettings, apiUpdateSettings, apiUploadBrandLogo } from '@/lib/api/settings';
import type { InstapayGuide, StoreSettings } from '@/lib/api/settings';
import ImageField from '@/components/dashboard/ImageField';
import './instapay-settings.css';
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
import GovernorateRatesEditor from './GovernorateRatesEditor';
import {
  ratesToDrafts,
  validateGovernorateRates,
  type GovernorateRateDraft,
} from '@/lib/shipping/governorate-rates';

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
  /** Whether this shop charges VAT at all — distinct from a 0% rate. */
  vatEnabled: boolean;
  brand: BrandForm;
  /** What MiniRue charges to ship, in major units as typed (e.g. "50.00"). */
  shippingFlatRate: string;
  /** Order subtotal at or above which shipping is free. Blank or 0 disables it. */
  shippingFreeOver: string;
  /**
   * The per-governorate table mid-edit (minirue-backend#83).
   *
   * Drafts, not wire rows: a draft's fee is a STRING so "not yet typed" stays
   * distinguishable from "zero". See lib/shipping/governorate-rates.ts.
   */
  shippingRates: GovernorateRateDraft[];
  /**
   * Cash-on-delivery limit in major units as typed (minirue-backend#105).
   * Blank means NO limit — COD allowed at any total — which is the default.
   */
  codLimit: string;
  /**
   * The InstaPay payment guide (minirue-backend#170), as strings so a blank
   * field is simply `''` on screen. `instapayFromForm` turns blanks into `null`.
   */
  instapay: InstapayForm;
  /** Trustpilot AFS BCC address. Blank means invitations are disabled. */
  trustpilotBccEmail: string;
};

type InstapayForm = Record<keyof InstapayGuide, string>;

const INSTAPAY_HANDLE_MAX = 64;

function instapayToForm(guide: InstapayGuide | undefined): InstapayForm {
  return {
    payLink: guide?.payLink ?? '',
    handle: guide?.handle ?? '',
    qrMediaUrl: guide?.qrMediaUrl ?? '',
    exampleMediaUrl: guide?.exampleMediaUrl ?? '',
  };
}

/**
 * The guide as the server wants it: all four keys, each trimmed, blank as
 * `null`. Never `''` — an empty string is not a valid https link, and blank
 * means "the storefront uses its defaults".
 */
export function instapayFromForm(form: InstapayForm): InstapayGuide {
  const orNull = (v: string) => v.trim() || null;
  return {
    payLink: orNull(form.payLink),
    handle: orNull(form.handle),
    qrMediaUrl: orNull(form.qrMediaUrl),
    exampleMediaUrl: orNull(form.exampleMediaUrl),
  };
}

/** True for a well-formed https:// URL — the only kind the server accepts. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

/**
 * The shipping block's `currency`, in the only shape the server accepts.
 *
 * `ShippingConfigSchema` validates `^[A-Z]{3}$`, and the Currency field on this
 * page is free text — so an admin who types "egp" (or leaves a trailing space,
 * or clears it) would have the WHOLE settings document rejected by zod, losing
 * the governorate table and every other edit in the same save along with it.
 * Coerced here rather than fought over, in the spirit of `sanitizeHeroColor`.
 */
/**
 * The stored COD limit as the field shows it: blank for "no limit".
 *
 * `null` and `0` must not look alike. `0` is a real limit (COD refused on every
 * order), so it reads "0.00"; `null` is no limit, so the field is empty.
 */
export function codLimitToInput(minor: number | null | undefined): string {
  return typeof minor === 'number' && Number.isFinite(minor) ? (minor / 100).toFixed(2) : '';
}

/**
 * The field as the server wants it: `null` when blank, else whole minor units.
 *
 * Blank is sent as `null`, never `0` — `inputToCents` would turn an empty field
 * into 0, and a 0 limit refuses cash on delivery for every shopper. That is the
 * exact opposite of what an admin clearing the field means.
 */
export function codLimitFromInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function normalizeCurrencyForShipping(value: string): string {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'EGP';
}

function settingsToForm(s: StoreSettings): SettingsForm {
  return {
    currency: s.currency,
    // Optional-chained: a store with no tax rules yet (a fresh database) returns
    // settings with no taxRules key at all, and an unguarded .find() there took
    // the whole Settings page down with "Cannot read properties of undefined".
    vatPct: String(s.taxRules?.find((r) => r.country === 'EG')?.vatPct ?? 14),
    // A rule saved before the switch existed has no `enabled` key. Absent means
    // "charging, if there is a rate" — which is what every shop that predates
    // the switch meant, and what the server's isVatCharged decides.
    vatEnabled: (() => {
      const rule = s.taxRules?.find((r) => r.country === 'EG');
      if (!rule) return true;
      return rule.enabled ?? rule.vatPct > 0;
    })(),
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
    // Every row here is one the server has already seen, so every key is
    // frozen — `ratesToDrafts` marks them `isNew: false`. That is what stops a
    // label rename from re-keying orders already placed against the row.
    shippingRates: ratesToDrafts(s.shipping?.rates),
    codLimit: codLimitToInput(s.payments?.codMaxOrderMinor),
    instapay: instapayToForm(s.payments?.instapay),
    trustpilotBccEmail: s.reviews?.trustpilotBccEmail ?? '',
  };
}

export default function SettingsClient() {
  const [form, setForm] = useState<SettingsForm>({
    currency: 'EGP',
    vatPct: '14',
    vatEnabled: true,
    brand: { displayName: '', contactEmail: '', contactPhone: '', logoUrl: '' },
    shippingFlatRate: '',
    shippingFreeOver: '',
    shippingRates: [],
    codLimit: '',
    instapay: instapayToForm(undefined),
    trustpilotBccEmail: '',
  });
  const [raw, setRaw] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [trustpilotEmailError, setTrustpilotEmailError] = useState<string | null>(null);
  /**
   * Whether the admin has asked to hand-type a logo URL.
   *
   * Off by default so the uploaded logo is the normal path — the field then
   * shows the live link without inviting an edit that could paste an expiring
   * signed URL.
   */
  const [logoUrlOverride, setLogoUrlOverride] = useState(false);
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

  const setInstapay = (field: keyof InstapayForm, value: string) => {
    setSaved(false);
    setForm((p) => ({ ...p, instapay: { ...p.instapay, [field]: value } }));
  };

  const setField = (field: keyof Omit<SettingsForm, 'brand' | 'shippingRates' | 'vatEnabled' | 'instapay'>) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => { setSaved(false); setForm((p) => ({ ...p, [field]: e.target.value })); };

  const setBrand = (field: keyof BrandForm) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => { setSaved(false); setForm((p) => ({ ...p, brand: { ...p.brand, [field]: e.target.value } })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raw) return;

    /**
     * The governorate table is checked BEFORE anything is sent (#83).
     *
     * The server's `ShippingConfigSchema` rejects the whole settings document
     * over one bad row, so an admin with a blank fee would lose their currency,
     * VAT and brand edits in the same save and get back one opaque message
     * about `rates[2]`. Same trade `normalizeStorefrontLayoutForSave` makes —
     * except that one DROPS what it cannot save, and a dropped governorate is a
     * shopper silently charged the wrong fee, so this stops instead.
     */
    const ratesCheck = validateGovernorateRates(form.shippingRates);
    if (ratesCheck.issues.length > 0) {
      setSaveError(
        ratesCheck.issues.length === 1
          ? `Delivery fees: ${ratesCheck.issues[0].message}`
          : `Delivery fees: ${ratesCheck.issues.length} governorate rows need fixing — see the highlighted fields below.`,
      );
      setSaved(false);
      return;
    }

    /**
     * `flatRateCents` is REQUIRED by the server's shipping schema, and it is
     * also the fallback every unlisted governorate is charged — so a table
     * without one is not a table anyone can reason about. Prefer what was
     * typed; fall back to what is stored; refuse rather than invent a number
     * the admin never chose.
     */
    const typedFlat = form.shippingFlatRate.trim() ? inputToCents(form.shippingFlatRate) : null;
    const storedFlat =
      typeof raw.shipping?.flatRateCents === 'number' ? raw.shipping.flatRateCents : null;
    const flatForSave = typedFlat ?? storedFlat;
    if (flatForSave === null && form.shippingRates.length > 0) {
      setSaveError(
        'Set a global delivery rate before saving governorate fees — it is what every governorate you have not listed gets charged.',
      );
      setSaved(false);
      return;
    }

    // Checked before sending for the same reason as the governorate table: the
    // server rejects the whole settings document over one bad field.
    const instapay = instapayFromForm(form.instapay);
    if (instapay.payLink !== null && !isHttpsUrl(instapay.payLink)) {
      setSaveError('InstaPay pay link must start with https:// — or leave it blank to use the shop default.');
      setSaved(false);
      return;
    }

    const trustpilotBccEmail = form.trustpilotBccEmail.trim();
    if (trustpilotBccEmail !== '' && !isEmailAddress(trustpilotBccEmail)) {
      setTrustpilotEmailError('Enter a complete email address, or leave this blank to turn invitations off.');
      setSaveError(null);
      setSaved(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setTrustpilotEmailError(null);
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
        // Only sent when a rate is KNOWN — typed now, or already stored.
        // Sending 0 for a blank field would silently make shipping free for the
        // whole store, which is the same mistake as an empty governorate fee
        // one level up.
        //
        // `rates` is sent EXPLICITLY, including as `[]`. The server reads an
        // absent `rates` as "leave the stored table alone" and `[]` as "clear
        // it" — two different things, deliberately, so an older dashboard
        // cannot wipe the table by saving the flat rate. This dashboard always
        // loads the table before it saves, so what is on screen is the truth
        // and an empty screen means an empty table. An empty table means
        // "charge the global rate to everyone", NEVER "ship free": that is the
        // whole back-compat guarantee of #83 and it is asserted in
        // __tests__/dashboard/governorate-rates-save.test.tsx.
        ...(flatForSave !== null
          ? {
              shipping: {
                flatRateCents: flatForSave,
                // Upper-cased and defaulted because the server's shipping
                // block validates `^[A-Z]{3}$` — a currency typed as "egp"
                // would fail zod for the ENTIRE settings document, taking the
                // governorate table and every unrelated edit with it.
                currency: normalizeCurrencyForShipping(form.currency),
                freeOverCents: inputToCents(form.shippingFreeOver),
                rates: ratesCheck.rates,
              },
            }
          : {}),
        // Always sent: this page has loaded the stored value, so what is on
        // screen is the truth, and a cleared field means "no limit".
        // `instapay` goes with all four keys, blanks as null (backend#170).
        payments: { codMaxOrderMinor: codLimitFromInput(form.codLimit), instapay },
        // Replaced wholesale by the backend. This block currently has one key,
        // and it is always sent so clearing the field persists as null.
        reviews: { trustpilotBccEmail: trustpilotBccEmail || null },
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
          // The rate is kept even when VAT is switched off, so turning it back
          // on restores what was configured instead of asking the admin to
          // remember it.
          if (!existing.some((r) => r.country === 'EG')) {
            return [
              ...existing,
              {
                country: 'EG',
                vatPct: Number.isFinite(vatPct) ? vatPct : 14,
                enabled: form.vatEnabled,
              },
            ];
          }
          return existing.map((r) =>
            r.country === 'EG'
              ? {
                  ...r,
                  vatPct: Number.isFinite(vatPct) ? vatPct : r.vatPct,
                  enabled: form.vatEnabled,
                }
              : r,
          );
        })(),
      };
      const updated = await apiUpdateSettings(patch);
      setRaw(updated);
      setForm(settingsToForm(updated));
      setSaved(true);
    } catch (err) {
      const apiError = err as ApiError;
      const message = apiError.message ?? 'Failed to save settings';
      if (apiError.status === 422 && /(?:reviews\.)?trustpilotBccEmail|trustpilot/i.test(message)) {
        setTrustpilotEmailError(
          message.includes(':') ? message.slice(message.lastIndexOf(':') + 1).trim() : 'Enter a valid email address.',
        );
      } else {
        setSaveError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * The global rate as the governorate editor should READ it: what is typed if
   * anything is, else what is stored, else `null`.
   *
   * `null` is not zero. It means this shop has never set a delivery fee, and
   * the editor says so rather than drawing a fallback of "EGP 0.00" that would
   * read as free delivery for every unlisted governorate — which is exactly
   * the confusion this whole feature is trying to avoid.
   */
  const typedFlatRate = form.shippingFlatRate.trim() ? inputToCents(form.shippingFlatRate) : null;
  const storedFlatRate =
    typeof raw?.shipping?.flatRateCents === 'number' ? raw.shipping.flatRateCents : null;
  const effectiveFlatRate = typedFlatRate ?? storedFlatRate;
  const effectiveFreeOver = form.shippingFreeOver.trim() ? inputToCents(form.shippingFreeOver) : 0;

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

      <form onSubmit={handleSubmit} noValidate>
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

          {/* An explicit switch, because `0` could not say "this shop does not
              charge VAT". It was the only way to express it and it was
              ambiguous — disabled or zero-rated, with nothing on screen saying
              which. The percentage stays visible but disabled when the switch is
              off, so the configured rate is not lost and it is obvious that it
              is not being applied. */}
          <div className="dash-field-row">
            <label
              className="dash-field"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <input
                type="checkbox"
                checked={form.vatEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vatEnabled: e.target.checked }))
                }
              />
              <span>Charge VAT on orders</span>
            </label>
          </div>

          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label">VAT % (Egypt)</label>
              <input
                type="number"
                className="dash-input"
                value={form.vatPct}
                onChange={setField('vatPct')}
                min="0"
                max="100"
                step="0.01"
                disabled={!form.vatEnabled}
              />
              <p className="dash-help-text">
                {form.vatEnabled
                  ? 'Applied to orders placed from Egypt.'
                  : 'VAT is off — this rate is kept but not charged. Turn the switch on to apply it.'}
              </p>
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
            <div className="dash-field">
              <label className="dash-label" htmlFor="cod-limit">
                Cash on delivery limit ({form.currency || 'EGP'})
              </label>
              <input
                id="cod-limit"
                type="number"
                className="dash-input"
                value={form.codLimit}
                onChange={setField('codLimit')}
                min="0"
                step="0.01"
                placeholder="No limit"
              />
              <p className="dash-help-text">
                Orders whose total (with delivery) is above this can&apos;t be paid cash on
                delivery. Leave blank to allow cash on delivery on every order.
              </p>
            </div>
          </div>

          {/* Per-governorate fees (minirue-backend#83). Sits directly under the
              global rate because that rate is its fallback — the two numbers
              only make sense read together. */}
          <GovernorateRatesEditor
            drafts={form.shippingRates}
            onChange={(next) => {
              setSaved(false);
              setForm((p) => ({ ...p, shippingRates: next }));
            }}
            flatRateCents={effectiveFlatRate}
            freeOverCents={effectiveFreeOver}
            currency={form.currency || 'EGP'}
          />

          {/* InstaPay payment guide (dashboard#68, backend#170): what the
              storefront's /checkout/instapay page shows. Every field is
              optional; blank falls back to the storefront's own defaults. */}
          <section className="dash-instapay" aria-labelledby="instapay-title">
            <div className="dash-instapay-head">
              <h2 id="instapay-title" className="dash-section-title">InstaPay</h2>
              <p className="dash-help-text">
                Shown to shoppers who pay by InstaPay at checkout. Blank uses the shop defaults.
              </p>
            </div>

            <div className="dash-field-row">
              <div className="dash-field">
                <label className="dash-label" htmlFor="instapay-pay-link">Pay link</label>
                <div className="dash-instapay-link">
                  <input
                    id="instapay-pay-link"
                    aria-label="InstaPay pay link"
                    type="url"
                    inputMode="url"
                    className="dash-input"
                    value={form.instapay.payLink}
                    onChange={(e) => setInstapay('payLink', e.target.value)}
                    placeholder="https://ipn.eg/S/…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="dash-btn-secondary"
                    disabled={!isHttpsUrl(form.instapay.payLink.trim())}
                    onClick={() =>
                      window.open(form.instapay.payLink.trim(), '_blank', 'noopener,noreferrer')
                    }
                  >
                    Test link
                  </button>
                </div>
                <p className="dash-help-text">
                  The InstaPay payment link from your bank app. Must start with https://.
                </p>
              </div>
              <div className="dash-field">
                <label className="dash-label" htmlFor="instapay-handle">Handle</label>
                <input
                  id="instapay-handle"
                  aria-label="InstaPay handle"
                  type="text"
                  className="dash-input"
                  value={form.instapay.handle}
                  onChange={(e) => setInstapay('handle', e.target.value)}
                  maxLength={INSTAPAY_HANDLE_MAX}
                  placeholder="yourshop@instapay"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="dash-help-text">The address shoppers send the transfer to.</p>
              </div>
            </div>

            <div className="dash-field-row">
              <ImageField
                label="QR code"
                imageUrl={form.instapay.qrMediaUrl || null}
                onChange={(_id, item) => setInstapay('qrMediaUrl', item?.url ?? '')}
                helpText="Shoppers scan it from another phone."
              />
              <ImageField
                label="Example receipt"
                imageUrl={form.instapay.exampleMediaUrl || null}
                onChange={(_id, item) => setInstapay('exampleMediaUrl', item?.url ?? '')}
                aspectRatio={9 / 16}
                helpText="A sample of the screenshot shoppers should upload."
              />
            </div>
          </section>

          <section className="dash-instapay" aria-labelledby="trustpilot-invitations-title">
            <div className="dash-instapay-head">
              <h2 id="trustpilot-invitations-title" className="dash-section-title">
                Trustpilot review invitations
              </h2>
              <p className="dash-help-text">
                Automatically invite customers to review an order after delivery.
              </p>
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="trustpilot-bcc-email">
                Trustpilot review invitations (BCC address)
              </label>
              <input
                id="trustpilot-bcc-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                className={`dash-input${trustpilotEmailError ? ' dash-input-error' : ''}`}
                value={form.trustpilotBccEmail}
                onChange={(event) => {
                  setSaved(false);
                  setTrustpilotEmailError(null);
                  setForm((previous) => ({ ...previous, trustpilotBccEmail: event.target.value }));
                }}
                maxLength={254}
                placeholder="your-shop@invite.trustpilot.com"
                aria-invalid={Boolean(trustpilotEmailError)}
                aria-describedby={`trustpilot-bcc-help trustpilot-bcc-privacy${trustpilotEmailError ? ' trustpilot-bcc-error' : ''}`}
              />
              <p id="trustpilot-bcc-help" className="dash-help-text">
                Paste the address from Trustpilot → Get reviews → AFS. Blank turns invitations off.
              </p>
              <p id="trustpilot-bcc-privacy" className="dash-help-text">
                MiniRue uses it only as a hidden BCC recipient on eligible order emails; shoppers never see it.
              </p>
              {trustpilotEmailError && (
                <p id="trustpilot-bcc-error" className="dash-field-error" role="alert">
                  {trustpilotEmailError}
                </p>
              )}
            </div>
          </section>

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
            {/* Read-only unless the admin asks to override.
                
                The uploaded logo above is the source of truth. This box shows
                the live link so it can be copied or checked, but inviting
                someone to hand-edit a 200-character signed URL is inviting them
                to paste one that expires — presigned S3 links have a 7-day TTL,
                and the backend's own comment says storing one verbatim "would
                freeze a link that can expire and would break the old-object
                cleanup on the NEXT real upload".
                
                The override still exists, because an externally-hosted logo is
                a real case; it just is not the default path any more. */}
            <label className="dash-label">Logo URL</label>
            <input
              type="url"
              className="dash-input"
              value={form.brand.logoUrl}
              onChange={setBrand('logoUrl')}
              placeholder="https://…"
              readOnly={!logoUrlOverride}
              aria-readonly={!logoUrlOverride}
              style={
                logoUrlOverride
                  ? undefined
                  : { background: 'var(--mr-bg-2)', cursor: 'default' }
              }
            />
            <label
              className="dash-help-text"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}
            >
              <input
                type="checkbox"
                checked={logoUrlOverride}
                onChange={(e) => setLogoUrlOverride(e.target.checked)}
              />
              <span>Use a different image URL instead of the uploaded logo</span>
            </label>
            <p className="dash-help-text">
              {logoUrlOverride
                ? 'Stored and served exactly as typed. Clear it to go back to the uploaded logo, or to the default wordmark if none is uploaded.'
                : 'This is the link for the logo uploaded above — change it by uploading a new one.'}
            </p>
          </div>

          {saveError && <p className="dash-inline-error" role="alert">{saveError}</p>}

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && (
              <span role="status" style={{ fontSize: 13, color: 'var(--mr-st-ok-fg)' }}>
                Settings saved
              </span>
            )}
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

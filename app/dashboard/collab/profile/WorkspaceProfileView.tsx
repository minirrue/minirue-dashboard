'use client';

import { FormEvent, useEffect, useState } from 'react';

import {
  CollabErrorPanel,
  CollabLoadingBlock,
  CollabPageHeader,
} from '@/components/collab/collab-ui';

import {
  apiCollabGetBrand,
  apiCollabOverview,
  apiUpdateWorkspaceProfile,
  type CollabBrand,
} from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function WorkspaceProfileView() {
  const [brand, setBrand] = useState<CollabBrand | null>(null);
  const [brandSlug, setBrandSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [storefrontVisible, setStorefrontVisible] = useState(true);
  const [originalVisible, setOriginalVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiCollabGetBrand(),
      apiCollabOverview(),
    ])
      .then(([b, overview]) => {
        setBrand(b);
        setBrandSlug(b.brandSlug);
        setOriginalSlug(b.brandSlug);
        setContactEmail(overview.contactEmail);
        setOriginalEmail(overview.contactEmail);
        setStorefrontVisible(overview.storefrontVisible);
        setOriginalVisible(overview.storefrontVisible);
      })
      .catch((err: ApiError) => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const isDirty =
    brandSlug !== originalSlug ||
    contactEmail !== originalEmail ||
    storefrontVisible !== originalVisible;

  function validateSlug(value: string): string | null {
    if (value.length < 1) return 'Brand slug is required';
    if (value.length > 100) return 'Brand slug must be 100 characters or fewer';
    if (!SLUG_REGEX.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
    return null;
  }

  function validateEmail(value: string): string | null {
    if (!value) return 'Contact email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
    return null;
  }

  function handleSlugBlur() {
    setSlugError(validateSlug(brandSlug));
  }

  function handleEmailBlur() {
    setEmailError(validateEmail(contactEmail));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();

    const sErr = validateSlug(brandSlug);
    const eErr = validateEmail(contactEmail);
    setSlugError(sErr);
    setEmailError(eErr);
    if (sErr || eErr) return;

    if (brandSlug !== originalSlug) {
      const confirmed = window.confirm(
        'Changing your slug will update the live storefront URL. ' +
        'Any existing links to /brands/' + originalSlug + ' will stop working. Continue?',
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await apiUpdateWorkspaceProfile({
        brandSlug,
        contactEmail,
        storefrontVisible,
      });
      setOriginalSlug(brandSlug);
      setOriginalEmail(contactEmail);
      setOriginalVisible(storefrontVisible);
      setSaved(true);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setSlugError('This slug is already in use');
      } else {
        setError(apiErr.message || 'Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (brand) setBrandSlug(originalSlug);
    setContactEmail(originalEmail);
    setStorefrontVisible(originalVisible);
    setSlugError(null);
    setEmailError(null);
    setError(null);
    setSaved(false);
  }

  if (loading) return <CollabLoadingBlock />;

  if (error && !brand) {
    return <CollabErrorPanel message={error} />;
  }

  return (
    <>
      <CollabPageHeader
        title="My Workspace Profile"
        subtitle="Manage your storefront slug, contact email, and visibility."
      />

      <form className="dash-form-card collab-profile-form" onSubmit={onSave}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="profile-slug">
            Slug (brand URL)
          </label>
          <input
            id="profile-slug"
            className="dash-input"
            value={brandSlug}
            onChange={(e) => { setBrandSlug(e.target.value); setSlugError(null); }}
            onBlur={handleSlugBlur}
            disabled={saving}
          />
          {slugError ? <p className="dash-inline-error">{slugError}</p> : null}
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="profile-email">
            Contact Email
          </label>
          <input
            id="profile-email"
            className="dash-input"
            type="email"
            value={contactEmail}
            onChange={(e) => { setContactEmail(e.target.value); setEmailError(null); }}
            onBlur={handleEmailBlur}
            disabled={saving}
          />
          {emailError ? <p className="dash-inline-error">{emailError}</p> : null}
        </div>

        <fieldset className="dash-field">
          <legend className="dash-label">Storefront Visible</legend>
          <label className="collab-radio-label">
            <input
              type="radio"
              name="storefrontVisible"
              checked={storefrontVisible === true}
              onChange={() => setStorefrontVisible(true)}
              disabled={saving}
            />
            Yes
          </label>
          <label className="collab-radio-label">
            <input
              type="radio"
              name="storefrontVisible"
              checked={storefrontVisible === false}
              onChange={() => setStorefrontVisible(false)}
              disabled={saving}
            />
            No
          </label>
        </fieldset>

        {error ? <p className="dash-inline-error">{error}</p> : null}
        {saved ? (
          <p className="collab-save-ok" role="status" aria-live="polite">
            Profile saved.
          </p>
        ) : null}

        <div className="dash-form-actions">
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onCancel}
            disabled={saving || !isDirty}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </>
  );
}

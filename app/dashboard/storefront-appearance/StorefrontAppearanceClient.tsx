'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiGetSettings, apiUpdateSettings } from '@/lib/api/settings';
import type { HeroSlideConfig, StorefrontSettings, StoreSettings } from '@/lib/api/settings';
import type { ApiError } from '@/lib/api/client';

function emptySlide(id: number): HeroSlideConfig {
  return {
    id,
    type: 'editorial',
    eyebrow: '',
    headline: '',
    sub: '',
    tagline: '',
    bg: '#0B0B0B',
  };
}

function emptyStorefront(): StorefrontSettings {
  return {
    announcementEnabled: true,
    announcementMessages: [],
    announcementLinkUrl: null,
    announcementBackground: null,
    faviconUrl: null,
    footerTagline: null,
    heroSlides: [],
  };
}

function moveSlide(slides: HeroSlideConfig[], index: number, direction: -1 | 1): HeroSlideConfig[] {
  const target = index + direction;
  if (target < 0 || target >= slides.length) return slides;
  const next = [...slides];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((slide, i) => ({ ...slide, id: i }));
}

export default function StorefrontAppearanceClient() {
  const [raw, setRaw] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<StorefrontSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
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
      setForm(data.storefront ?? emptyStorefront());
      setLogoUrl(data.brand.logoUrl ?? '');
    } catch (e) {
      setLoadError((e as ApiError).message ?? 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateSlide = (index: number, patch: Partial<HeroSlideConfig>) => {
    if (!form) return;
    setSaved(false);
    const slides = [...form.heroSlides];
    slides[index] = { ...slides[index], ...patch };
    setForm({ ...form, heroSlides: slides });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raw || !form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await apiUpdateSettings({
        storefront: form,
        brand: { ...raw.brand, logoUrl: logoUrl.trim() || null },
      });
      setRaw(updated);
      setForm(updated.storefront ?? form);
      setLogoUrl(updated.brand.logoUrl ?? '');
      setSaved(true);
    } catch (err) {
      setSaveError((err as ApiError).message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dash-form-card">
        <span className="dash-skeleton" style={{ width: '100%', height: 120 }} />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="dash-card">
        <p className="dash-inline-error">{loadError ?? 'Settings unavailable'}</p>
        <button type="button" className="dash-btn-secondary" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Storefront appearance</h1>
        <p className="dash-page-subtitle">Announcement bar, hero carousel, and public footer copy.</p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="dash-form-card">
        <div className="dash-form-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Announcement bar</h2>
          </div>
          <label className="dash-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={form.announcementEnabled}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, announcementEnabled: e.target.checked });
              }}
            />
            <span>Show announcement bar on storefront</span>
          </label>
          <label className="dash-field">
            <span className="dash-label">Messages (one per line)</span>
            <textarea
              className="dash-input"
              rows={5}
              value={form.announcementMessages.join('\n')}
              onChange={(e) => {
                setSaved(false);
                setForm({
                  ...form,
                  announcementMessages: e.target.value
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean),
                });
              }}
            />
          </label>
          <label className="dash-field">
            <span className="dash-label">Link URL (optional)</span>
            <input
              className="dash-input"
              type="url"
              value={form.announcementLinkUrl ?? ''}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, announcementLinkUrl: e.target.value.trim() || null });
              }}
              placeholder="https://…"
            />
          </label>
          <label className="dash-field">
            <span className="dash-label">Background (CSS color or gradient)</span>
            <input
              className="dash-input"
              value={form.announcementBackground ?? ''}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, announcementBackground: e.target.value.trim() || null });
              }}
              placeholder="#0B0B0B or linear-gradient(…)"
            />
          </label>
        </div>

        <div className="dash-form-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Brand touches</h2>
          </div>
          <label className="dash-field">
            <span className="dash-label">Store logo URL</span>
            <input
              className="dash-input"
              type="url"
              value={logoUrl}
              onChange={(e) => {
                setSaved(false);
                setLogoUrl(e.target.value);
              }}
              placeholder="https://…"
            />
          </label>
          <label className="dash-field">
            <span className="dash-label">Favicon URL</span>
            <input
              className="dash-input"
              type="url"
              value={form.faviconUrl ?? ''}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, faviconUrl: e.target.value || null });
              }}
              placeholder="https://…"
            />
          </label>
          <label className="dash-field">
            <span className="dash-label">Footer tagline</span>
            <input
              className="dash-input"
              value={form.footerTagline ?? ''}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, footerTagline: e.target.value || null });
              }}
            />
          </label>
        </div>

        <div className="dash-form-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Hero slides</h2>
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={() => {
                setSaved(false);
                setForm({
                  ...form,
                  heroSlides: [...form.heroSlides, emptySlide(form.heroSlides.length)],
                });
              }}
            >
              Add slide
            </button>
          </div>

          {form.heroSlides.map((slide, index) => (
            <div key={`${slide.id}-${index}`} className="dash-form-card" style={{ marginBottom: 16 }}>
              <div className="dash-row-actions" style={{ marginBottom: 12 }}>
                <strong>Slide {index + 1}</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    disabled={index === 0}
                    onClick={() => {
                      setSaved(false);
                      setForm({ ...form, heroSlides: moveSlide(form.heroSlides, index, -1) });
                    }}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    disabled={index === form.heroSlides.length - 1}
                    onClick={() => {
                      setSaved(false);
                      setForm({ ...form, heroSlides: moveSlide(form.heroSlides, index, 1) });
                    }}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    onClick={() => {
                      setSaved(false);
                      setForm({
                        ...form,
                        heroSlides: form.heroSlides.filter((_, i) => i !== index),
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="dash-form-grid">
                <label className="dash-field">
                  <span className="dash-label">Eyebrow</span>
                  <input className="dash-input" value={slide.eyebrow} onChange={(e) => updateSlide(index, { eyebrow: e.target.value })} />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Headline</span>
                  <input className="dash-input" value={slide.headline} onChange={(e) => updateSlide(index, { headline: e.target.value })} />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Sub line</span>
                  <input className="dash-input" value={slide.sub} onChange={(e) => updateSlide(index, { sub: e.target.value })} />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Tagline</span>
                  <input className="dash-input" value={slide.tagline} onChange={(e) => updateSlide(index, { tagline: e.target.value })} />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Background</span>
                  <input className="dash-input" value={slide.bg} onChange={(e) => updateSlide(index, { bg: e.target.value })} />
                </label>
                <label className="dash-field">
                  <span className="dash-label">Type</span>
                  <select
                    className="dash-input"
                    value={slide.type}
                    onChange={(e) => updateSlide(index, { type: e.target.value as 'photo' | 'editorial' })}
                  >
                    <option value="photo">Photo</option>
                    <option value="editorial">Editorial</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>

        {saveError && <p className="dash-inline-error">{saveError}</p>}
        {saved && <p className="dash-inline-ok">Storefront settings saved.</p>}

        <div className="dash-form-actions">
          <button type="submit" className="dash-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}

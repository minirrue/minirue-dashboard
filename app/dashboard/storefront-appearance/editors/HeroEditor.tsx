'use client';

import React, { useRef, useState } from 'react';
import { newId } from '@/lib/api/storefront';
import type { HeroSection, HeroSlide } from '@/lib/api/storefront';
import GalleryPickerModal, { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import type { ApiError } from '@/lib/api/client';
import CtaTargetField from './CtaTargetField';

/** BottleSVG's real accepted prop values (apps/minirue-frontend/components/ui/BottleSVG.tsx) —
 * do not add values here without adding a matching FILLS/CAP_COLORS entry there first. */
const BOTTLE_COLORS = ['amber', 'rose', 'ink', 'cream', 'crimson', 'oud'] as const;
const CAP_COLORS = ['ink', 'gold', 'cream'] as const;

export function moveSlide(
  slides: HeroSlide[],
  index: number,
  direction: -1 | 1,
): HeroSlide[] {
  const target = index + direction;
  if (target < 0 || target >= slides.length) return slides;
  const next = [...slides];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function blankSlide(): HeroSlide {
  return {
    id: newId('slide'),
    mode: 'image',
    eyebrow: '',
    headline: '',
    sub: '',
    tagline: '',
    imageGalleryItemId: null,
    imageAlt: '',
    background: '#0B0B0B',
    bottle: null,
    cap: null,
    ctaLabel: 'Shop the edit',
    ctaTarget: { kind: 'scroll' },
  };
}

export default function HeroEditor({
  section,
  onChange,
}: {
  section: HeroSection;
  onChange: (next: HeroSection) => void;
}) {
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ slideId: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const patchSlide = (id: string, patch: Partial<HeroSlide>) =>
    onChange({
      ...section,
      slides: section.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  async function handleDeviceFile(slideId: string, file: File) {
    setUploadError(null);
    setUploadingFor(slideId);
    try {
      const item = await uploadDeviceFileToGallery(file, 'Storefront');
      patchSlide(slideId, { imageGalleryItemId: item.id });
    } catch (e) {
      const err = e as ApiError;
      setUploadError({ slideId, message: err.message || 'Failed to upload image.' });
    } finally {
      setUploadingFor(null);
    }
  }

  return (
    <div className="dash-form-section">
      <div className="dash-form-grid">
        <label className="dash-field">
          <span className="dash-label">Seconds per slide</span>
          <input
            className="dash-input"
            type="number"
            min={2}
            max={30}
            value={Math.round(section.autoplayMs / 1000)}
            onChange={(e) =>
              onChange({
                ...section,
                autoplayMs: Math.min(30, Math.max(2, Number(e.target.value))) * 1000,
              })
            }
          />
        </label>
        <label className="dash-field">
          <span className="dash-label">Accessible name (screen readers)</span>
          <input
            className="dash-input"
            value={section.ariaLabel}
            placeholder="Featured collections"
            onChange={(e) => onChange({ ...section, ariaLabel: e.target.value })}
          />
        </label>
        <label className="dash-field">
          <span className="dash-label">"Scroll" hint label</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="dash-input"
              value={section.scrollCueLabel ?? ''}
              placeholder="Scroll"
              onChange={(e) => onChange({ ...section, scrollCueLabel: e.target.value })}
            />
            <button
              type="button"
              className="dash-btn-ghost"
              disabled={section.scrollCueLabel === null}
              onClick={() => onChange({ ...section, scrollCueLabel: null })}
            >
              Hide
            </button>
          </div>
          {section.scrollCueLabel === null && (
            <span style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
              Hidden — no scroll hint will show on the storefront.
            </span>
          )}
        </label>
      </div>

      {section.slides.map((slide, index) => (
        <div key={slide.id} className="dash-form-card" style={{ marginBottom: 12 }}>
          <div className="dash-row-actions" style={{ marginBottom: 10 }}>
            <strong style={{ flex: 1 }}>Slide {index + 1}</strong>
            <button type="button" className="dash-btn-ghost" disabled={index === 0}
              onClick={() => onChange({ ...section, slides: moveSlide(section.slides, index, -1) })}>
              Move up
            </button>
            <button type="button" className="dash-btn-ghost" disabled={index === section.slides.length - 1}
              onClick={() => onChange({ ...section, slides: moveSlide(section.slides, index, 1) })}>
              Move down
            </button>
            <button type="button" className="dash-btn-ghost"
              onClick={() => onChange({ ...section, slides: section.slides.filter((s) => s.id !== slide.id) })}>
              Remove
            </button>
          </div>

          <div className="dash-form-grid">
            <label className="dash-field">
              <span className="dash-label">Style</span>
              <select
                className="dash-input"
                value={slide.mode}
                onChange={(e) => patchSlide(slide.id, { mode: e.target.value as HeroSlide['mode'] })}
              >
                <option value="image">Photograph</option>
                <option value="editorial">Bottle artwork on a colour</option>
              </select>
            </label>
            <label className="dash-field">
              <span className="dash-label">Eyebrow</span>
              <input className="dash-input" value={slide.eyebrow}
                onChange={(e) => patchSlide(slide.id, { eyebrow: e.target.value })} />
            </label>
            <label className="dash-field">
              <span className="dash-label">Headline</span>
              <input className="dash-input" value={slide.headline}
                onChange={(e) => patchSlide(slide.id, { headline: e.target.value })} />
            </label>
            <label className="dash-field">
              <span className="dash-label">Sub line</span>
              <input className="dash-input" value={slide.sub}
                onChange={(e) => patchSlide(slide.id, { sub: e.target.value })} />
            </label>
            <label className="dash-field">
              <span className="dash-label">Tagline</span>
              <input className="dash-input" value={slide.tagline}
                onChange={(e) => patchSlide(slide.id, { tagline: e.target.value })} />
            </label>
            <label className="dash-field">
              <span className="dash-label">Button label</span>
              <input className="dash-input" value={slide.ctaLabel ?? ''}
                placeholder="Leave blank for no button"
                onChange={(e) => patchSlide(slide.id, { ctaLabel: e.target.value || null })} />
            </label>
          </div>

          {slide.mode === 'image' ? (
            <div className="dash-field">
              <span className="dash-label">Photograph</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="dash-btn-secondary" onClick={() => setPickingFor(slide.id)}>
                  {slide.imageGalleryItemId ? 'Change photo' : 'Choose from gallery'}
                </button>
                <button
                  type="button"
                  className="dash-btn-secondary"
                  disabled={uploadingFor === slide.id}
                  onClick={() => {
                    uploadTargetRef.current = slide.id;
                    fileInputRef.current?.click();
                  }}
                >
                  {uploadingFor === slide.id ? 'Uploading…' : 'Upload from this device'}
                </button>
                {slide.imageGalleryItemId && (
                  <button type="button" className="dash-btn-ghost"
                    onClick={() => patchSlide(slide.id, { imageGalleryItemId: null })}>
                    Clear
                  </button>
                )}
                {!slide.imageGalleryItemId && (
                  <span style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
                    No photo chosen — the slide falls back to its background colour.
                  </span>
                )}
              </div>
              {uploadError && uploadError.slideId === slide.id && (
                <p className="dash-inline-error">{uploadError.message}</p>
              )}
              <label className="dash-field" style={{ marginTop: 10 }}>
                <span className="dash-label">Image alt text (for screen readers and search)</span>
                <input className="dash-input" value={slide.imageAlt}
                  placeholder="Describe the photograph"
                  onChange={(e) => patchSlide(slide.id, { imageAlt: e.target.value })} />
              </label>
            </div>
          ) : (
            <div className="dash-form-grid">
              <label className="dash-field">
                <span className="dash-label">Background (colour or gradient)</span>
                <input className="dash-input" value={slide.background}
                  onChange={(e) => patchSlide(slide.id, { background: e.target.value })} />
              </label>
              <label className="dash-field">
                <span className="dash-label">Bottle artwork</span>
                <select className="dash-input" value={slide.bottle ?? ''}
                  onChange={(e) => patchSlide(slide.id, { bottle: e.target.value || null })}>
                  <option value="">None</option>
                  {BOTTLE_COLORS.map((c) => (
                    <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="dash-field">
                <span className="dash-label">Cap</span>
                <select className="dash-input" value={slide.cap ?? ''}
                  onChange={(e) => patchSlide(slide.id, { cap: e.target.value || null })}>
                  <option value="">None</option>
                  {CAP_COLORS.map((c) => (
                    <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <CtaTargetField
            value={slide.ctaTarget}
            onChange={(ctaTarget) => patchSlide(slide.id, { ctaTarget })}
          />
        </div>
      ))}

      <button type="button" className="dash-btn-secondary"
        onClick={() => onChange({ ...section, slides: [...section.slides, blankSlide()] })}>
        Add slide
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          const target = uploadTargetRef.current;
          if (file && target) handleDeviceFile(target, file);
          e.target.value = '';
          uploadTargetRef.current = null;
        }}
      />

      {pickingFor && (
        <GalleryPickerModal
          onClose={() => setPickingFor(null)}
          onSelect={(item) => {
            patchSlide(pickingFor, { imageGalleryItemId: item.id });
            setPickingFor(null);
          }}
        />
      )}
    </div>
  );
}

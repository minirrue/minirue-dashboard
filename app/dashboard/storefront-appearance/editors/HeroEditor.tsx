'use client';

import React, { useEffect, useRef, useState } from 'react';
import { newId } from '@/lib/api/storefront';
import type { HeroSection, HeroSlide } from '@/lib/api/storefront';
import GalleryPickerModal, { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import ImageCropModal from '@/components/dashboard/ImageCropModal';
import { getItem } from '@/lib/gallery/api';
import type { ApiError } from '@/lib/api/client';
import CtaTargetField from './CtaTargetField';

/** A fixed-aspect preview frame — this is what the admin sees the crop will look
 *  like on that device (16:9 for desktop, 3:4 for mobile). Falls back to the
 *  slide's background colour when no image is set. */
function HeroImageFrame({
  url,
  background,
  ratio,
  muted,
}: {
  url?: string;
  background: string;
  ratio: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        aspectRatio: ratio,
        width: '100%',
        maxWidth: 200,
        borderRadius: 'var(--mr-radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--mr-dash-hair)',
        background: url ? 'var(--mr-dash-sub)' : background,
        opacity: muted ? 0.65 : 1,
        marginBottom: 8,
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
  );
}

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
    mobileImageGalleryItemId: null,
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
  type Slot = 'desktop' | 'mobile';
  const slotField = (slot: Slot): 'imageGalleryItemId' | 'mobileImageGalleryItemId' =>
    slot === 'desktop' ? 'imageGalleryItemId' : 'mobileImageGalleryItemId';

  const [pickingFor, setPickingFor] = useState<{ slideId: string; slot: Slot } | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ slideId: string; message: string } | null>(null);
  const [cropping, setCropping] = useState<{
    slideId: string;
    slot: Slot;
    file: File;
    chainMobile: boolean;
  } | null>(null);
  const [urlById, setUrlById] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<{ slideId: string; slot: Slot; chainMobile: boolean } | null>(null);

  const rememberUrl = (id: string, url: string) =>
    setUrlById((m) => (m[id] === url ? m : { ...m, [id]: url }));

  const patchSlide = (id: string, patch: Partial<HeroSlide>) =>
    onChange({
      ...section,
      slides: section.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  // Resolve URLs for images already set on slides (from an earlier session) so
  // the desktop/mobile previews render immediately, not only after re-picking.
  useEffect(() => {
    const ids = new Set<string>();
    section.slides.forEach((s) => {
      if (s.imageGalleryItemId) ids.add(s.imageGalleryItemId);
      if (s.mobileImageGalleryItemId) ids.add(s.mobileImageGalleryItemId);
    });
    ids.forEach((id) => {
      if (!urlById[id]) {
        getItem(id)
          .then((item) => rememberUrl(id, item.url))
          .catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.slides]);

  async function handleCropped(blob: Blob, name: string) {
    if (!cropping) return;
    const { slideId, slot, file, chainMobile } = cropping;
    setUploadError(null);
    setUploadingFor(slideId);
    try {
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const base = name.replace(/\.[^.]+$/, '');
      const croppedFile = new File([blob], `${base}-${slot}.${ext}`, { type: blob.type });
      const item = await uploadDeviceFileToGallery(croppedFile, 'Storefront');
      rememberUrl(item.id, item.url);
      patchSlide(slideId, { [slotField(slot)]: item.id } as Partial<HeroSlide>);
      if (chainMobile && slot === 'desktop') {
        // "One photo, crop for both": re-open the cropper on the same file for
        // the mobile portrait crop.
        setCropping({ slideId, slot: 'mobile', file, chainMobile: false });
      } else {
        setCropping(null);
      }
    } catch (e) {
      setUploadError({ slideId, message: (e as ApiError).message || 'Failed to upload image.' });
      setCropping(null);
    } finally {
      setUploadingFor(null);
    }
  }

  const pickDevice = (slideId: string, slot: Slot, chainMobile: boolean) => {
    pendingRef.current = { slideId, slot, chainMobile };
    fileInputRef.current?.click();
  };

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
              <p className="dash-help-text" style={{ marginTop: 0 }}>
                Two crops keep the hero right everywhere: a wide landscape for
                desktop and a tall portrait for phones. Upload one photo and crop
                both, or set each separately. The frames below are exactly what
                shoppers see on each device.
              </p>

              <button
                type="button"
                className="dash-btn-secondary"
                disabled={uploadingFor === slide.id}
                onClick={() => pickDevice(slide.id, 'desktop', true)}
                style={{ marginBottom: 14 }}
              >
                {uploadingFor === slide.id
                  ? 'Working…'
                  : 'Upload one photo — crop for desktop & mobile'}
              </button>

              <div className="dash-form-grid">
                {/* Desktop (landscape) */}
                <div className="dash-field">
                  <span className="dash-label">Desktop image (landscape)</span>
                  <HeroImageFrame
                    url={urlById[slide.imageGalleryItemId ?? '']}
                    background={slide.background}
                    ratio="16 / 9"
                  />
                  <div className="dash-row-actions" style={{ flexWrap: 'wrap' }}>
                    <button type="button" className="dash-btn-ghost"
                      disabled={uploadingFor === slide.id}
                      onClick={() => pickDevice(slide.id, 'desktop', false)}>
                      Upload &amp; crop
                    </button>
                    <button type="button" className="dash-btn-ghost"
                      onClick={() => setPickingFor({ slideId: slide.id, slot: 'desktop' })}>
                      Gallery
                    </button>
                    {slide.imageGalleryItemId && (
                      <button type="button" className="dash-btn-ghost"
                        onClick={() => patchSlide(slide.id, { imageGalleryItemId: null })}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile (portrait) */}
                <div className="dash-field">
                  <span className="dash-label">Mobile image (portrait)</span>
                  <HeroImageFrame
                    url={
                      urlById[slide.mobileImageGalleryItemId ?? ''] ??
                      urlById[slide.imageGalleryItemId ?? '']
                    }
                    background={slide.background}
                    ratio="3 / 4"
                    muted={!slide.mobileImageGalleryItemId}
                  />
                  <div className="dash-row-actions" style={{ flexWrap: 'wrap' }}>
                    <button type="button" className="dash-btn-ghost"
                      disabled={uploadingFor === slide.id}
                      onClick={() => pickDevice(slide.id, 'mobile', false)}>
                      Upload &amp; crop
                    </button>
                    <button type="button" className="dash-btn-ghost"
                      onClick={() => setPickingFor({ slideId: slide.id, slot: 'mobile' })}>
                      Gallery
                    </button>
                    {slide.mobileImageGalleryItemId && (
                      <button type="button" className="dash-btn-ghost"
                        onClick={() => patchSlide(slide.id, { mobileImageGalleryItemId: null })}>
                        Clear
                      </button>
                    )}
                  </div>
                  {!slide.mobileImageGalleryItemId && (
                    <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>
                      Falls back to the desktop image on phones.
                    </span>
                  )}
                </div>
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
          const target = pendingRef.current;
          if (file && target) setCropping({ ...target, file });
          e.target.value = '';
          pendingRef.current = null;
        }}
      />

      {pickingFor && (
        <GalleryPickerModal
          onClose={() => setPickingFor(null)}
          onSelect={(item) => {
            rememberUrl(item.id, item.url);
            patchSlide(pickingFor.slideId, {
              [slotField(pickingFor.slot)]: item.id,
            } as Partial<HeroSlide>);
            setPickingFor(null);
          }}
        />
      )}

      {cropping && (
        <ImageCropModal
          file={cropping.file}
          title={
            cropping.slot === 'desktop'
              ? 'Crop for desktop (landscape)'
              : 'Crop for mobile (portrait)'
          }
          initialAspect={cropping.slot === 'desktop' ? 16 / 9 : 3 / 4}
          onCancel={() => setCropping(null)}
          onCropped={handleCropped}
        />
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { newId } from '@/lib/api/storefront';
import type { HeroSection, HeroSlide } from '@/lib/api/storefront';
import GalleryPickerModal, { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import ImageCropModal from '@/components/dashboard/ImageCropModal';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { getItem } from '@/lib/gallery/api';
import type { GalleryItem, GalleryItemStatus } from '@/lib/gallery/types';
import { galleryItemStatus } from '@/lib/gallery/status';
import { useProcessingItemsPoll } from '@/lib/gallery/use-processing-poll';
import {
  galleryItemFailureMessage,
} from '@/components/dashboard/GalleryItemStatus';
import {
  heroImageWarning,
  type HeroSlot as GuidanceSlot,
} from '@/lib/storefront/hero-image-guidance';
import type { ApiError } from '@/lib/api/client';
import CtaTargetField from './CtaTargetField';
import HeroSlideColors from './HeroSlideColors';
import DashboardVideoViewer from '@/components/dashboard/DashboardVideoViewer';

/** A fixed-aspect preview frame — this is what the admin sees the crop will look
 *  like on that device (16:9 for desktop, 3:4 for mobile). Falls back to the
 *  slide's background colour when no image is set. */
function HeroImageFrame({
  url,
  localFile,
  background,
  ratio,
  muted,
  video,
}: {
  url?: string;
  /** Cropped bytes for THIS image if it was just uploaded this session —
   *  see UploadPreviewImage. Omitted (or no match) for an image resolved
   *  from a slide that already had one set on load. */
  localFile?: File | null;
  background: string;
  ratio: string;
  muted?: boolean;
  /** Set when the item is a video (backend#89): preview it as one. */
  video?: HeroVideoInfo;
}) {
  const status = video ? galleryItemStatus(video) : 'ready';
  return (
    <>
    <div
      style={{
        position: 'relative',
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
      {url && video ? (
        <DashboardVideoViewer
          media={{ url, posterUrl: video.poster, status, processingError: video.processingError }}
          variant="thumbnail"
          label="Chosen video"
          style={{ width: '100%', height: '100%' }}
        />
      ) : url && (
        <UploadPreviewImage
          src={url}
          localFile={localFile}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
    {/* Once, on the slot that owns the clip — not again on a mobile frame
        that is only falling back to it. */}
    {url && video && status === 'failed' && !muted && (
      <p className="dash-inline-error" style={{ margin: '0 0 8px', fontSize: 12 }}>
        {galleryItemFailureMessage({ processingError: video.processingError })} The storefront
        will only show its still — exchange it in the Gallery or pick another.
      </p>
    )}
    </>
  );
}

/** What the frames need to know about a video gallery item. */
type HeroVideoInfo = {
  poster: string | null;
  status?: GalleryItemStatus;
  processingError?: string | null;
};

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
    // All six colour overrides start unset. `null` is "follow the storefront
    // theme", which is what every slide did before this feature existed and
    // what a brand-new slide must keep doing — a default of anything else
    // would mean adding a slide silently opts it out of the theme.
    eyebrowColor: null,
    headlineColor: null,
    subColor: null,
    taglineColor: null,
    ctaBgColor: null,
    ctaTextColor: null,
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
  /*
   * Source widths, captured from the SAME getItem call that resolves the
   * preview URL — so the pixelation warning costs no extra request.
   *
   * `gallery_items.width` is nullable and is null for anything uploaded
   * before the column existed, which is why an unknown width is not a
   * warning: flagging a library of possibly-fine images would teach everyone
   * to ignore the badge.
   */
  const [widthById, setWidthById] = useState<Record<string, number | null>>({});
  /** Gallery ids that are videos, with their posters (backend#89). */
  const [videoById, setVideoById] = useState<Record<string, HeroVideoInfo>>({});
  const rememberKind = (
    item: Pick<GalleryItem, 'id' | 'kind' | 'posterUrl' | 'status' | 'processingError'>,
  ) =>
    setVideoById((m) => {
      if (item.kind !== 'video') {
        if (!(item.id in m)) return m;
        const next = { ...m };
        delete next[item.id];
        return next;
      }
      return {
        ...m,
        [item.id]: {
          poster: item.posterUrl,
          status: item.status,
          processingError: item.processingError ?? null,
        },
      };
    });
  // A chosen clip still converting flips to the playing preview once ready
  // (dashboard#45) — the url changes too, from the original to the MP4.
  useProcessingItemsPoll(
    Object.entries(videoById).map(([id, v]) => ({ id, status: v.status })),
    (fresh) =>
      fresh.forEach((item) => {
        setUrlById((m) => (m[item.id] === item.url ? m : { ...m, [item.id]: item.url }));
        rememberKind(item);
      }),
  );
  // Task FF (2026-07-30): cropped bytes for an image gallery item id that was
  // just uploaded THIS session, so its hero preview frame renders from local
  // bytes instead of a guaranteed-cold-miss remote fetch. Never populated for
  // ids resolved from a slide that already had an image set on load.
  const [localFileById, setLocalFileById] = useState<Record<string, File>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<{ slideId: string; slot: Slot; chainMobile: boolean } | null>(null);

  const rememberUrl = (id: string, url: string) =>
    setUrlById((m) => (m[id] === url ? m : { ...m, [id]: url }));

  /**
   * "This one will look soft, and here is why."
   *
   * The hero renders full-bleed and the storefront asks imgproxy for renders up
   * to 2560px. imgproxy does not upscale, so a smaller source is served at its
   * own size and the browser stretches it — which is the pixelation in
   * minirue-frontend#11, where every homepage image measured smaller than the
   * size it was rendered at and the hero slides were the worst (340x454).
   *
   * A warning rather than a block: a shop owner mid-campaign with only a small
   * crop should be able to ship it and fix it later. `role="status"` rather
   * than `alert` for the same reason — it is advice, and an assertive
   * announcement would interrupt them mid-task.
   */
  function SizeWarning({ id, slot }: { id: string | null; slot: GuidanceSlot }) {
    if (!id) return null;
    const warning = heroImageWarning(widthById[id], slot);
    if (!warning) return null;
    return (
      <p
        role="status"
        style={{
          margin: '6px 0 0',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--mr-st-warning-fg, #b45309)',
        }}
      >
        {warning.message}
      </p>
    );
  }

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
          .then((item) => {
            rememberUrl(id, item.url);
            rememberKind(item);
            setWidthById((prev) => ({ ...prev, [id]: item.width }));
          })
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
      setLocalFileById((m) => ({ ...m, [item.id]: croppedFile }));
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
          <span className="dash-label">&quot;Scroll&quot; hint label</span>
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
              <span className="dash-label">Photograph or video</span>
              <p className="dash-help-text" style={{ marginTop: 0 }}>
                Two crops keep the hero right everywhere: a wide landscape for
                desktop and a tall portrait for phones. Upload one photo and crop
                both, or set each separately. The frames below are exactly what
                shoppers see on each device.
              </p>
              <p className="dash-help-text" style={{ marginTop: 0 }}>
                A video can be chosen from the <strong>Gallery</strong>. On the
                storefront it plays muted and on a loop, only while its slide is
                showing, and visitors who have asked their device for less motion
                see its first frame as a still instead.
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
                  <span className="dash-label">Desktop (landscape)</span>
                  <HeroImageFrame
                    url={urlById[slide.imageGalleryItemId ?? '']}
                    localFile={localFileById[slide.imageGalleryItemId ?? '']}
                    background={slide.background}
                    ratio="16 / 9"
                    video={videoById[slide.imageGalleryItemId ?? '']}
                  />
                  <SizeWarning id={slide.imageGalleryItemId} slot="desktop" />
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
                  <span className="dash-label">Mobile (portrait)</span>
                  <HeroImageFrame
                    url={
                      urlById[slide.mobileImageGalleryItemId ?? ''] ??
                      urlById[slide.imageGalleryItemId ?? '']
                    }
                    localFile={
                      localFileById[slide.mobileImageGalleryItemId ?? ''] ??
                      localFileById[slide.imageGalleryItemId ?? '']
                    }
                    background={slide.background}
                    ratio="3 / 4"
                    muted={!slide.mobileImageGalleryItemId}
                    // Same fallback as the URL above: no mobile crop means the
                    // desktop media, so its kind too.
                    video={
                      slide.mobileImageGalleryItemId
                        ? videoById[slide.mobileImageGalleryItemId]
                        : videoById[slide.imageGalleryItemId ?? '']
                    }
                  />
                  {/* Only when a mobile crop is actually set — the frame falls
                      back to the desktop image, and warning about that one here
                      would say the same thing twice. */}
                  <SizeWarning
                    id={slide.mobileImageGalleryItemId}
                    slot="mobile"
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

          {/* Last in the card and collapsed by default: colours are an
              exception most slides never need, and the preview inside wants
              the text and image above it to already be set. */}
          <HeroSlideColors
            slide={slide}
            imageUrl={
              videoById[slide.imageGalleryItemId ?? '']
                ? videoById[slide.imageGalleryItemId ?? ''].poster ?? undefined
                : urlById[slide.imageGalleryItemId ?? '']
            }
            localFile={localFileById[slide.imageGalleryItemId ?? '']}
            onPatch={(patch) => patchSlide(slide.id, patch)}
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
            rememberKind(item);
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

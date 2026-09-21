'use client';

/**
 * The one media control for the Storefront Appearance tab (#102).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Media picking is implemented twice in this tab and the two copies disagree
 * on almost every detail. HeroEditor (:156-310 state, :440-547 UI, :604-644
 * modals) drives `ImageCropModal` itself, accepts `image/*`, always paints
 * local bytes, uploads into a folder literally called `Storefront`, previews
 * in a fixed-aspect frame with `object-fit: cover`, and carries a source-size
 * advisory. JournalEditor (:34-153, :234-327) goes through the `useImageCrop()`
 * provider, accepts `image/*,.heic,.heif,.hif`, paints local bytes only when
 * the browser can decode them, uploads into a folder named after the section
 * title, previews in a 72px square with `object-fit: contain`, and has no
 * advisory at all. Every one of those differences is an accident of the order
 * the two were written in, and three of them are latent bugs.
 *
 * One component now owns the whole job: pick from gallery, upload from device,
 * optional crop at a given aspect, local-bytes preview, video handling,
 * conversion polling, clear, and the size advisory.
 *
 * THE THREE DECISIONS
 * -------------------
 * 1. UPLOAD FOLDER NAMING — a stable literal (`uploadFolder`, default
 *    `'Storefront'`), never the section title.
 *
 *    `uploadDeviceFileToGallery(file, name)` uses its second argument as the
 *    name of a CHILD folder in the shop gallery, so JournalEditor's
 *    `section.title` turns merchant prose into gallery structure. Rename the
 *    section and the next upload silently starts a second folder while the old
 *    one is orphaned; clear the title and everything lands in a bucket called
 *    `Uploads`; give two sections the same title and their assets collide.
 *    None of that is a choice anyone made — it is what happens when a display
 *    string is used as an identifier. One predictable bucket per surface is
 *    findable a month later, which is the only thing folder naming is for.
 *
 * 2. PREVIEW GEOMETRY — one rule: the frame shows the media at the aspect it
 *    will actually be rendered at, filled edge to edge.
 *
 *    The frame answers "what will shoppers see", so when the slot declares a
 *    crop aspect the frame takes that aspect and `object-fit: cover` — and
 *    cover crops nothing, because the media was cropped to exactly that ratio
 *    on the way in. When a slot declares NO aspect we do not know the render
 *    ratio, so cover would be a lie that hides part of the picture; that frame
 *    is square and `contain`s the whole file, which is the honest form of the
 *    same rule. Both are 200px rather than Journal's 72px: a thumbnail small
 *    enough that two similar photographs look identical does not answer the
 *    question it exists to answer.
 *
 * 3. LOCAL-PREVIEW POLICY — paint local bytes only for formats a browser is
 *    certain to decode, by allowlist.
 *
 *    Hero paints always, which is only survivable because `accept="image/*"`
 *    usually hides HEIC — and on Windows it does not, because a .heic there
 *    has no registry MIME at all and arrives with an empty `type`. Journal
 *    gates on `type.startsWith('image/')`, which is the right instinct but
 *    lets `image/heic` through on the browsers that do report it. A HEIC
 *    passes the cropper untouched (see ImageCropProvider) and no browser
 *    decodes it, so painting it is a broken frame in the exact place the
 *    remote WebP the server just wrote renders fine. An allowlist cannot get
 *    this wrong the way a prefix test can.
 *
 *    The `accept` list follows from the same policy: images plus the bare
 *    `.heic/.heif/.hif` extensions, because a MIME-only list hides those files
 *    in the Windows file dialog entirely.
 *
 * WHAT MUST NOT REGRESS
 * ---------------------
 * - A gallery item can be `kind: 'video'`, and while its status is not `ready`
 *   its `url` is the ORIGINAL upload (ProRes/AVI/MKV) that a browser may not
 *   decode. Every preview here goes through `DashboardVideoViewer`, the one
 *   component allowed to render a video element; a not-ready clip shows its
 *   poster and never a `<video src={url}>`. See lib/gallery/types.ts:9-14.
 * - `useProcessingItemsPoll` re-reads converting clips and swaps poster for
 *   player in place, without disturbing anything else on screen.
 * - The size advisory is advisory. It never blocks a save, and an unknown
 *   source width is never a warning — `gallery_items.width` is nullable, so
 *   treating null as "too small" would flag a library of possibly-fine images
 *   and teach everyone to ignore the badge. That rule is structural here: the
 *   advisor is typed to take a `number` and is not called at all unless a
 *   positive width is known. `lib/storefront/hero-image-guidance.ts` supplies
 *   the hero wording; this component knows nothing about heroes.
 * - "One photo, crop for both" — one chosen file cropped 16:9 for desktop and
 *   immediately re-cropped 3:4 for mobile, producing two gallery items from
 *   one upload. It is a genuinely good affordance, so it is a first-class
 *   option (`chainedUpload`) rather than a quirk of one editor.
 */

import * as React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FieldRow, useFieldIds, describedBy } from './fields';
import { Advisory, HelpText, InlineError } from './Messages';
import GalleryPickerModal, {
  uploadDeviceFileToGallery,
} from '@/components/dashboard/GalleryPickerModal';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import DashboardVideoViewer from '@/components/dashboard/DashboardVideoViewer';
import {
  GalleryItemStatusBadge,
  galleryItemFailureMessage,
} from '@/components/dashboard/GalleryItemStatus';
import { getItem } from '@/lib/gallery/api';
import { galleryItemStatus } from '@/lib/gallery/status';
import { useProcessingItemsPoll } from '@/lib/gallery/use-processing-poll';
import type { ApiError } from '@/lib/api/client';
import type { GalleryItem } from '@/lib/gallery/types';

/* ------------------------------------------------------------------ */
/* Policy helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * What the device-upload button offers. Images, plus the bare HEIC extensions
 * — Windows reports no MIME type for .heic/.heif, so a MIME-only `accept`
 * hides those files in the picker and the admin cannot select a photo their
 * own phone took.
 */
export const MEDIA_UPLOAD_ACCEPT = 'image/*,.heic,.heif,.hif';

/**
 * Formats every current browser decodes from a Blob URL.
 *
 * An allowlist rather than a `startsWith('image/')` test, because `image/heic`
 * passes that test and no browser can paint it. Anything not listed simply
 * waits for the remote copy, which the server has already re-encoded to WebP.
 */
const LOCALLY_PAINTABLE = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
]);

/** Whether a file's own bytes can stand in for the remote copy. */
export function canPaintLocalBytes(file: File | null | undefined): boolean {
  if (!file) return false;
  return LOCALLY_PAINTABLE.has(file.type.trim().toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** What a size advisory says, when there is one to say. */
export interface MediaSizeAdvice {
  message: string;
}

/**
 * A single piece of media this field manages. One slot is the ordinary case;
 * two are the hero's desktop and mobile crops.
 */
export interface MediaSlotSpec {
  /**
   * Stable identity for this slot. Also the suffix on a cropped upload's
   * filename, so a gallery folder reads `autumn-desktop.jpg` /
   * `autumn-mobile.jpg` rather than two files with the same name.
   */
  key: string;
  /** How the slot is named to the admin, e.g. "Desktop (landscape)". */
  label: string;
  /** The stored gallery item id. */
  value: string | null;
  onChange: (galleryItemId: string | null) => void;
  /**
   * Aspect a device upload is cropped to, and therefore the aspect of the
   * preview frame. Omit for a free crop — see decision 2 for what that does
   * to the frame.
   */
  aspect?: number;
  /** Title on the crop modal. Defaults to "Crop for <label>". */
  cropTitle?: string;
  /**
   * The slot whose media stands in here while this one is empty — the hero
   * mobile frame falling back to the desktop image. Display only; nothing is
   * written to this slot.
   */
  fallbackToKey?: string;
  /** Shown under an empty slot that is falling back. */
  fallbackNote?: React.ReactNode;
  /**
   * "This source will look soft, and here is why."
   *
   * Called ONLY with a known, positive source width, so an advisor cannot
   * accidentally warn about an unknown one. Return null when the source is
   * fine. `heroImageWarning` from lib/storefront/hero-image-guidance.ts fits
   * this shape directly: `(w) => heroImageWarning(w, 'desktop')`.
   */
  sizeAdvisory?: (width: number) => MediaSizeAdvice | null;
}

export interface MediaFieldProps {
  /** The field's name, e.g. "Photograph or video". */
  label: string;
  /** One entry per slot, in the order they should read. */
  slots: MediaSlotSpec[];
  /** Standing guidance under the frames. */
  help?: React.ReactNode;
  /**
   * What an empty frame is painted with — the hero passes the slide's
   * background so the frame previews the colour the storefront will fall back
   * to. Defaults to the muted surface.
   */
  emptyFill?: string;
  /**
   * For a field whose media is always a still: videos stay visible in the
   * picker but cannot be chosen. Off by default — hero and journal take video.
   */
  imagesOnly?: boolean;
  /** The gallery folder device uploads land in. See decision 1. */
  uploadFolder?: string;
  /**
   * Offer "upload one photo and crop it for every slot". Defaults to on when
   * there is more than one slot, and is meaningless with one.
   */
  chainedUpload?: boolean;
  /** Overrides the generated chained-upload button label. */
  chainedUploadLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** Everything a frame needs about a resolved gallery item. */
type ResolvedItem = Pick<
  GalleryItem,
  'id' | 'kind' | 'url' | 'posterUrl' | 'width' | 'status' | 'processingError'
>;

function resolve(item: GalleryItem): ResolvedItem {
  return {
    id: item.id,
    kind: item.kind,
    url: item.url,
    posterUrl: item.posterUrl,
    width: item.width,
    status: item.status,
    processingError: item.processingError ?? null,
  };
}

/**
 * Name a cropped upload after the slot it is for, keeping whatever extension
 * the cropper produced. `-cropped` is dropped first: the provider appends it
 * to every file it returns, and `autumn-cropped-desktop.jpg` says the same
 * thing twice.
 */
function nameForSlot(file: File, slotKey: string): File {
  const dot = file.name.lastIndexOf('.');
  const base = (dot > 0 ? file.name.slice(0, dot) : file.name).replace(/-cropped$/, '');
  const ext = dot > 0 ? file.name.slice(dot + 1) : 'jpg';
  return new File([file], `${base}-${slotKey}.${ext}`, { type: file.type });
}

/* ------------------------------------------------------------------ */
/* The frame                                                           */
/* ------------------------------------------------------------------ */

function MediaFrame({
  item,
  localFile,
  aspect,
  emptyFill,
  muted,
  label,
}: {
  item?: ResolvedItem;
  /** Bytes for THIS item if it was uploaded in this session. */
  localFile?: File;
  aspect?: number;
  emptyFill?: string;
  /** Standing in for another slot — dimmed, and it owns no status line. */
  muted?: boolean;
  label: string;
}) {
  const isVideo = item?.kind === 'video';
  const hasMedia = Boolean(item?.url) || Boolean(localFile);

  return (
    <div
      data-slot="media-frame"
      data-media-kind={item?.kind ?? 'none'}
      className={cn(
        'relative w-full max-w-[200px] overflow-hidden rounded-md border border-border',
        hasMedia && 'bg-muted',
        muted && 'opacity-65',
      )}
      style={{
        // Decision 2: the render aspect when we know it, square when we do not.
        aspectRatio: aspect ?? 1,
        ...(hasMedia || !emptyFill ? {} : { background: emptyFill }),
      }}
    >
      {item && isVideo ? (
        <DashboardVideoViewer
          media={{
            url: item.url,
            posterUrl: item.posterUrl,
            status: item.status,
            processingError: item.processingError,
          }}
          variant="thumbnail"
          showStatusBadge={false}
          label={label}
          style={{ width: '100%', height: '100%' }}
        />
      ) : hasMedia ? (
        <UploadPreviewImage
          src={item?.url ?? ''}
          localFile={localFile ?? null}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            // Cover crops nothing when the frame IS the crop aspect; a slot
            // with no declared aspect has no such guarantee, so it contains.
            objectFit: aspect ? 'cover' : 'contain',
            display: 'block',
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MediaField                                                          */
/* ------------------------------------------------------------------ */

export function MediaField({
  label,
  slots,
  help,
  emptyFill,
  imagesOnly = false,
  uploadFolder = 'Storefront',
  chainedUpload,
  chainedUploadLabel,
  disabled = false,
  className,
  id,
}: MediaFieldProps) {
  const ids = useFieldIds(id);
  const cropImage = useImageCrop();

  const [itemById, setItemById] = React.useState<Record<string, ResolvedItem>>({});
  /**
   * Cropped bytes for an id uploaded in THIS session, so its frame paints from
   * memory instead of waiting on a guaranteed-cold miss through imgproxy.
   * Never populated for an id that was already stored when the editor loaded.
   */
  const [localById, setLocalById] = React.useState<Record<string, File>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickingKey, setPickingKey] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  /** Which slots the file about to arrive is destined for, in order. */
  const pendingKeysRef = React.useRef<string[]>([]);
  /** Ids already resolved or in flight, so no id is ever fetched twice. */
  const knownIdsRef = React.useRef<Set<string>>(new Set());

  const remember = React.useCallback((next: ResolvedItem) => {
    knownIdsRef.current.add(next.id);
    setItemById((m) => {
      const prev = m[next.id];
      if (
        prev &&
        prev.url === next.url &&
        prev.kind === next.kind &&
        prev.posterUrl === next.posterUrl &&
        prev.status === next.status &&
        prev.width === next.width
      ) {
        return m;
      }
      return { ...m, [next.id]: next };
    });
  }, []);

  const activeIds = React.useMemo(
    () => Array.from(new Set(slots.map((s) => s.value).filter((v): v is string => Boolean(v)))),
    [slots],
  );
  const activeKey = activeIds.join('|');

  // Resolve ids that were already stored when this editor loaded, so the
  // frames paint immediately rather than only after a re-pick. A failed read
  // is swallowed: a thumbnail is a convenience, and a saved id that no longer
  // resolves must not break the editor around it.
  React.useEffect(() => {
    let live = true;
    activeKey
      .split('|')
      .filter(Boolean)
      .forEach((itemId) => {
        if (knownIdsRef.current.has(itemId)) return;
        knownIdsRef.current.add(itemId);
        void getItem(itemId)
          .then((fresh) => {
            if (live) remember(resolve(fresh));
          })
          .catch(() => {
            knownIdsRef.current.delete(itemId);
          });
      });
    return () => {
      live = false;
    };
  }, [activeKey, remember]);

  // A clip still converting flips to the playing preview once the server has
  // it — its url changes too, from the unplayable original to the MP4.
  useProcessingItemsPoll(
    activeIds
      .map((itemId) => itemById[itemId])
      .filter((item): item is ResolvedItem => Boolean(item) && item.kind === 'video')
      .map((item) => ({ id: item.id, status: item.status })),
    (fresh) => fresh.forEach((f) => remember(resolve(f))),
  );

  const slotByKey = React.useMemo(() => {
    const map = new Map<string, MediaSlotSpec>();
    slots.forEach((s) => map.set(s.key, s));
    return map;
  }, [slots]);

  const showChained = (chainedUpload ?? slots.length > 1) && slots.length > 1;
  const chainedLabel =
    chainedUploadLabel ?? `Upload one photo — crop for ${slots.map((s) => s.label).join(' and ')}`;

  /** Forget any local bytes held against a slot's current value. */
  const forgetLocal = React.useCallback((itemId: string | null) => {
    if (!itemId) return;
    setLocalById((m) => {
      if (!(itemId in m)) return m;
      const next = { ...m };
      delete next[itemId];
      return next;
    });
  }, []);

  /**
   * Crop, upload and assign, once per target slot in turn.
   *
   * The chain is the point: with two targets the same chosen file opens the
   * cropper twice, at each slot's own aspect, and produces two gallery items.
   * Cancelling a crop stops the chain there and keeps whatever earlier slots
   * already took — the admin who wanted only the desktop crop gets it, rather
   * than losing the upload they just sat through.
   */
  async function runUpload(file: File, targetKeys: string[]) {
    setError(null);
    setBusy(true);
    try {
      for (const key of targetKeys) {
        const slot = slotByKey.get(key);
        if (!slot) continue;
        const cropped = await cropImage(file, {
          initialAspect: slot.aspect,
          title: slot.cropTitle ?? `Crop for ${slot.label}`,
        });
        if (!cropped) break;
        const named = nameForSlot(cropped, slot.key);
        const uploaded = await uploadDeviceFileToGallery(named, uploadFolder);
        // This button takes photographs; videos come from the Gallery. So the
        // item is an image whatever the response says about itself, and it is
        // ready — there is nothing to convert.
        remember({
          id: uploaded.id,
          kind: 'image',
          url: uploaded.url,
          posterUrl: null,
          width: uploaded.width,
          status: 'ready',
          processingError: null,
        });
        if (canPaintLocalBytes(named)) {
          setLocalById((m) => ({ ...m, [uploaded.id]: named }));
        }
        slot.onChange(uploaded.id);
      }
    } catch (e) {
      setError((e as ApiError)?.message || 'Failed to upload image.');
    } finally {
      setBusy(false);
    }
  }

  function openFilePicker(targetKeys: string[]) {
    pendingKeysRef.current = targetKeys;
    fileInputRef.current?.click();
  }

  return (
    <FieldRow label={label} ids={ids} help={help} labelAs="span" className={className}>
      <div
        role="group"
        aria-labelledby={ids.labelId}
        aria-describedby={describedBy(ids, { help: Boolean(help) })}
        aria-busy={busy || undefined}
        className="flex flex-col gap-3"
      >
        {showChained && (
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              onClick={() => openFilePicker(slots.map((s) => s.key))}
            >
              {busy ? 'Working…' : chainedLabel}
            </Button>
          </div>
        )}

        <div className={cn('grid gap-4', slots.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
          {slots.map((slot) => {
            const fallback = slot.fallbackToKey ? slotByKey.get(slot.fallbackToKey) : undefined;
            const shownId = slot.value ?? fallback?.value ?? null;
            const item = shownId ? itemById[shownId] : undefined;
            const localFile = shownId ? localById[shownId] : undefined;
            const standingIn = !slot.value && Boolean(shownId);

            // The status line belongs to the slot that actually owns the clip.
            // A frame only standing in for another slot would say it twice.
            const status = item?.kind === 'video' ? galleryItemStatus(item) : 'ready';
            const showStatusLine = !standingIn && item?.kind === 'video' && status !== 'ready';

            // Advisory only for media this slot really holds, and only when
            // the source width is actually known.
            const width = slot.value && item ? item.width : null;
            const advice =
              slot.sizeAdvisory && typeof width === 'number' && width > 0
                ? slot.sizeAdvisory(width)
                : null;

            return (
              <div key={slot.key} className="flex min-w-0 flex-col gap-2">
                {slots.length > 1 && (
                  <span className="text-sm leading-none font-medium text-foreground">
                    {slot.label}
                  </span>
                )}

                <MediaFrame
                  item={item}
                  localFile={localFile}
                  aspect={slot.aspect}
                  emptyFill={emptyFill}
                  muted={standingIn}
                  label={
                    slots.length > 1 ? `Chosen video for ${slot.label}` : 'Chosen video'
                  }
                />

                {showStatusLine &&
                  (status === 'failed' ? (
                    <InlineError>
                      <GalleryItemStatusBadge item={{ status }} inline />{' '}
                      {galleryItemFailureMessage({
                        processingError: item?.processingError ?? null,
                      })}{' '}
                      The storefront will only show its still — exchange it in the Gallery or
                      pick another.
                    </InlineError>
                  ) : (
                    <Advisory icon={false}>
                      <GalleryItemStatusBadge item={{ status }} inline /> The storefront shows
                      its still until the video has been converted.
                    </Advisory>
                  ))}

                {advice && <Advisory>{advice.message}</Advisory>}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || busy}
                    onClick={() => openFilePicker([slot.key])}
                  >
                    {slot.aspect ? 'Upload and crop' : 'Upload from this device'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || busy}
                    onClick={() => setPickingKey(slot.key)}
                  >
                    Gallery
                  </Button>
                  {slot.value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || busy}
                      onClick={() => {
                        forgetLocal(slot.value);
                        slot.onChange(null);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {!slot.value && slot.fallbackNote && <HelpText>{slot.fallbackNote}</HelpText>}
              </div>
            );
          })}
        </div>

        {error && <InlineError>{error}</InlineError>}

        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_UPLOAD_ACCEPT}
          hidden
          data-testid="media-field-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const targets = pendingKeysRef.current;
            // Cleared before anything awaits: choosing the same file twice in
            // a row fires no change event unless the input is reset first.
            e.target.value = '';
            pendingKeysRef.current = [];
            if (file && targets.length > 0) void runUpload(file, targets);
          }}
        />
      </div>

      {pickingKey && (
        <GalleryPickerModal
          imagesOnly={imagesOnly}
          aspectRatio={slotByKey.get(pickingKey)?.aspect}
          onClose={() => setPickingKey(null)}
          onSelect={(picked) => {
            const slot = slotByKey.get(pickingKey);
            setPickingKey(null);
            if (!slot) return;
            // A different EXISTING item — drop any local bytes held for the
            // slot so the frame cannot keep showing the previous photograph.
            forgetLocal(slot.value);
            remember(resolve(picked));
            slot.onChange(picked.id);
          }}
        />
      )}
    </FieldRow>
  );
}

export default MediaField;

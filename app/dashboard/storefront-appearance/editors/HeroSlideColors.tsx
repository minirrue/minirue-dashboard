'use client';

import React, { useState } from 'react';
import type { HeroSlide } from '@/lib/api/storefront';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import {
  HERO_COLOR_FIELDS,
  HERO_COLOR_LABELS,
  HERO_COLOR_THEME_DEFAULTS,
  HERO_COLOR_THRESHOLDS,
  CONTRAST_AA_NORMAL,
  contrastWarning,
  countSetColors,
  measurableSlideBackground,
  parseHexInput,
  type HeroColorField,
} from '@/lib/hero-slide-colors';

/**
 * Advisory line, styled and announced exactly like `SizeWarning` in
 * HeroEditor — same warning colour, same `role="status"` rather than `alert`.
 * It is advice about taste and readability, not a correctness failure, and an
 * assertive announcement would interrupt an admin mid-edit.
 */
function ColorAdvice({ children }: { children: React.ReactNode }) {
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
      {children}
    </p>
  );
}

/**
 * One colour slot.
 *
 * ## The whole design turns on "unset is a real state"
 *
 * A bare `<input type="color">` cannot express null. It always holds a value
 * and an unset one reads as `#000000`, so binding one directly to a nullable
 * field means the first render of the editor proposes black for all six slots
 * on every slide — and a single unrelated save would then repaint every hero
 * on the site black. That is the failure this component exists to make
 * impossible.
 *
 * So the null state does not render a colour input at all. It renders a
 * button. Until an admin presses it there is no colour widget on screen to
 * accidentally commit, and `onChange(null)` is what the slide keeps holding.
 * Pressing it seeds the CURRENT THEME COLOUR rather than black, so the first
 * thing the admin sees is the slide as it already looks, and their first drag
 * of the picker is a deliberate move away from it.
 *
 * Going back is one button — "Theme default" — always visible while a colour
 * is set. Reachable, obvious, and it writes a real `null`, not `''` (an empty
 * string fails the backend regex and would take the entire save down with it).
 */
function ColorField({
  field,
  value,
  onChange,
  measuredAgainst,
}: {
  field: HeroColorField;
  value: string | null;
  onChange: (next: string | null) => void;
  /**
   * The flat colour this text will sit on, when there is one to measure
   * against — null for a photograph or a gradient, where the honest answer is
   * "look at the preview", not a made-up number.
   */
  measuredAgainst: string | null;
}) {
  const label = HERO_COLOR_LABELS[field];
  const themeDefault = HERO_COLOR_THEME_DEFAULTS[field];

  /**
   * The hex box is a DRAFT. Typing "#1a2b3c" passes through "#1", "#1a", … —
   * every one of which fails the backend's regex. Committing on each keystroke
   * would leave the slide holding a rejectable value the moment the admin
   * pauses, so the draft lives here and only a string that parses is pushed
   * up. A draft that never parses is discarded on blur and the box snaps back
   * to what is actually stored, so the box never lies about the saved value.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value ?? '';
  const draftIsBad = draft !== null && draft.trim() !== '' && parseHexInput(draft) === null;

  const warning =
    value === null
      ? null
      : contrastWarning(value, measuredAgainst, HERO_COLOR_THRESHOLDS[field], label);

  return (
    <div className="dash-field hero-color-field">
      <span className="dash-label">{label}</span>

      {value === null ? (
        <div className="hero-color-row">
          <span
            className="hero-color-chip"
            style={{ background: themeDefault }}
            aria-hidden="true"
          />
          <span className="hero-color-default-note">Theme default</span>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={() => {
              setDraft(null);
              onChange(themeDefault);
            }}
          >
            Pick a colour
          </button>
        </div>
      ) : (
        <>
          <div className="hero-color-row">
            <input
              type="color"
              className="hero-color-swatch"
              aria-label={`${label} colour`}
              value={value}
              onChange={(e) => {
                // A native colour input can only ever emit `#rrggbb`, so this
                // path is contract-safe by construction.
                setDraft(null);
                onChange(e.target.value);
              }}
            />
            <input
              className={`dash-input hero-color-hex${draftIsBad ? ' dash-input-error' : ''}`}
              aria-label={`${label} hex code`}
              inputMode="text"
              spellCheck={false}
              maxLength={7}
              placeholder={themeDefault}
              value={shown}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const parsed = parseHexInput(raw);
                if (parsed) onChange(parsed);
              }}
              onBlur={() => setDraft(null)}
            />
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => {
                setDraft(null);
                // A real null. Never '' — an empty string fails the backend
                // regex and takes the whole layout save with it.
                onChange(null);
              }}
            >
              Theme default
            </button>
          </div>
          {draftIsBad && (
            <p className="dash-field-error">
              Not a hex colour yet — use #rrggbb or #rgb. The last valid value is still saved.
            </p>
          )}
          {warning && <ColorAdvice>{warning.message}</ColorAdvice>}
        </>
      )}
    </div>
  );
}

/**
 * What the copy will actually look like, over this slide's own art.
 *
 * The point of the whole feature is readability over a specific photograph, so
 * the most useful guidance is not a number — it is the text, in the chosen
 * colours, on the image the shopper will see. Unset slots render in the theme
 * colour, so the preview also answers "what does default even look like here".
 *
 * Deliberately not pixel-exact: no scrim gradients, no fonts, no entry
 * animation. It is a legibility check, not a second renderer to keep in sync
 * with the storefront — a copy that drifts is worse than one that is obviously
 * an approximation.
 */
function ColorPreview({
  slide,
  imageUrl,
  localFile,
}: {
  slide: HeroSlide;
  imageUrl?: string;
  localFile?: File | null;
}) {
  const c = (field: HeroColorField) => slide[field] ?? HERO_COLOR_THEME_DEFAULTS[field];
  const showImage = slide.mode === 'image' && Boolean(imageUrl);

  return (
    <div
      className="hero-color-preview"
      style={{ background: showImage ? 'var(--mr-dash-sub)' : slide.background }}
    >
      {showImage && imageUrl && (
        <UploadPreviewImage
          src={imageUrl}
          localFile={localFile}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      <div className="hero-color-preview-copy">
        <div className="hero-color-preview-eyebrow" style={{ color: c('eyebrowColor') }}>
          {slide.eyebrow || 'Eyebrow'}
        </div>
        <div className="hero-color-preview-headline" style={{ color: c('headlineColor') }}>
          {slide.headline || 'Headline'}
        </div>
        <div className="hero-color-preview-sub" style={{ color: c('subColor') }}>
          {slide.sub || 'Sub line'}
        </div>
        <div className="hero-color-preview-tagline" style={{ color: c('taglineColor') }}>
          {slide.tagline || 'Tagline'}
        </div>
        {slide.ctaLabel && (
          <span
            className="hero-color-preview-cta"
            style={{ background: c('ctaBgColor'), color: c('ctaTextColor') }}
          >
            {slide.ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The six per-slide colour overrides, as one collapsed block.
 *
 * ## Why collapsed, and why native <details>
 *
 * The slide editor is already long — style, four text runs, a button label,
 * two image pickers with previews and warnings, a CTA target — and the hero
 * takes up to 8 slides. Six more controls per slide, always open, would add
 * roughly half a screen each and push the "Add slide" button somewhere nobody
 * scrolls to. Colours are also the exception rather than the rule: most slides
 * will never override one.
 *
 * `<details>`/`<summary>` gives collapse for free — keyboard operable, works
 * with no JS state to get out of sync, and browser find-in-page opens it. The
 * summary carries the override count, so an admin can see WHICH slide has
 * custom colours without opening any of them; that is the question they
 * actually ask when a hero looks wrong.
 */
export default function HeroSlideColors({
  slide,
  imageUrl,
  localFile,
  onPatch,
}: {
  slide: HeroSlide;
  imageUrl?: string;
  localFile?: File | null;
  onPatch: (patch: Partial<HeroSlide>) => void;
}) {
  const setCount = countSetColors(slide);
  const measuredAgainst = measurableSlideBackground(
    slide.mode,
    slide.background,
    Boolean(slide.imageGalleryItemId),
  );

  /**
   * The one contrast number that is always real. Both sides of the CTA are
   * solid colours by definition — the fill and the label — so this ratio is
   * exact regardless of what the photograph behind it is doing. Computed
   * against the theme value when either side is unset, which is the colour
   * that will actually render.
   */
  const ctaWarning = contrastWarning(
    slide.ctaTextColor ?? HERO_COLOR_THEME_DEFAULTS.ctaTextColor,
    slide.ctaBgColor ?? HERO_COLOR_THEME_DEFAULTS.ctaBgColor,
    CONTRAST_AA_NORMAL,
    'Button text on button fill',
  );

  return (
    <details className="hero-color-details">
      <summary className="hero-color-summary">
        <span>Colours</span>
        <span className="hero-color-count">
          {setCount === 0 ? 'All theme default' : `${setCount} of 6 custom`}
        </span>
      </summary>

      <div className="hero-color-body">
        <p className="dash-help-text" style={{ marginTop: 0 }}>
          Hero text uses the storefront theme unless you override it here. Pale
          photographs can swallow the default gold and cream — set a colour on
          whichever lines are hard to read, and leave the rest on the theme so
          they keep following it.
        </p>

        <ColorPreview slide={slide} imageUrl={imageUrl} localFile={localFile} />

        {measuredAgainst === null && (
          <p className="dash-help-text">
            Contrast over a photograph changes across the image, so there is no
            single number to check — judge it in the preview above, at the size
            it will render.
          </p>
        )}

        <div className="dash-form-grid">
          {HERO_COLOR_FIELDS.map((field) => (
            <ColorField
              key={field}
              field={field}
              value={slide[field] ?? null}
              /* The two CTA slots are judged as a PAIR, once, below the grid —
                 the button's fill and its label are only meaningful against
                 each other, and warning on both fields would say the same
                 thing twice. The four text slots are judged against whatever
                 they sit on, when that is measurable. */
              measuredAgainst={
                field === 'ctaBgColor' || field === 'ctaTextColor' ? null : measuredAgainst
              }
              onChange={(next) => onPatch({ [field]: next } as Partial<HeroSlide>)}
            />
          ))}
        </div>

        {ctaWarning && <ColorAdvice>{ctaWarning.message}</ColorAdvice>}
      </div>
    </details>
  );
}

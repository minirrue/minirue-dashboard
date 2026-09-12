import {
  CONTRAST_AA_NORMAL,
  HERO_COLOR_FIELDS,
  HERO_COLOR_PATTERN,
  HERO_COLOR_THEME_DEFAULTS,
  contrastRatio,
  contrastWarning,
  countSetColors,
  expandHex,
  measurableSlideBackground,
  parseHexInput,
  sanitizeHeroColor,
} from '@/lib/hero-slide-colors';

/**
 * The contract these tests exist to defend.
 *
 * The backend validates every hero slide colour with
 * /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/ or null, and zod rejects the WHOLE
 * layout on one bad value — so a stray `rgb()` or an empty string does not
 * lose a colour, it loses the admin's entire save. Everything below is about
 * making that unreachable from the dashboard.
 */

describe('the pinned hex contract', () => {
  it('is exactly the backend regex', () => {
    expect(HERO_COLOR_PATTERN.source).toBe('^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$');
  });

  it('names all six fields', () => {
    expect([...HERO_COLOR_FIELDS]).toEqual([
      'eyebrowColor',
      'headlineColor',
      'subColor',
      'taglineColor',
      'ctaBgColor',
      'ctaTextColor',
    ]);
  });

  it('ships a theme default for each field that is itself contract-valid', () => {
    for (const field of HERO_COLOR_FIELDS) {
      expect(HERO_COLOR_THEME_DEFAULTS[field]).toMatch(HERO_COLOR_PATTERN);
    }
  });

  it('never seeds #000000 — a black default would repaint every hero', () => {
    for (const field of HERO_COLOR_FIELDS) {
      if (field === 'ctaTextColor') continue; // the theme's button label IS near-black
      expect(HERO_COLOR_THEME_DEFAULTS[field]).not.toBe('#000000');
    }
  });
});

describe('parseHexInput', () => {
  it('accepts both contract shapes', () => {
    expect(parseHexInput('#abc')).toBe('#abc');
    expect(parseHexInput('#AABBCC')).toBe('#aabbcc');
  });

  it('adds the hash a pasted brand hex is missing', () => {
    expect(parseHexInput('B0924F')).toBe('#b0924f');
  });

  it.each([
    ['', 'an empty box — clearing is a separate, explicit action'],
    ['#', 'a lone hash'],
    ['#ab', 'a half-typed hex'],
    ['#abcd', 'four digits'],
    ['#abcde', 'five digits'],
    ['#gggggg', 'non-hex digits'],
    ['rgb(0,0,0)', 'a CSS function the backend rejects'],
    ['rebeccapurple', 'a named colour the backend rejects'],
    ['#aabbccdd', 'eight-digit hex with alpha'],
  ])('refuses %s (%s)', (raw) => {
    expect(parseHexInput(raw)).toBeNull();
  });
});

describe('sanitizeHeroColor — the last gate before the wire', () => {
  it('passes a valid hex through untouched', () => {
    expect(sanitizeHeroColor('#C9B483')).toBe('#C9B483');
  });

  it.each([['', 'empty string'], ['rgb(1,2,3)', 'css function'], ['gold', 'named colour']])(
    'turns %s into null rather than letting it fail the whole save',
    (bad) => {
      expect(sanitizeHeroColor(bad)).toBeNull();
    },
  );

  it('turns undefined and non-strings into null', () => {
    expect(sanitizeHeroColor(undefined)).toBeNull();
    expect(sanitizeHeroColor(null)).toBeNull();
    expect(sanitizeHeroColor(123)).toBeNull();
  });
});

describe('contrast', () => {
  it('computes the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('expands shorthand before measuring, so #fff and #ffffff agree', () => {
    expect(expandHex('#fff')).toBe('#ffffff');
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(contrastRatio('#000000', '#ffffff'), 5);
  });

  it('warns about the case the owner reported — gold tagline on a pale photo', () => {
    const warning = contrastWarning('#c9b483', '#f6f2e9', CONTRAST_AA_NORMAL, 'Tagline');

    expect(warning).not.toBeNull();
    expect(warning?.needed).toBe(CONTRAST_AA_NORMAL);
    expect(warning?.message).toContain('Tagline');
  });

  it('stays quiet when the pair is readable', () => {
    expect(contrastWarning('#ffffff', '#0b0b0b', CONTRAST_AA_NORMAL, 'Tagline')).toBeNull();
  });

  it('returns null rather than guessing when a side is unknown', () => {
    // A number nobody can trust teaches everyone to ignore the badge.
    expect(contrastWarning('#ffffff', null, CONTRAST_AA_NORMAL, 'Tagline')).toBeNull();
    expect(contrastWarning(null, '#ffffff', CONTRAST_AA_NORMAL, 'Tagline')).toBeNull();
    expect(contrastWarning('goldenrod', '#ffffff', CONTRAST_AA_NORMAL, 'Tagline')).toBeNull();
  });
});

describe('measurableSlideBackground', () => {
  it('is null for a photograph — contrast varies pixel to pixel', () => {
    expect(measurableSlideBackground('image', '#0b0b0b', true)).toBeNull();
  });

  it('measures the flat colour an editorial slide renders on', () => {
    expect(measurableSlideBackground('editorial', '#0B0B0B', false)).toBe('#0b0b0b');
  });

  it('measures the fallback colour of an image slide with no image yet', () => {
    expect(measurableSlideBackground('image', '#0b0b0b', false)).toBe('#0b0b0b');
  });

  it('is null for a gradient background, which has no single value', () => {
    expect(
      measurableSlideBackground('editorial', 'linear-gradient(#000, #fff)', false),
    ).toBeNull();
  });
});

describe('countSetColors', () => {
  it('counts an untouched slide as zero overrides', () => {
    expect(countSetColors({})).toBe(0);
    expect(
      countSetColors({
        eyebrowColor: null,
        headlineColor: null,
        subColor: null,
        taglineColor: null,
        ctaBgColor: null,
        ctaTextColor: null,
      }),
    ).toBe(0);
  });

  it('counts only the fields actually set', () => {
    expect(countSetColors({ taglineColor: '#fff', ctaBgColor: '#000' })).toBe(2);
  });
});

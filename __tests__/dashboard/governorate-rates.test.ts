import {
  MAX_FEE_CENTS,
  feeCentsToInput,
  formatFee,
  newGovernorateDraft,
  nextGovernorateKey,
  normaliseGovernorate,
  parseFeeInput,
  ratesToDrafts,
  resolveGovernorateRate,
  slugifyGovernorateKey,
  summariseRatesEffect,
  validateGovernorateRates,
  type GovernorateRate,
  type GovernorateRateDraft,
} from '@/lib/shipping/governorate-rates';

/**
 * Per-governorate delivery fees, admin side (minirue-backend#83).
 *
 * The backend half is live and this suite is about not breaking it from here.
 * Four things it pins, in the order they cost money if wrong:
 *
 *  1. A blank fee is NEVER zero. An empty table is NEVER free shipping.
 *  2. A key, once saved, does not move when the label does.
 *  3. The duplicate-spelling rules agree with the server's, so a save this
 *     dashboard lets through is one the server will accept.
 *  4. The numbers shown to the admin are the numbers the storefront will use.
 */

const draft = (over: Partial<GovernorateRateDraft> = {}): GovernorateRateDraft => ({
  ...newGovernorateDraft(),
  key: 'cairo',
  label: 'Cairo',
  feeInput: '50.00',
  enabled: true,
  aliases: [],
  isNew: false,
  ...over,
});

// ===========================================================================
// 1. The null-vs-default trap
// ===========================================================================

describe('a blank fee is not free delivery', () => {
  it.each(['', '   ', 'abc', '50abc', '-1', '.'])(
    'parseFeeInput(%p) is null, not 0',
    (input) => {
      expect(parseFeeInput(input)).toBeNull();
    },
  );

  it('only a typed zero produces a zero fee', () => {
    expect(parseFeeInput('0')).toBe(0);
    expect(parseFeeInput('0.00')).toBe(0);
  });

  it('reads plain decimals as minor units', () => {
    expect(parseFeeInput('50')).toBe(5000);
    expect(parseFeeInput('70.00')).toBe(7000);
    expect(parseFeeInput('12.5')).toBe(1250);
    // Float arithmetic: 120.15 * 100 is 12014.999... without the rounding.
    expect(parseFeeInput('120.15')).toBe(12015);
  });

  it('BLOCKS the save when a row has no fee, and says so in those words', () => {
    const { issues } = validateGovernorateRates([draft({ label: 'Aswan', key: 'aswan', feeInput: '' })]);
    const fee = issues.find((i) => i.field === 'fee');
    expect(fee).toBeDefined();
    expect(fee!.message).toContain('Aswan');
    expect(fee!.message).toMatch(/not free delivery/i);
  });

  it('a brand new row starts with a BLANK fee, never 0', () => {
    const row = newGovernorateDraft();
    expect(row.feeInput).toBe('');
    expect(parseFeeInput(row.feeInput)).toBeNull();
    // And it cannot be saved in that state.
    expect(validateGovernorateRates([{ ...row, label: 'Giza', key: 'giza' }]).issues).toHaveLength(1);
  });

  it('a stored row whose fee is not a number becomes BLANK, not 0', () => {
    // A payload written around the schema, or by an older tool. Drafting it as
    // 0 would make the next unrelated save ship that governorate free.
    const drafts = ratesToDrafts([
      { key: 'cairo', label: 'Cairo', feeCents: '5000', enabled: true, aliases: [] } as unknown as GovernorateRate,
    ]);
    expect(drafts[0].feeInput).toBe('');
  });

  it('a typed zero is allowed, and is called out rather than hidden', () => {
    const { issues, notices, rates } = validateGovernorateRates([
      draft({ label: 'Cairo', key: 'cairo', feeInput: '0' }),
    ]);
    expect(issues).toHaveLength(0);
    expect(rates[0].feeCents).toBe(0);
    expect(notices.some((n) => /free delivery to cairo/i.test(n.message))).toBe(true);
  });

  it('an EMPTY table is valid, and produces an empty array — not a missing one', () => {
    const { issues, rates } = validateGovernorateRates([]);
    expect(issues).toHaveLength(0);
    expect(rates).toEqual([]);
  });

  it('an empty table charges the GLOBAL rate, which is not zero', () => {
    const effect = summariseRatesEffect([], 7000, 0);
    expect(effect.rateCount).toBe(0);
    expect(effect.globalFeeCents).toBe(7000);
    expect(effect.minFeeCents).toBe(7000);
    expect(effect.maxFeeCents).toBe(7000);
    // The resolver agrees: no table is NO_RATES billed at the flat rate.
    const resolved = resolveGovernorateRate([], 7000, 'Cairo');
    expect(resolved.status).toBe('NO_RATES');
    expect(resolved.baseFeeCents).toBe(7000);
  });

  it('rejects a fee above the server maximum instead of having it bounce', () => {
    const { issues } = validateGovernorateRates([
      draft({ feeInput: String(MAX_FEE_CENTS / 100 + 1) }),
    ]);
    expect(issues.some((i) => i.field === 'fee')).toBe(true);
  });
});

// ===========================================================================
// 2. Keys are stable, labels are cosmetic
// ===========================================================================

describe('keys', () => {
  it('derives a server-legal key from a label', () => {
    expect(slugifyGovernorateKey('Cairo')).toBe('cairo');
    expect(slugifyGovernorateKey('North Sinai')).toBe('north-sinai');
    expect(slugifyGovernorateKey('  Kafr El-Sheikh  ')).toBe('kafr-el-sheikh');
  });

  it('keeps an Arabic label Arabic rather than inventing a Latin slug', () => {
    // The server's key regex is \p{L}, not [a-z], precisely so an Egyptian
    // admin is not made to transliterate — a slug they invent is one they can
    // mistype.
    expect(slugifyGovernorateKey('القاهرة')).toBe('القاهرة');
  });

  it('returns empty for a label with no identity, rather than guessing', () => {
    expect(slugifyGovernorateKey('—')).toBe('');
    expect(slugifyGovernorateKey('   ')).toBe('');
  });

  it('never reuses a key another row has claimed', () => {
    expect(nextGovernorateKey('Cairo', [])).toBe('cairo');
    expect(nextGovernorateKey('Cairo', ['cairo'])).toBe('cairo-2');
    expect(nextGovernorateKey('Cairo', ['cairo', 'cairo-2'])).toBe('cairo-3');
    expect(nextGovernorateKey('—', [])).toBe('governorate');
  });

  it('a row loaded from the server is NOT new, so its key is frozen', () => {
    const drafts = ratesToDrafts([
      { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
    ]);
    expect(drafts[0].isNew).toBe(false);
  });

  it('renaming the LABEL of a saved row leaves its key alone', () => {
    // The editor only re-derives a key while `isNew`; this is the contract
    // that behaviour protects. The backend snapshots the key onto every order
    // placed against the row, so a moved key detaches a governorate from its
    // own order history.
    const [row] = ratesToDrafts([
      { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
    ]);
    const renamed = { ...row, label: 'Cairo Governorate' };
    const { rates } = validateGovernorateRates([renamed]);
    expect(rates[0].key).toBe('cairo');
    expect(rates[0].label).toBe('Cairo Governorate');
  });

  it('rejects a key the server would reject', () => {
    for (const key of ['has space', '-leading', '', 'has.dot']) {
      const { issues } = validateGovernorateRates([draft({ key })]);
      expect(issues.some((i) => i.field === 'key')).toBe(true);
    }
    expect(validateGovernorateRates([draft({ key: 'north_sinai-2' })]).issues).toHaveLength(0);
  });

  it('rejects two rows sharing a key', () => {
    const { issues } = validateGovernorateRates([
      draft({ key: 'cairo', label: 'Cairo' }),
      draft({ key: 'cairo', label: 'Cairo Two' }),
    ]);
    expect(issues.some((i) => i.field === 'key' && /unique/i.test(i.message))).toBe(true);
  });
});

// ===========================================================================
// 3. Aliases, and the normalisation they sit on top of
// ===========================================================================

describe('normaliseGovernorate — the advisory port of the server rule', () => {
  it('folds the spellings that are already live in the address column', () => {
    // The exact list minirue-backend#83 names as sitting in customer_addresses.
    const cairo = normaliseGovernorate('Cairo');
    expect(normaliseGovernorate('cairo')).toBe(cairo);
    expect(normaliseGovernorate('CAIRO')).toBe(cairo);
    expect(normaliseGovernorate('Cairo Governorate')).toBe(cairo);
    expect(normaliseGovernorate('  Cairo  ')).toBe(cairo);
    expect(normaliseGovernorate('Cairo.')).toBe(cairo);
  });

  it('folds Arabic letter forms and the leading محافظة', () => {
    const ar = normaliseGovernorate('القاهرة');
    expect(normaliseGovernorate('القاهره')).toBe(ar);
    expect(normaliseGovernorate('محافظة القاهرة')).toBe(ar);
    expect(normaliseGovernorate('محافظه القاهره')).toBe(ar);
  });

  it('returns null for anything that names nowhere', () => {
    // '—' is what the backend's manual-order path writes for a phone order.
    expect(normaliseGovernorate('—')).toBeNull();
    expect(normaliseGovernorate('')).toBeNull();
    expect(normaliseGovernorate('   ')).toBeNull();
    expect(normaliseGovernorate(undefined)).toBeNull();
    expect(normaliseGovernorate(42)).toBeNull();
  });

  it('never folds two different places together', () => {
    expect(normaliseGovernorate('Giza')).not.toBe(normaliseGovernorate('Cairo'));
    expect(normaliseGovernorate('North Sinai')).not.toBe(normaliseGovernorate('South Sinai'));
  });
});

describe('resolving a free-text governorate', () => {
  const rates: GovernorateRate[] = [
    { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: ['Kahira'] },
    { key: 'giza', label: 'Giza', feeCents: 6000, enabled: true, aliases: [] },
    { key: 'sinai', label: 'North Sinai', feeCents: 12000, enabled: false, aliases: [] },
    { key: 'alex', label: 'Alexandria', feeCents: 8000, enabled: true, aliases: [] },
  ];

  it('matches however the shopper spelled it', () => {
    const r = resolveGovernorateRate(rates, 7000, 'cairo governorate');
    expect(r.status).toBe('MATCHED');
    expect(r.key).toBe('cairo');
    // KEY rather than LABEL because both normalise to "cairo" and the key pass
    // sweeps the whole table first — the stricter of the two, deliberately.
    expect(r.matchedOn).toBe('KEY');
    expect(r.baseFeeCents).toBe(5000);
  });

  it('matches on the label when the key is not what the shopper typed', () => {
    const r = resolveGovernorateRate(rates, 7000, '  ALEXANDRIA.  ');
    expect(r.status).toBe('MATCHED');
    expect(r.key).toBe('alex');
    expect(r.matchedOn).toBe('LABEL');
    expect(r.baseFeeCents).toBe(8000);
  });

  it('matches an alias an admin added for a historical spelling', () => {
    const r = resolveGovernorateRate(rates, 7000, 'KAHIRA');
    expect(r.key).toBe('cairo');
    expect(r.matchedOn).toBe('ALIAS');
  });

  it('reports a MISS instead of silently billing the global rate', () => {
    const r = resolveGovernorateRate(rates, 7000, 'Luxor');
    expect(r.status).toBe('NO_MATCH');
    expect(r.key).toBeNull();
    expect(r.baseFeeCents).toBe(7000);
  });

  it('separates "named nowhere" from "named somewhere unknown"', () => {
    expect(resolveGovernorateRate(rates, 7000, '—').status).toBe('NO_GOVERNORATE');
  });

  it('a not-offered governorate still resolves — and is still charged', () => {
    // The backend models `enabled` but does NOT enforce it. The editor has to
    // say so, which it can only do if this distinction survives.
    const r = resolveGovernorateRate(rates, 7000, 'North Sinai');
    expect(r.status).toBe('DISABLED');
    expect(r.baseFeeCents).toBe(12000);
  });

  it('an alias cannot steal an address that names another row outright', () => {
    // KEY, then LABEL, then ALIAS — each swept across the whole table.
    const shadowed: GovernorateRate[] = [
      { key: 'giza', label: 'Giza', feeCents: 6000, enabled: true, aliases: ['Cairo'] },
      { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
    ];
    expect(resolveGovernorateRate(shadowed, 7000, 'Cairo').key).toBe('cairo');
  });
});

describe('one spelling cannot select two fees', () => {
  it('rejects an alias that collides with another row, before the server does', () => {
    const { issues } = validateGovernorateRates([
      draft({ key: 'cairo', label: 'Cairo' }),
      draft({ key: 'giza', label: 'Giza', aliases: ['cairo governorate'] }),
    ]);
    const collision = issues.find((i) => i.field === 'aliases');
    expect(collision).toBeDefined();
    expect(collision!.message).toMatch(/one spelling cannot select two fees/i);
  });

  it('rejects two labels that normalise to the same place', () => {
    const { issues } = validateGovernorateRates([
      draft({ key: 'cairo', label: 'Cairo' }),
      draft({ key: 'cairo-2', label: 'CAIRO GOVERNORATE' }),
    ]);
    expect(issues.some((i) => i.field === 'label')).toBe(true);
  });

  it('allows the same alias on the SAME row twice over — it is not a collision', () => {
    const { issues } = validateGovernorateRates([
      draft({ key: 'cairo', label: 'Cairo', aliases: ['cairo', 'CAIRO'] }),
    ]);
    expect(issues).toHaveLength(0);
  });

  it('says quietly when an alias was already being matched anyway', () => {
    const { notices } = validateGovernorateRates([
      draft({ key: 'cairo', label: 'Cairo', aliases: ['Cairo Governorate'] }),
    ]);
    // Casing and the "Governorate" suffix are folded automatically, so this
    // alias is doing nothing — worth saying, not worth blocking.
    expect(notices.some((n) => n.field === 'aliases' && /changes nothing/i.test(n.message))).toBe(true);
  });

  it('keeps a genuinely different word as a real alias with no complaint', () => {
    const { issues, notices } = validateGovernorateRates([
      draft({ key: 'cairo', label: 'Cairo', aliases: ['القاهرة', 'Kahira'] }),
    ]);
    expect(issues).toHaveLength(0);
    expect(notices.filter((n) => n.field === 'aliases')).toHaveLength(0);
  });

  it('drops blank aliases rather than sending what the server rejects', () => {
    const { rates } = validateGovernorateRates([
      draft({ aliases: ['  ', 'Kahira', ''] }),
    ]);
    expect(rates[0].aliases).toEqual(['Kahira']);
  });
});

// ===========================================================================
// 4. Showing the effect
// ===========================================================================

describe('the effect an admin is shown', () => {
  const table = [
    draft({ key: 'cairo', label: 'Cairo', feeInput: '50' }),
    draft({ key: 'giza', label: 'Giza', feeInput: '60' }),
    draft({ key: 'aswan', label: 'Aswan', feeInput: '120' }),
  ];

  it('computes the "from EGP X" price exactly as the server computes minFeeCents', () => {
    // min(flatRate, every ENABLED rate) — the global rate is included because
    // an address matching nothing pays it.
    expect(summariseRatesEffect(table, 7000, 0).minFeeCents).toBe(5000);
    expect(summariseRatesEffect(table, 4000, 0).minFeeCents).toBe(4000);
    expect(summariseRatesEffect([], 7000, 0).minFeeCents).toBe(7000);
  });

  it('excludes a not-offered row from the quoted price, as the server does', () => {
    const withDisabled = [...table, draft({ key: 'x', label: 'X', feeInput: '10', enabled: false })];
    expect(summariseRatesEffect(withDisabled, 7000, 0).minFeeCents).toBe(5000);
  });

  it('flags the case where a not-offered row undercuts the advertised price', () => {
    // The server excludes disabled rows from minFeeCents but still CHARGES
    // them, so this combination advertises "from 50" and bills 10.
    const withDisabled = [...table, draft({ key: 'x', label: 'X', feeInput: '10', enabled: false })];
    expect(summariseRatesEffect(withDisabled, 7000, 0).disabledUndercutsQuote).toBe(true);
    expect(summariseRatesEffect(table, 7000, 0).disabledUndercutsQuote).toBe(false);
  });

  it('names the dearest governorate, so free shipping can be judged against it', () => {
    const effect = summariseRatesEffect(table, 7000, 150000);
    expect(effect.maxFeeCents).toBe(12000);
    expect(effect.maxFeeLabel).toBe('Aswan');
    expect(effect.freeOverCents).toBe(150000);
  });

  it('falls back to the global rate as the dearest when no row beats it', () => {
    const effect = summariseRatesEffect([draft({ feeInput: '10' })], 7000, 0);
    expect(effect.maxFeeCents).toBe(7000);
    expect(effect.maxFeeLabel).toBeNull();
  });

  it('ignores rows with no fee yet rather than counting them as zero', () => {
    const effect = summariseRatesEffect([...table, draft({ key: 'new', label: '', feeInput: '' })], 7000, 0);
    expect(effect.minFeeCents).toBe(5000);
    expect(effect.rateCount).toBe(4);
  });
});

describe('formatting', () => {
  it('round-trips a fee through the input and back', () => {
    expect(feeCentsToInput(7000)).toBe('70.00');
    expect(parseFeeInput(feeCentsToInput(12015))).toBe(12015);
  });

  it('prints a fee the way the rest of the dashboard prints money', () => {
    expect(formatFee(7000, 'EGP')).toBe('EGP 70.00');
    expect(formatFee(0, '')).toBe('EGP 0.00');
  });
});

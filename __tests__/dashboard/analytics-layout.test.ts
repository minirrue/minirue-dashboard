import { describe, expect, it } from '@jest/globals';
import {
  layoutReducer,
  buildDefaultLayout,
  parseLayout,
  serializeLayout,
  LAYOUT_VERSION,
  DEFAULT_WIDGET_SIZE,
  type LayoutItem,
} from '@/lib/analytics/layout-store';

const DEFAULTS: LayoutItem[] = buildDefaultLayout([
  { id: 'audience-summary', defaultSize: 'md' },
  { id: 'realtime', defaultSize: 'sm' },
  { id: 'top-pages', defaultSize: 'lg' },
]);

describe('layoutReducer', () => {
  it('add appends a brand-new widget, visible, at the end', () => {
    const next = layoutReducer(DEFAULTS, { type: 'add', id: 'checkout-funnel', size: 'lg' });
    const added = next.find((i) => i.id === 'checkout-funnel');
    expect(added).toEqual({ id: 'checkout-funnel', size: 'lg', visible: true, order: 3 });
    expect(next).toHaveLength(4);
  });

  it('add on an existing hidden widget re-shows it in place rather than duplicating it', () => {
    const hidden = layoutReducer(DEFAULTS, { type: 'remove', id: 'realtime' });
    const restored = layoutReducer(hidden, { type: 'add', id: 'realtime' });
    expect(restored).toHaveLength(DEFAULTS.length);
    expect(restored.find((i) => i.id === 'realtime')).toMatchObject({ visible: true });
  });

  it('remove hides the widget without deleting its row', () => {
    const next = layoutReducer(DEFAULTS, { type: 'remove', id: 'top-pages' });
    expect(next).toHaveLength(DEFAULTS.length);
    expect(next.find((i) => i.id === 'top-pages')).toMatchObject({ visible: false });
  });

  it('reorder moves a widget to the requested position and re-sequences order', () => {
    const next = layoutReducer(DEFAULTS, { type: 'reorder', id: 'top-pages', toOrder: 0 });
    expect(next.map((i) => i.id)).toEqual(['top-pages', 'audience-summary', 'realtime']);
    expect(next.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('reorder past the end clamps to the last position', () => {
    const next = layoutReducer(DEFAULTS, { type: 'reorder', id: 'audience-summary', toOrder: 999 });
    expect(next.map((i) => i.id)).toEqual(['realtime', 'top-pages', 'audience-summary']);
  });

  it('resize changes only the target widget', () => {
    const next = layoutReducer(DEFAULTS, { type: 'resize', id: 'audience-summary', size: 'full' });
    expect(next.find((i) => i.id === 'audience-summary')?.size).toBe('full');
    expect(next.find((i) => i.id === 'realtime')?.size).toBe('sm');
  });

  it('reset replaces the whole layout with the provided defaults', () => {
    const mutated = layoutReducer(DEFAULTS, { type: 'resize', id: 'realtime', size: 'lg' });
    const reset = layoutReducer(mutated, { type: 'reset', defaults: DEFAULTS });
    expect(reset).toEqual(DEFAULTS);
  });

  it('removing then re-adding restores a sane default size, even after a resize', () => {
    const resized = layoutReducer(DEFAULTS, { type: 'resize', id: 'top-pages', size: 'full' });
    const removed = layoutReducer(resized, { type: 'remove', id: 'top-pages' });
    const readded = layoutReducer(removed, { type: 'add', id: 'top-pages' });
    // Re-adding with no explicit size falls back to DEFAULT_WIDGET_SIZE, not
    // the 'full' it was resized to before being hidden — a customised
    // widget a user removes and later brings back should not come back
    // stuck in whatever oversized state it was in when it left.
    expect(readded.find((i) => i.id === 'top-pages')).toMatchObject({
      size: DEFAULT_WIDGET_SIZE,
      visible: true,
    });
  });
});

describe('layout persistence', () => {
  it('round-trips through serializeLayout/parseLayout', () => {
    const raw = serializeLayout(DEFAULTS);
    expect(parseLayout(raw)).toEqual(DEFAULTS);
  });

  it('rejects a payload with an unrecognised version instead of crashing', () => {
    const payload = JSON.stringify({ version: LAYOUT_VERSION + 1, items: DEFAULTS });
    expect(parseLayout(payload)).toBeNull();
  });

  it('rejects a structurally invalid payload', () => {
    const payload = JSON.stringify({ version: LAYOUT_VERSION, items: [{ id: 'x' }] });
    expect(parseLayout(payload)).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(parseLayout('not json')).toBeNull();
  });

  it('returns null for no stored payload', () => {
    expect(parseLayout(null)).toBeNull();
  });
});

/**
 * Pure reducer + persistence adapter for the customisable analytics overview
 * grid (registry lives in `./widgets.tsx`; a later lane renders the actual
 * grid — this file is the machinery underneath it).
 *
 * Deliberately split in two: `layoutReducer` never touches `window`, so it
 * is trivially unit-testable and trivially portable to a future
 * server-persisted layout (swap `loadLayout`/`saveLayout` for API calls;
 * the reducer and its callers do not change).
 */

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface LayoutItem {
  id: string;
  size: WidgetSize;
  visible: boolean;
  order: number;
}

export type LayoutAction =
  | { type: 'add'; id: string; size?: WidgetSize }
  | { type: 'remove'; id: string }
  | { type: 'reorder'; id: string; toOrder: number }
  | { type: 'resize'; id: string; size: WidgetSize }
  | { type: 'reset'; defaults: LayoutItem[] };

export const LAYOUT_STORAGE_KEY = 'mr-analytics-layout-v1';
export const LAYOUT_VERSION = 1;
export const DEFAULT_WIDGET_SIZE: WidgetSize = 'md';

/** Re-sequences `order` to a dense 0..n-1 run in current sort order, so
 * removals/insertions never leave gaps or duplicate positions behind. */
function normalizeOrder(items: LayoutItem[]): LayoutItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

/** Re-numbers `order` from the array's current position, WITHOUT sorting by
 * the (possibly now-stale) existing `order` field first. `reorder` below
 * builds the array in its new intended position order via `splice`, so
 * re-deriving `order` from that position is correct; sorting by the old
 * `order` field at that point would undo the very move `splice` just made. */
function reindexByPosition(items: LayoutItem[]): LayoutItem[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

/**
 * `remove` hides a widget rather than deleting its row — `visible: false`,
 * position otherwise untouched — so `add`-ing it back can restore a sane
 * default size (the brief's requirement) without needing to remember
 * anything about the widget it is not this module's job to know (that's the
 * registry's `defaultSize`, passed in by the caller). A widget id the
 * reducer has never seen is a genuine insert, appended at the end.
 */
export function layoutReducer(state: LayoutItem[], action: LayoutAction): LayoutItem[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((item) => item.id === action.id);
      if (existing) {
        return state.map((item) =>
          item.id === action.id
            ? { ...item, visible: true, size: action.size ?? DEFAULT_WIDGET_SIZE }
            : item,
        );
      }
      const next: LayoutItem = {
        id: action.id,
        size: action.size ?? DEFAULT_WIDGET_SIZE,
        visible: true,
        order: state.length,
      };
      return normalizeOrder([...state, next]);
    }

    case 'remove': {
      return state.map((item) => (item.id === action.id ? { ...item, visible: false } : item));
    }

    case 'reorder': {
      const moved = state.find((item) => item.id === action.id);
      if (!moved) return state;
      const rest = normalizeOrder(state.filter((item) => item.id !== action.id));
      const clampedTo = Math.max(0, Math.min(action.toOrder, rest.length));
      rest.splice(clampedTo, 0, moved);
      return reindexByPosition(rest);
    }

    case 'resize': {
      return state.map((item) => (item.id === action.id ? { ...item, size: action.size } : item));
    }

    case 'reset': {
      return normalizeOrder(action.defaults);
    }

    default:
      return state;
  }
}

/** Builds the initial layout from the widget registry's declared order and
 * default sizes — what a first-ever visit (nothing in localStorage yet)
 * starts from, and what "reset to default" restores. */
export function buildDefaultLayout(
  widgets: Array<{ id: string; defaultSize: WidgetSize }>,
): LayoutItem[] {
  return widgets.map((widget, index) => ({
    id: widget.id,
    size: widget.defaultSize,
    visible: true,
    order: index,
  }));
}

interface PersistedLayoutV1 {
  version: typeof LAYOUT_VERSION;
  items: LayoutItem[];
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'full';
}

function isLayoutItem(value: unknown): value is LayoutItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    isWidgetSize(item.size) &&
    typeof item.visible === 'boolean' &&
    typeof item.order === 'number'
  );
}

export function serializeLayout(items: LayoutItem[]): string {
  const payload: PersistedLayoutV1 = { version: LAYOUT_VERSION, items };
  return JSON.stringify(payload);
}

/**
 * Parses a persisted payload. Anything that isn't exactly the current
 * version, or whose items don't structurally match `LayoutItem`, comes back
 * `null` — the caller falls back to `buildDefaultLayout` rather than
 * crashing the widget grid on a payload from a future/older version of this
 * app, or on hand-edited localStorage.
 */
export function parseLayout(raw: string | null): LayoutItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; items?: unknown };
    if (parsed.version !== LAYOUT_VERSION || !Array.isArray(parsed.items)) return null;
    if (!parsed.items.every(isLayoutItem)) return null;
    return normalizeOrder(parsed.items);
  } catch {
    return null;
  }
}

/** Thin persistence adapter — the only part of this module that touches
 * `window`. A future server-backed layout replaces just these two
 * functions; `layoutReducer` and its callers stay the same. */
export function loadLayout(defaults: LayoutItem[]): LayoutItem[] {
  if (typeof window === 'undefined') return defaults;
  const stored = parseLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  return stored ?? defaults;
}

export function saveLayout(items: LayoutItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAYOUT_STORAGE_KEY, serializeLayout(items));
}

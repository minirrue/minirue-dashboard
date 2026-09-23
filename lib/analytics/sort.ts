/**
 * Table sorting for every Analytics table (dashboard#128): one comparator,
 * one "click the same header to flip" rule, one `aria-sort` value. The
 * Sources table and the People table each had their own sorter, with
 * different tie-breaks and different treatment of empty cells.
 */

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

type Sortable = string | number | boolean | null | undefined;

/** Numbers numerically, strings by locale (case-insensitive), empties always last. */
export function compareValues(a: Sortable, b: Sortable): number {
  const ae = a === null || a === undefined || a === '';
  const be = b === null || b === undefined || b === '';
  if (ae || be) return ae && be ? 0 : ae ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
}

/**
 * A sorted copy. Empty values stay last in both directions; ties keep their
 * incoming order (Array.prototype.sort is stable).
 */
export function sortRows<T, K extends string>(rows: readonly T[], state: SortState<K>, pick: (row: T, key: K) => Sortable): T[] {
  const sign = state.dir === 'asc' ? 1 : -1;
  return [...rows].sort((x, y) => {
    const a = pick(x, state.key);
    const b = pick(y, state.key);
    const ae = a === null || a === undefined || a === '';
    const be = b === null || b === undefined || b === '';
    if (ae || be) return compareValues(a, b);
    return sign * compareValues(a, b);
  });
}

/** Same column flips direction; a new column starts at its default (numbers high first). */
export function nextSort<K extends string>(state: SortState<K>, key: K, firstDir: SortDir = 'desc'): SortState<K> {
  if (state.key === key) return { key, dir: state.dir === 'desc' ? 'asc' : 'desc' };
  return { key, dir: firstDir };
}

export function ariaSort<K extends string>(state: SortState<K>, key: K): 'ascending' | 'descending' | undefined {
  if (state.key !== key) return undefined;
  return state.dir === 'asc' ? 'ascending' : 'descending';
}

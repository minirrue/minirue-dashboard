import type { PathRow, PersonView } from './model';
import { sortRows, type SortState } from './sort';

/**
 * The per-section view state (search, sort, toggles) that decides which
 * rows a table shows. The screen and the export both run the rows through
 * the functions here, so a search or sort on screen is exactly what the
 * file contains.
 */

export type PeopleSortKey = 'id' | 'source' | 'place' | 'device' | 'sessions' | 'pages' | 'outcome' | 'last';
export type PathSortKey = 'source' | 'landing' | 'visited' | 'product' | 'bag' | 'checkout' | 'purchased';

export interface ViewState {
  peopleQuery: string;
  peopleSort: SortState<PeopleSortKey>;
  flowQuery: string;
  flowSort: SortState<PathSortKey>;
  flowMode: 'people' | 'events';
  sourcesRaw: boolean;
  journeyQuery: string;
}

export const DEFAULT_VIEW: ViewState = {
  peopleQuery: '',
  peopleSort: { key: 'last', dir: 'desc' },
  flowQuery: '',
  flowSort: { key: 'visited', dir: 'desc' },
  flowMode: 'people',
  sourcesRaw: false,
  journeyQuery: '',
};

function matches(hay: (string | number | null | undefined)[], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return hay.some((h) => h != null && String(h).toLowerCase().includes(needle.replace(/^#/, '')));
}

export function personHaystack(p: PersonView): (string | number | null)[] {
  return [p.label, p.number, p.number != null ? `#${p.number}` : null, p.source, p.place, p.device, p.outcomeLabel, p.landingPath, ...p.products];
}

export function visiblePeople(people: PersonView[], q: string, sort: SortState<PeopleSortKey>): PersonView[] {
  const rows = people.filter((p) => matches(personHaystack(p), q));
  return sortRows(rows, sort, (p, k) => {
    switch (k) {
      case 'id':
        return p.number ?? p.label;
      case 'source':
        return p.source;
      case 'place':
        return p.place;
      case 'device':
        return p.device;
      case 'sessions':
        return p.sessions;
      case 'pages':
        return p.pages;
      case 'outcome':
        return p.outcomeLabel;
      default:
        return p.lastSeenAt;
    }
  });
}

export function visiblePaths(paths: PathRow[], q: string, sort: SortState<PathSortKey>): PathRow[] {
  const rows = paths.filter((r) => matches([r.source, r.landing, r.channel, ...r.people.flatMap((p) => p.productsViewed)], q));
  return sortRows(rows, sort, (r, k) => (k === 'source' ? r.source : k === 'landing' ? r.landing : r[k]));
}


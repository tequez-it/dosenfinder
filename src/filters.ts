import type { CacheSummary, CacheType } from './types';

export type FoundFilter = 'all' | 'open' | 'found';

export interface Filters {
  /** leer = alle Typen */
  types: CacheType[];
  dMin: number;
  dMax: number;
  tMin: number;
  tMax: number;
  found: FoundFilter;
}

export const DEFAULT_FILTERS: Filters = {
  types: [],
  dMin: 1,
  dMax: 5,
  tMin: 1,
  tMax: 5,
  found: 'all',
};

export function isDefault(f: Filters): boolean {
  return (
    f.types.length === 0 &&
    f.dMin === 1 &&
    f.dMax === 5 &&
    f.tMin === 1 &&
    f.tMax === 5 &&
    f.found === 'all'
  );
}

function inRange(v: number | null, min: number, max: number): boolean {
  // Caches ohne Wertung nur zeigen, wenn der Filter offen ist
  if (v === null) return min === 1 && max === 5;
  return v >= min && v <= max;
}

export function matches(c: CacheSummary, f: Filters): boolean {
  if (f.types.length > 0 && !f.types.includes(c.type)) return false;
  if (!inRange(c.difficulty, f.dMin, f.dMax)) return false;
  if (!inRange(c.terrain, f.tMin, f.tMax)) return false;
  if (f.found === 'open' && c.found) return false;
  if (f.found === 'found' && !c.found) return false;
  return true;
}

const KEY = 'dosenfinder.filters';

/** Filter merken (nur Komfort – darf fehlschlagen). */
export function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    /* ignorieren */
  }
  return DEFAULT_FILTERS;
}

export function saveFilters(f: Filters): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* ignorieren */
  }
}

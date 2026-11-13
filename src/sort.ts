import type { CacheSummary } from './types';

export type SortKey = 'distance' | 'name' | 'difficulty' | 'terrain' | 'size';

export const SORT_LABELS: Record<SortKey, string> = {
  distance: 'Entfernung',
  name: 'Name',
  difficulty: 'Schwierigkeit',
  terrain: 'Gelände',
  size: 'Größe',
};

const SIZE_ORDER = ['nano', 'micro', 'small', 'regular', 'large', 'very large', 'other', 'virtual', 'not chosen'];

function sizeRank(container: string): number {
  const i = SIZE_ORDER.indexOf(container.trim().toLowerCase());
  return i === -1 ? SIZE_ORDER.length : i;
}

/** Für die Suche: klein, ohne Akzente (ä → a), damit "zahlen" auch "Zahlenrätsel" findet */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function matchesSearch(c: CacheSummary, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(c.name).includes(q) || normalize(c.code).includes(q) || normalize(c.owner).includes(q);
}

/** Vergleichsfunktion; dist ist die Entfernung in Metern (oder null ohne GPS). */
export function compareBy(key: SortKey) {
  return (a: { cache: CacheSummary; dist: number | null }, b: { cache: CacheSummary; dist: number | null }): number => {
    const byName = a.cache.name.localeCompare(b.cache.name, 'de');
    switch (key) {
      case 'distance':
        if (a.dist === null || b.dist === null) return byName;
        return a.dist - b.dist;
      case 'difficulty':
        return (a.cache.difficulty ?? 99) - (b.cache.difficulty ?? 99) || byName;
      case 'terrain':
        return (a.cache.terrain ?? 99) - (b.cache.terrain ?? 99) || byName;
      case 'size':
        return sizeRank(a.cache.container) - sizeRank(b.cache.container) || byName;
      default:
        return byName;
    }
  };
}

const KEY = 'dosenfinder.sort';

export function loadSort(): SortKey {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in SORT_LABELS) return v as SortKey;
  } catch {
    /* ignorieren */
  }
  return 'distance';
}

export function saveSort(k: SortKey): void {
  try {
    localStorage.setItem(KEY, k);
  } catch {
    /* ignorieren */
  }
}

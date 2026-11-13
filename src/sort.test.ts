import { describe, expect, it } from 'vitest';
import { compareBy, matchesSearch, normalize } from './sort';
import type { CacheSummary } from './types';

const c = (p: Partial<CacheSummary>): CacheSummary => ({
  code: 'GCX', name: 'X', lat: 0, lon: 0, type: 'traditional', typeLabel: '', container: 'Small',
  difficulty: 2, terrain: 2, owner: 'Testowner', found: false, available: true, archived: false, importedAt: 0, ...p,
});

describe('Suche', () => {
  it('ohne Groß-/Kleinschreibung und Umlaute', () => {
    expect(normalize('Zahlenrätsel')).toBe('zahlenratsel');
    expect(matchesSearch(c({ name: 'Zahlenrätsel' }), 'RÄTSEL')).toBe(true);
    expect(matchesSearch(c({ code: 'GCTEST3' }), 'test3')).toBe(true);
    expect(matchesSearch(c({ owner: 'Testowner B' }), 'owner b')).toBe(true);
    expect(matchesSearch(c({}), 'nichts')).toBe(false);
  });
});

describe('Sortierung', () => {
  const rows = [
    { cache: c({ name: 'B', difficulty: 3, container: 'Micro' }), dist: 500 },
    { cache: c({ name: 'A', difficulty: 1.5, container: 'Large' }), dist: 900 },
    { cache: c({ name: 'C', difficulty: null, container: 'Regular' }), dist: 100 },
  ];
  const names = (k: Parameters<typeof compareBy>[0]) => [...rows].sort(compareBy(k)).map((r) => r.cache.name).join('');
  it('nach Entfernung, Name, D und Größe', () => {
    expect(names('distance')).toBe('CBA');
    expect(names('name')).toBe('ABC');
    expect(names('difficulty')).toBe('ABC');
    expect(names('size')).toBe('BCA');
  });
});

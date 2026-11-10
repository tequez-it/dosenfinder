import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, matches } from './filters';
import type { CacheSummary } from './types';

const base: CacheSummary = {
  code: 'GCX', name: 'X', lat: 0, lon: 0, type: 'traditional', typeLabel: '', container: '',
  difficulty: 2, terrain: 3, owner: '', found: false, available: true, archived: false, importedAt: 0,
};

describe('filters', () => {
  it('Standardfilter lässt alles durch', () => {
    expect(matches(base, DEFAULT_FILTERS)).toBe(true);
    expect(matches({ ...base, difficulty: null }, DEFAULT_FILTERS)).toBe(true);
  });

  it('Typ, D/T und Status', () => {
    expect(matches(base, { ...DEFAULT_FILTERS, types: ['multi'] })).toBe(false);
    expect(matches(base, { ...DEFAULT_FILTERS, types: ['traditional', 'multi'] })).toBe(true);
    expect(matches(base, { ...DEFAULT_FILTERS, dMin: 2.5 })).toBe(false);
    expect(matches(base, { ...DEFAULT_FILTERS, tMax: 2.5 })).toBe(false);
    expect(matches({ ...base, difficulty: null }, { ...DEFAULT_FILTERS, dMin: 2 })).toBe(false);
    expect(matches(base, { ...DEFAULT_FILTERS, found: 'found' })).toBe(false);
    expect(matches({ ...base, found: true }, { ...DEFAULT_FILTERS, found: 'open' })).toBe(false);
  });
});

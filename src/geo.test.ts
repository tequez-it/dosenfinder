import { describe, expect, it } from 'vitest';
import { bearing, cardinal, distance, formatDistance } from './geo';

describe('geo', () => {
  it('distance: 1 Bogenminute Breite ≈ 1852 m', () => {
    expect(distance({ lat: 50, lon: 10 }, { lat: 50 + 1 / 60, lon: 10 })).toBeCloseTo(1853, -1);
  });

  it('bearing und Himmelsrichtung', () => {
    expect(cardinal(bearing({ lat: 50, lon: 10 }, { lat: 51, lon: 10 }))).toBe('N');
    expect(cardinal(bearing({ lat: 50, lon: 10 }, { lat: 50, lon: 11 }))).toBe('O');
    expect(cardinal(bearing({ lat: 50, lon: 10 }, { lat: 49, lon: 9 }))).toBe('SW');
    expect(cardinal(359)).toBe('N');
  });

  it('formatDistance', () => {
    expect(formatDistance(89.64)).toBe('89,6 m');
    expect(formatDistance(476)).toBe('476 m');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(123456)).toBe('123 km');
  });
});

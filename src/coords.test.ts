import { describe, expect, it } from 'vitest';
import { formatCoords, parseCoords } from './format';
import { distance, project, bearing } from './geo';

describe('parseCoords', () => {
  it('Grad + Dezimalminuten in Varianten', () => {
    const want = { lat: 50 + 59.123 / 60, lon: 10 + 1.456 / 60 };
    for (const s of ["N 50° 59.123 E 010° 01.456", "N50 59.123 E10 01.456", "n 50° 59,123' o 010° 01,456'", "N 50° 59.123', E 010° 01.456'"]) {
      const r = parseCoords(s)!;
      expect(r, s).not.toBeNull();
      expect(r.lat).toBeCloseTo(want.lat, 6);
      expect(r.lon).toBeCloseTo(want.lon, 6);
    }
  });
  it('Süd/West negativ', () => {
    const r = parseCoords('S 33° 30.000 W 070° 15.000')!;
    expect(r.lat).toBeCloseTo(-33.5, 6);
    expect(r.lon).toBeCloseTo(-70.25, 6);
  });
  it('Grad, Minuten, Sekunden', () => {
    const r = parseCoords(`N 50° 59' 07.4" E 10° 01' 27.3"`)!;
    expect(r.lat).toBeCloseTo(50 + 59 / 60 + 7.4 / 3600, 6);
    expect(r.lon).toBeCloseTo(10 + 1 / 60 + 27.3 / 3600, 6);
  });
  it('Dezimalgrad', () => {
    expect(parseCoords('50.98538, 10.02427')).toEqual({ lat: 50.98538, lon: 10.02427 });
    expect(parseCoords('50,98538; 10,02427')).toEqual({ lat: 50.98538, lon: 10.02427 });
    expect(parseCoords('50.98538 10.02427')).toEqual({ lat: 50.98538, lon: 10.02427 });
  });
  it('Unsinn und ungültige Minuten', () => {
    expect(parseCoords('hallo')).toBeNull();
    expect(parseCoords('N 50° 61.000 E 010° 01.000')).toBeNull();
    expect(parseCoords('95.0, 10.0')).toBeNull();
  });
  it('Rundweg mit formatCoords', () => {
    const r = parseCoords(formatCoords(50.98712, 10.02345))!;
    expect(r.lat).toBeCloseTo(50.98712, 5);
    expect(r.lon).toBeCloseTo(10.02345, 5);
  });
});

describe('project', () => {
  it('120 m in Richtung 245°', () => {
    const start = { lat: 50.98712, lon: 10.02345 };
    const p = project(start, 245, 120);
    expect(distance(start, p)).toBeCloseTo(120, 0);
    expect(bearing(start, p)).toBeCloseTo(245, 0);
  });
});

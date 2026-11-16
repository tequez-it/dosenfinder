import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkerCoord, findCheckers, findCoordsInText, htmlToText } from './tools';
import { buildGpx } from './gpx/export';
import { parseGpx } from './gpx/parse';

describe('Koordinaten in Beschreibung', () => {
  it('findet verschiedene Schreibweisen, ohne Doppelte', () => {
    const t = htmlToText(
      '<p>Start bei N 50° 59.123 E 010° 01.456.</p><p>Station: N50 58,999 O010 02,000 und nochmal N 50° 59.123 E 010° 01.456</p><p>Nicht: Nord 12 und N 50° 75.000 E 010° 01.000</p>',
    );
    const r = findCoordsInText(t);
    expect(r).toHaveLength(2);
    expect(r[0].lat).toBeCloseTo(50 + 59.123 / 60, 6);
    expect(r[1].lon).toBeCloseTo(10 + 2 / 60, 6);
  });
});

describe('Geochecker', () => {
  it('Koordinaten-Format der Prüfer', () => {
    expect(checkerCoord(55 + 36.498 / 60, 13 + 5.095 / 60, 'geocheckorg')).toBe('N5536498E01305095');
    expect(checkerCoord(55 + 36.498 / 60, 13 + 5.095 / 60, 'geocheckercom')).toBe('N55+36.498+E13+05.095');
  });
  it('findet Links und setzt Koordinate ein', () => {
    const html =
      '<a href="https://www.geocheck.org/geo_inputchkcoord.php?gid=123">Check</a> und https://www.certitudes.org/certitude?wp=GC1';
    const r = findCheckers(html, 'https://example.invalid/GC1', [], { lat: 55 + 36.498 / 60, lon: 13 + 5.095 / 60 });
    expect(r.map((c) => c.name)).toEqual(['GeoCheck', 'Certitude']);
    expect(r[0].url).toBe('https://www.geocheck.org/geo_inputchkcoord.php?gid=123&coord=N5536498E01305095');
  });
  it('erkennt den geocaching.com-Prüfer über das Attribut', () => {
    const r = findCheckers('', 'https://example.invalid/GC1', [{ id: 72, inc: true, name: 'Geocaching.com solution checker' }], null);
    expect(r).toHaveLength(1);
  });
});

describe('GPX-Export', () => {
  it('lässt sich wieder einlesen (Rundweg)', () => {
    const src = readFileSync(resolve(__dirname, '../testdata/beispiel-pq.gpx'), 'utf-8');
    const parsed = parseGpx(src, 1);
    const items = parsed.caches.map((c) => ({
      summary: c.summary,
      details: c.details,
      ownWaypoints:
        c.summary.code === 'GCTEST3'
          ? [{ code: 'EIGEN1', name: 'Final <gelöst>', type: 'Eigener Wegpunkt', lat: 50.97, lon: 10.02, comment: 'A & B', own: true }]
          : [],
    }));
    const again = parseGpx(buildGpx(items), 1);
    expect(again.caches.map((c) => c.summary)).toEqual(parsed.caches.map((c) => c.summary));
    expect(again.caches[0].details.longDescription).toBe(parsed.caches[0].details.longDescription);
    expect(again.caches[0].details.logs).toEqual(parsed.caches[0].details.logs);
    expect(again.caches[0].details.attributes).toEqual(parsed.caches[0].details.attributes);
    expect(again.waypoints).toHaveLength(1);
    expect(again.waypoints[0]).toMatchObject({ parentCode: 'GCTEST3', name: 'Final <gelöst>', comment: 'A & B' });
  });
});

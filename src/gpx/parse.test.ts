import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { GpxError, normalizeType, parentCodeFromWaypoint, parseGpx } from './parse';
import { parseBytes } from './import';

const caches = readFileSync(resolve(__dirname, '../../testdata/beispiel-pq.gpx'), 'utf-8');
const wpts = readFileSync(resolve(__dirname, '../../testdata/beispiel-pq-wpts.gpx'), 'utf-8');

describe('parseGpx – Caches', () => {
  const r = parseGpx(caches, 1);

  it('liest alle Caches', () => {
    expect(r.caches.map((c) => c.summary.code)).toEqual([
      'GCTEST1', 'GCTEST2', 'GCTEST3', 'GCTEST4', 'GCTEST5', 'GCTEST6',
    ]);
    expect(r.waypoints).toHaveLength(0);
  });

  it('liest Kurzdaten korrekt', () => {
    const c = r.caches[0].summary;
    expect(c).toMatchObject({
      name: 'Am alten Brunnen',
      lat: 50.98712,
      lon: 10.02345,
      type: 'traditional',
      container: 'Small',
      difficulty: 1.5,
      terrain: 2,
      owner: 'Testowner A',
      found: true,
      available: true,
      archived: false,
    });
  });

  it('erkennt Typen, deaktiviert und archiviert', () => {
    const byCode = Object.fromEntries(r.caches.map((c) => [c.summary.code, c.summary]));
    expect(byCode.GCTEST2.type).toBe('multi');
    expect(byCode.GCTEST3.type).toBe('mystery');
    expect(byCode.GCTEST3.available).toBe(false);
    expect(byCode.GCTEST4.type).toBe('earth');
    expect(byCode.GCTEST5.type).toBe('event');
    expect(byCode.GCTEST5.archived).toBe(true);
    expect(byCode.GCTEST6.type).toBe('letterbox'); // ältere Namespace-Version 1/0
    expect(byCode.GCTEST2.found).toBe(false);
  });

  it('liest Details', () => {
    const d = r.caches[0].details;
    expect(d.hint).toBe('Unter dem Stein links');
    expect(d.longDescriptionHtml).toBe(true);
    expect(d.longDescription).toContain('<b>erfunden</b>');
    expect(d.attributes).toEqual([
      { id: 1, inc: true, name: 'Dogs' },
      { id: 13, inc: true, name: 'Available at all times' },
    ]);
    expect(d.logs).toHaveLength(2);
    expect(d.logs[1]).toMatchObject({ type: "Didn't find it", finder: 'Testsucher' });
  });
});

describe('parseGpx – Wegpunkte', () => {
  const r = parseGpx(wpts);

  it('ordnet Wegpunkte dem Cache-Code zu', () => {
    expect(r.caches).toHaveLength(0);
    expect(r.waypoints.map((w) => [w.code, w.parentCode])).toEqual([
      ['PKTEST2', 'GCTEST2'],
      ['S1TEST2', 'GCTEST2'],
      ['FNTEST2', 'GCTEST2'],
      ['PKNICHT9', 'GCNICHT9'],
    ]);
  });

  it('liest Typ, Name und versteckte Koordinaten', () => {
    expect(r.waypoints[0]).toMatchObject({ name: 'Parkplatz', type: 'Parking Area', comment: 'Kostenlos parken' });
    expect(r.waypoints[2]).toMatchObject({ lat: null, lon: null });
  });
});

describe('parseBytes', () => {
  it('liest eine Pocket-Query-ZIP mit beiden Dateien', () => {
    const zip = zipSync({ '123.gpx': strToU8(caches), '123-wpts.gpx': strToU8(wpts), 'liesmich.txt': strToU8('x') });
    const r = parseBytes('pq.zip', zip);
    expect(r.files.sort()).toEqual(['123-wpts.gpx', '123.gpx']);
    expect(r.caches).toHaveLength(6);
    expect(r.waypoints).toHaveLength(4);
  });

  it('liest eine einzelne GPX', () => {
    expect(parseBytes('a.gpx', strToU8(caches)).caches).toHaveLength(6);
  });

  it('meldet kaputte Dateien verständlich', () => {
    expect(() => parseBytes('x.gpx', strToU8('kein xml <'))).toThrow(GpxError);
    expect(() => parseBytes('x.gpx', strToU8('<html></html>'))).toThrow(GpxError);
  });
});

describe('Hilfsfunktionen', () => {
  it('normalizeType', () => {
    expect(normalizeType('Traditional Cache')).toBe('traditional');
    expect(normalizeType('Mega-Event Cache')).toBe('event');
    expect(normalizeType('Cache In Trash Out Event')).toBe('event');
    expect(normalizeType('Wherigo Cache')).toBe('wherigo');
    expect(normalizeType('GPS Adventures Exhibit')).toBe('other');
  });

  it('parentCodeFromWaypoint', () => {
    expect(parentCodeFromWaypoint('PK13Y2Y')).toBe('GC13Y2Y');
    expect(parentCodeFromWaypoint('ab')).toBeNull();
  });
});

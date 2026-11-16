/*
 * Kleine Werkzeuge wie in c:geo: Koordinaten in der Beschreibung finden,
 * Lösungsprüfer (Geochecker) erkennen.
 */
import type { CacheAttribute } from './types';

export interface FoundCoord {
  lat: number;
  lon: number;
  /** Fundstelle im Text, zur Anzeige */
  text: string;
}

/** Text ohne HTML-Tags (für die Suche in Beschreibungen) */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br, p, div, li, tr, h1, h2, h3, h4').forEach((el) => el.append('\n'));
  return doc.body.textContent ?? '';
}

/**
 * Findet Koordinaten im Format "N 50° 59.123 E 010° 01.456" (auch ohne °, mit
 * Komma statt Punkt, mit O statt E). Hemisphären nur als Großbuchstaben, damit
 * normale Wörter nicht anschlagen.
 */
export function findCoordsInText(text: string): FoundCoord[] {
  const re = /([NS])\s*(\d{1,2})\s*°?\s+(\d{1,2}[.,]\d{1,3})\s*['′]?\s*[,;/]?\s*([EWO])\s*(\d{1,3})\s*°?\s+(\d{1,2}[.,]\d{1,3})\s*['′]?/g;
  const out: FoundCoord[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    const latMin = Number(m[3].replace(',', '.'));
    const lonMin = Number(m[6].replace(',', '.'));
    if (latMin >= 60 || lonMin >= 60) continue;
    const lat = (Number(m[2]) + latMin / 60) * (m[1] === 'S' ? -1 : 1);
    const lon = (Number(m[5]) + lonMin / 60) * (m[4] === 'W' ? -1 : 1);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lat, lon, text: m[0].replace(/\s+/g, ' ').trim() });
  }
  return out;
}

export interface Checker {
  name: string;
  url: string;
  /** Koordinate wurde schon in den Link eingesetzt */
  withCoords: boolean;
}

/** Bekannte Lösungsprüfer (Liste aus c:geo, CheckerUtils) */
const CHECKERS: { pattern: string; name: string; param?: string; format?: 'geocheckorg' | 'geocheckercom' }[] = [
  { pattern: 'certitudes.org/certitude?', name: 'Certitude' },
  { pattern: 'gc-apps.com/checker/', name: 'GC-Apps Checker' },
  { pattern: 'geocheck.org/geo_inputchkcoord.php?', name: 'GeoCheck', param: '&coord=', format: 'geocheckorg' },
  { pattern: 'geocheck.org/inputchkcoord.php?', name: 'GeoCheck', param: '&coord=', format: 'geocheckorg' },
  { pattern: 'geocheck.eu.org/geo_inputchkcoord.php?', name: 'GeoCheck', param: '&coord=', format: 'geocheckorg' },
  { pattern: 'geochecker.com/index.php?', name: 'Geochecker', param: '&lastcoords=', format: 'geocheckercom' },
  { pattern: 'geochecker.gps-cache.de/check.aspx?', name: 'GPS-Cache Checker' },
  { pattern: 'geotjek.dk/geo_inputchkcoord.php?', name: 'Geotjek', param: '&coord=', format: 'geocheckorg' },
  { pattern: 'geocache-planer.de/CAL/checker.php?', name: 'Geocache-Planer Checker' },
];

function ddm(v: number) {
  const a = Math.abs(v);
  const deg = Math.floor(a);
  const minTotal = Math.round((a - deg) * 60 * 1000);
  return { deg: deg + Math.floor(minTotal / 60000), min: Math.floor((minTotal % 60000) / 1000), frac: minTotal % 1000 };
}

/** Koordinate im Format, das der jeweilige Prüfer im Link erwartet */
export function checkerCoord(lat: number, lon: number, format: 'geocheckorg' | 'geocheckercom'): string {
  const la = ddm(lat);
  const lo = ddm(lon);
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lon < 0 ? 'W' : 'E';
  const p = (n: number, w: number) => String(n).padStart(w, '0');
  if (format === 'geocheckorg') {
    return `${ns}${p(la.deg, 2)}${p(la.min, 2)}${p(la.frac, 3)}${ew}${p(lo.deg, 3)}${p(lo.min, 2)}${p(lo.frac, 3)}`;
  }
  return `${ns}${la.deg}+${p(la.min, 2)}.${p(la.frac, 3)}+${ew}${lo.deg}+${p(lo.min, 2)}.${p(lo.frac, 3)}`;
}

/** Sucht Prüfer-Links in der Beschreibung und setzt die Koordinate ein, wo möglich. */
export function findCheckers(
  descriptionHtml: string,
  cacheUrl: string,
  attributes: CacheAttribute[],
  coord: { lat: number; lon: number } | null,
): Checker[] {
  const out: Checker[] = [];
  const urls = new Set<string>();
  const doc = new DOMParser().parseFromString(descriptionHtml, 'text/html');
  doc.querySelectorAll('a[href]').forEach((a) => urls.add(a.getAttribute('href')!));
  for (const m of (doc.body.textContent ?? '').matchAll(/https?:\/\/[^\s"'<>]+/g)) urls.add(m[0]);

  for (const url of urls) {
    const c = CHECKERS.find((x) => url.toLowerCase().includes(x.pattern.toLowerCase()));
    if (!c || !/^https?:\/\//i.test(url)) continue;
    if (out.some((o) => o.url.startsWith(url))) continue;
    if (c.param && c.format && coord) {
      out.push({ name: c.name, url: url + c.param + checkerCoord(coord.lat, coord.lon, c.format), withCoords: true });
    } else {
      out.push({ name: c.name, url, withCoords: false });
    }
  }

  // Lösungsprüfer von geocaching.com selbst (Attribut am Cache)
  const hasGcChecker = attributes.some((a) => a.inc && /solution checker/i.test(a.name));
  if (hasGcChecker && /^https?:\/\//i.test(cacheUrl)) {
    out.push({ name: 'geocaching.com Lösungsprüfer (auf der Cache-Seite)', url: cacheUrl, withCoords: false });
  }
  return out;
}

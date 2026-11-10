import type {
  CacheAttribute,
  CacheLog,
  CacheType,
  ParsedCache,
  ParsedWaypoint,
  ParseResult,
} from '../types';

/*
 * Parser für GPX-Dateien im Groundspeak-Format (Pocket Queries, einzelne
 * Cache-Downloads, "Meine Funde"). Namespaces werden ignoriert und nur über
 * den lokalen Elementnamen gesucht, weil es mehrere Groundspeak-Versionen
 * gibt (1/0, 1/0/1, 1/0/2).
 */

/** Direkte Kinder mit passendem lokalen Namen. */
function children(el: Element, name: string): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(el.children)) {
    if (c.localName === name) out.push(c);
  }
  return out;
}

function child(el: Element | undefined | null, name: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) {
    if (c.localName === name) return c;
  }
  return null;
}

function text(el: Element | undefined | null, name: string): string {
  return child(el, name)?.textContent?.trim() ?? '';
}

function num(value: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function isTrue(value: string | null): boolean {
  return (value ?? '').trim().toLowerCase() === 'true';
}

export function normalizeType(label: string): CacheType {
  const l = label.toLowerCase();
  if (l.includes('traditional')) return 'traditional';
  if (l.includes('multi')) return 'multi';
  if (l.includes('unknown') || l.includes('mystery') || l.includes('puzzle')) return 'mystery';
  if (l.includes('letterbox')) return 'letterbox';
  if (l.includes('wherigo')) return 'wherigo';
  if (l.includes('earth')) return 'earth';
  if (l.includes('virtual')) return 'virtual';
  if (l.includes('webcam')) return 'webcam';
  if (
    l.includes('event') ||
    l.includes('cito') ||
    l.includes('cache in trash out')
  ) {
    return 'event';
  }
  return 'other';
}

/**
 * Leitet den Cache-Code aus einem Wegpunkt-Code ab.
 * geocaching.com: Wegpunkt "PK13Y2Y" gehört zu Cache "GC13Y2Y".
 */
export function parentCodeFromWaypoint(wptCode: string): string | null {
  const code = wptCode.trim().toUpperCase();
  if (code.length < 3) return null;
  return 'GC' + code.slice(2);
}

function parseCoord(wpt: Element): { lat: number | null; lon: number | null } {
  const lat = num(wpt.getAttribute('lat') ?? '');
  const lon = num(wpt.getAttribute('lon') ?? '');
  // Wegpunkte mit versteckten Koordinaten kommen teils als 0/0.
  if (lat === null || lon === null || (lat === 0 && lon === 0)) {
    return { lat: null, lon: null };
  }
  return { lat, lon };
}

function parseCache(wpt: Element, cacheEl: Element, importedAt: number): ParsedCache | null {
  const code = text(wpt, 'name').toUpperCase();
  const { lat, lon } = parseCoord(wpt);
  if (!code || lat === null || lon === null) return null;

  const typeLabel = text(cacheEl, 'type') || text(wpt, 'type').split('|').pop() || '';
  const sym = text(wpt, 'sym').toLowerCase();

  const attributes: CacheAttribute[] = [];
  for (const a of children(child(cacheEl, 'attributes') ?? cacheEl, 'attribute')) {
    attributes.push({
      id: Number.parseInt(a.getAttribute('id') ?? '0', 10),
      inc: a.getAttribute('inc') !== '0',
      name: a.textContent?.trim() ?? '',
    });
  }

  const logs: CacheLog[] = [];
  const logsEl = child(cacheEl, 'logs');
  if (logsEl) {
    for (const l of children(logsEl, 'log')) {
      logs.push({
        id: l.getAttribute('id') ?? '',
        date: text(l, 'date'),
        type: text(l, 'type'),
        finder: text(l, 'finder'),
        text: text(l, 'text'),
      });
    }
  }

  const shortDesc = child(cacheEl, 'short_description');
  const longDesc = child(cacheEl, 'long_description');

  return {
    summary: {
      code,
      name: text(cacheEl, 'name') || text(wpt, 'urlname') || code,
      lat,
      lon,
      type: normalizeType(typeLabel),
      typeLabel,
      container: text(cacheEl, 'container'),
      difficulty: num(text(cacheEl, 'difficulty')),
      terrain: num(text(cacheEl, 'terrain')),
      owner: text(cacheEl, 'placed_by') || text(cacheEl, 'owner'),
      found: sym === 'geocache found',
      available: cacheEl.hasAttribute('available') ? isTrue(cacheEl.getAttribute('available')) : true,
      archived: isTrue(cacheEl.getAttribute('archived')),
      importedAt,
    },
    details: {
      code,
      placedAt: text(wpt, 'time'),
      country: text(cacheEl, 'country'),
      state: text(cacheEl, 'state'),
      url: text(wpt, 'url'),
      shortDescription: shortDesc?.textContent ?? '',
      shortDescriptionHtml: isTrue(shortDesc?.getAttribute('html') ?? null),
      longDescription: longDesc?.textContent ?? '',
      longDescriptionHtml: isTrue(longDesc?.getAttribute('html') ?? null),
      hint: text(cacheEl, 'encoded_hints'),
      attributes,
      logs,
      waypoints: [],
    },
  };
}

function parseWaypoint(wpt: Element): ParsedWaypoint | null {
  const code = text(wpt, 'name').toUpperCase();
  const parentCode = parentCodeFromWaypoint(code);
  if (!code || !parentCode) return null;
  const { lat, lon } = parseCoord(wpt);
  const typeRaw = text(wpt, 'type');
  return {
    code,
    parentCode,
    name: text(wpt, 'desc') || code,
    type: typeRaw.includes('|') ? typeRaw.split('|').pop()!.trim() : typeRaw || text(wpt, 'sym'),
    lat,
    lon,
    comment: text(wpt, 'cmt'),
  };
}

export class GpxError extends Error {}

/** Liest den Inhalt einer GPX-Datei. Wirft GpxError bei ungültigem XML. */
export function parseGpx(xml: string, importedAt = Date.now()): ParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new GpxError('Die Datei ist kein gültiges GPX/XML.');
  }
  const root = doc.documentElement;
  if (!root || root.localName !== 'gpx') {
    throw new GpxError('Die Datei ist keine GPX-Datei.');
  }

  const result: ParseResult = { caches: [], waypoints: [] };
  for (const wpt of children(root, 'wpt')) {
    const cacheEl = child(wpt, 'cache');
    if (cacheEl) {
      const c = parseCache(wpt, cacheEl, importedAt);
      if (c) result.caches.push(c);
    } else {
      const w = parseWaypoint(wpt);
      if (w) result.waypoints.push(w);
    }
  }
  return result;
}

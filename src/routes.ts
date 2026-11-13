export type Route =
  | { name: 'home' }
  | { name: 'list' }
  /** code/waypoint: Karte auf dieses Ziel ausrichten, mit Linie vom Standort */
  | { name: 'map'; code?: string; waypoint?: string }
  | { name: 'fieldnotes' }
  | { name: 'log'; code: string }
  | { name: 'import' }
  | { name: 'cache'; code: string }
  | { name: 'nav'; code: string; waypoint?: string };

/**
 * Einfaches Hash-Routing:
 *   #/liste, #/karte, #/karte/GC123[/PK123], #/import, #/fieldnotes, #/log/GC123, #/cache/GC123, #/nav/GC123, #/nav/GC123/PK123 – leer = Startseite
 */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'liste':
      return { name: 'list' };
    case 'karte':
      return parts[1] ? { name: 'map', code: parts[1], waypoint: parts[2] } : { name: 'map' };
    case 'fieldnotes':
      return { name: 'fieldnotes' };
    case 'log':
      return parts[1] ? { name: 'log', code: parts[1] } : { name: 'fieldnotes' };
    case 'import':
      return { name: 'import' };
    case 'cache':
      return parts[1] ? { name: 'cache', code: parts[1] } : { name: 'list' };
    case 'nav':
      return parts[1] ? { name: 'nav', code: parts[1], waypoint: parts[2] } : { name: 'list' };
    default:
      return { name: 'home' };
  }
}

export function hashFor(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'list':
      return '#/liste';
    case 'map':
      return r.code
        ? `#/karte/${encodeURIComponent(r.code)}${r.waypoint ? `/${encodeURIComponent(r.waypoint)}` : ''}`
        : '#/karte';
    case 'fieldnotes':
      return '#/fieldnotes';
    case 'log':
      return `#/log/${encodeURIComponent(r.code)}`;
    case 'import':
      return '#/import';
    case 'cache':
      return `#/cache/${encodeURIComponent(r.code)}`;
    case 'nav':
      return `#/nav/${encodeURIComponent(r.code)}${r.waypoint ? `/${encodeURIComponent(r.waypoint)}` : ''}`;
  }
}

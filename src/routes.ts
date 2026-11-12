export type Route =
  | { name: 'home' }
  | { name: 'list' }
  | { name: 'map' }
  | { name: 'import' }
  | { name: 'cache'; code: string }
  | { name: 'nav'; code: string; waypoint?: string };

/**
 * Einfaches Hash-Routing:
 *   #/liste, #/karte, #/import, #/cache/GC123, #/nav/GC123, #/nav/GC123/PK123 – leer = Startseite
 */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'liste':
      return { name: 'list' };
    case 'karte':
      return { name: 'map' };
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
      return '#/karte';
    case 'import':
      return '#/import';
    case 'cache':
      return `#/cache/${encodeURIComponent(r.code)}`;
    case 'nav':
      return `#/nav/${encodeURIComponent(r.code)}${r.waypoint ? `/${encodeURIComponent(r.waypoint)}` : ''}`;
  }
}

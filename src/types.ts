/** Cache-Typen, normalisiert aus den Bezeichnungen in GPX-Dateien. */
export type CacheType =
  | 'traditional'
  | 'multi'
  | 'mystery'
  | 'letterbox'
  | 'wherigo'
  | 'earth'
  | 'virtual'
  | 'webcam'
  | 'event'
  | 'other';

export const CACHE_TYPE_LABELS: Record<CacheType, string> = {
  traditional: 'Traditional',
  multi: 'Multi',
  mystery: 'Mystery',
  letterbox: 'Letterbox',
  wherigo: 'Wherigo',
  earth: 'Earthcache',
  virtual: 'Virtual',
  webcam: 'Webcam',
  event: 'Event',
  other: 'Sonstige',
};

/** Kurzdaten für Liste und (später) Karte. */
export interface CacheSummary {
  code: string;
  name: string;
  lat: number;
  lon: number;
  type: CacheType;
  /** Originale Typ-Bezeichnung aus der GPX-Datei */
  typeLabel: string;
  container: string;
  difficulty: number | null;
  terrain: number | null;
  owner: string;
  found: boolean;
  /** false = deaktiviert */
  available: boolean;
  archived: boolean;
  /** Zeitpunkt des Imports (ms) */
  importedAt: number;
}

export interface CacheLog {
  id: string;
  date: string;
  type: string;
  finder: string;
  text: string;
}

export interface CacheAttribute {
  id: number;
  inc: boolean;
  name: string;
}

export interface Waypoint {
  code: string;
  name: string;
  /** Typ, z. B. "Parking Area" */
  type: string;
  lat: number | null;
  lon: number | null;
  comment: string;
}

/** Alles, was nur in der Detailansicht gebraucht wird. */
export interface CacheDetails {
  code: string;
  placedAt: string;
  country: string;
  state: string;
  url: string;
  shortDescription: string;
  shortDescriptionHtml: boolean;
  longDescription: string;
  longDescriptionHtml: boolean;
  hint: string;
  attributes: CacheAttribute[];
  logs: CacheLog[];
  waypoints: Waypoint[];
}

export interface ParsedCache {
  summary: CacheSummary;
  details: CacheDetails;
}

export interface ParsedWaypoint extends Waypoint {
  /** Code des zugehörigen Caches (z. B. GCABC12) */
  parentCode: string;
}

export interface ParseResult {
  caches: ParsedCache[];
  waypoints: ParsedWaypoint[];
}

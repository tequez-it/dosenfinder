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
  /** lat/lon sind vom Nutzer korrigiert (z. B. gelöstes Mystery-Final) */
  corrected?: boolean;
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
  /** vom Nutzer selbst angelegt */
  own?: boolean;
}

export interface LatLonPair {
  lat: number;
  lon: number;
}

/**
 * Eigene Daten zu einem Cache. Getrennt gespeichert, damit ein neuer Import
 * sie nie überschreibt.
 */
export interface UserData {
  code: string;
  note: string;
  /** korrigierte Koordinaten (null = keine) */
  corrected: LatLonPair | null;
  /** Koordinaten laut Listing, um sie wiederherzustellen */
  original: LatLonPair | null;
  ownWaypoints: Waypoint[];
  /** IDs der eigenen Listen, in denen der Cache liegt */
  lists?: string[];
}

/** Eigene Cache-Liste (wie "Listen" in c:geo) */
export interface CacheListInfo {
  id: string;
  name: string;
  createdAt: number;
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

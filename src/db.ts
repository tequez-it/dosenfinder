import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CacheDetails, CacheSummary, LatLonPair, ParseResult, UserData, Waypoint } from './types';
import { countsAsFind, type FieldNote } from './fieldnotes';

/*
 * Lokale Datenbank im Browser (IndexedDB). Alles bleibt auf dem Gerät.
 * - caches:  Kurzdaten für Liste/Karte (klein, wird komplett geladen)
 * - details: Beschreibung, Hint, Logs, Wegpunkte (nur bei Bedarf geladen)
 * - fieldnotes: eigene Logs, die noch auf geocaching.com hochgeladen werden (ab Version 2)
 * - userdata: Notiz, korrigierte Koordinaten, eigene Wegpunkte (ab Version 3)
 */
interface DosenDB extends DBSchema {
  caches: { key: string; value: CacheSummary };
  details: { key: string; value: CacheDetails };
  fieldnotes: { key: string; value: FieldNote };
  userdata: { key: string; value: UserData };
}

let dbPromise: Promise<IDBPDatabase<DosenDB>> | null = null;

function db(): Promise<IDBPDatabase<DosenDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DosenDB>('dosenfinder', 3, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('caches', { keyPath: 'code' });
          d.createObjectStore('details', { keyPath: 'code' });
        }
        if (oldVersion < 2) {
          d.createObjectStore('fieldnotes', { keyPath: 'code' });
        }
        if (oldVersion < 3) {
          d.createObjectStore('userdata', { keyPath: 'code' });
        }
      },
    });
  }
  return dbPromise;
}

export interface ImportStats {
  newCaches: number;
  updatedCaches: number;
  waypointsAttached: number;
  /** Wegpunkte, deren Cache weder in der Datei noch in der App ist */
  waypointsOrphaned: number;
}

export async function saveImport(result: ParseResult): Promise<ImportStats> {
  const d = await db();
  const tx = d.transaction(['caches', 'details', 'userdata'], 'readwrite');
  const caches = tx.objectStore('caches');
  const details = tx.objectStore('details');
  const userdata = tx.objectStore('userdata');
  const stats: ImportStats = { newCaches: 0, updatedCaches: 0, waypointsAttached: 0, waypointsOrphaned: 0 };

  // Details dieses Imports im Speicher halten, um Wegpunkte anzuhängen
  const touched = new Map<string, CacheDetails>();

  for (const { summary, details: det } of result.caches) {
    const existing = await caches.get(summary.code);
    const oldDetails = await details.get(summary.code);
    if (existing) {
      stats.updatedCaches++;
      // "Gefunden" nie durch einen späteren Import ohne Fund-Markierung verlieren
      summary.found = summary.found || existing.found;
    } else {
      stats.newCaches++;
    }
    // Vorhandene Wegpunkte behalten, falls diese Datei keine mitliefert
    if (oldDetails && det.waypoints.length === 0) det.waypoints = oldDetails.waypoints;
    // Korrigierte Koordinaten des Nutzers bleiben erhalten
    const ud = await userdata.get(summary.code);
    if (ud?.corrected) {
      await userdata.put({ ...ud, original: { lat: summary.lat, lon: summary.lon } });
      summary.lat = ud.corrected.lat;
      summary.lon = ud.corrected.lon;
      summary.corrected = true;
    }
    await caches.put(summary);
    touched.set(summary.code, det);
  }

  for (const wp of result.waypoints) {
    let det = touched.get(wp.parentCode);
    if (!det) {
      det = await details.get(wp.parentCode);
      if (det) touched.set(wp.parentCode, det);
    }
    if (!det) {
      stats.waypointsOrphaned++;
      continue;
    }
    const { parentCode: _parent, ...waypoint } = wp;
    det.waypoints = det.waypoints.filter((w) => w.code !== waypoint.code);
    det.waypoints.push(waypoint);
    stats.waypointsAttached++;
  }

  for (const det of touched.values()) await details.put(det);
  await tx.done;
  return stats;
}

export async function getAllSummaries(): Promise<CacheSummary[]> {
  return (await db()).getAll('caches');
}

export async function getSummary(code: string): Promise<CacheSummary | undefined> {
  return (await db()).get('caches', code);
}

export async function getDetails(code: string): Promise<CacheDetails | undefined> {
  return (await db()).get('details', code);
}

export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['caches', 'details'], 'readwrite');
  await Promise.all([tx.objectStore('caches').clear(), tx.objectStore('details').clear(), tx.done]);
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/* ---------- Field Notes ---------- */

export async function getFieldNote(code: string): Promise<FieldNote | undefined> {
  return (await db()).get('fieldnotes', code);
}

export async function getAllFieldNotes(): Promise<FieldNote[]> {
  return (await db()).getAll('fieldnotes');
}

/** Speichert eine Field Note. Ein Fund markiert den Cache in der App als gefunden. */
export async function saveFieldNote(note: FieldNote): Promise<void> {
  const d = await db();
  const tx = d.transaction(['fieldnotes', 'caches'], 'readwrite');
  await tx.objectStore('fieldnotes').put(note);
  if (countsAsFind(note.type)) {
    const c = await tx.objectStore('caches').get(note.code);
    if (c && !c.found) await tx.objectStore('caches').put({ ...c, found: true });
  }
  await tx.done;
}

export async function deleteFieldNote(code: string): Promise<void> {
  await (await db()).delete('fieldnotes', code);
}

export async function markFieldNotesExported(codes: string[]): Promise<void> {
  const d = await db();
  const tx = d.transaction('fieldnotes', 'readwrite');
  for (const code of codes) {
    const n = await tx.store.get(code);
    if (n) await tx.store.put({ ...n, exported: true });
  }
  await tx.done;
}

export async function deleteExportedFieldNotes(): Promise<number> {
  const d = await db();
  const tx = d.transaction('fieldnotes', 'readwrite');
  let count = 0;
  for (const n of await tx.store.getAll()) {
    if (n.exported) {
      await tx.store.delete(n.code);
      count++;
    }
  }
  await tx.done;
  return count;
}

/* ---------- Eigene Daten (Notiz, korrigierte Koordinaten, eigene Wegpunkte) ---------- */

function emptyUserData(code: string): UserData {
  return { code, note: '', corrected: null, original: null, ownWaypoints: [] };
}

export async function getUserData(code: string): Promise<UserData> {
  return (await (await db()).get('userdata', code)) ?? emptyUserData(code);
}

async function updateUserData(code: string, change: (u: UserData) => UserData): Promise<UserData> {
  const d = await db();
  const tx = d.transaction('userdata', 'readwrite');
  const next = change((await tx.store.get(code)) ?? emptyUserData(code));
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function saveNote(code: string, note: string): Promise<UserData> {
  return updateUserData(code, (u) => ({ ...u, note }));
}

/** Setzt korrigierte Koordinaten (oder null = Original wiederherstellen). */
export async function setCorrectedCoords(code: string, coords: LatLonPair | null): Promise<void> {
  const d = await db();
  const tx = d.transaction(['caches', 'userdata'], 'readwrite');
  const c = await tx.objectStore('caches').get(code);
  if (!c) {
    await tx.done;
    return;
  }
  const u = (await tx.objectStore('userdata').get(code)) ?? emptyUserData(code);
  const original = u.original ?? (c.corrected ? null : { lat: c.lat, lon: c.lon });
  if (coords) {
    await tx.objectStore('userdata').put({ ...u, corrected: coords, original });
    await tx.objectStore('caches').put({ ...c, lat: coords.lat, lon: coords.lon, corrected: true });
  } else {
    await tx.objectStore('userdata').put({ ...u, corrected: null });
    const back = original ?? { lat: c.lat, lon: c.lon };
    await tx.objectStore('caches').put({ ...c, lat: back.lat, lon: back.lon, corrected: false });
  }
  await tx.done;
}

export async function saveOwnWaypoint(code: string, wp: Waypoint): Promise<void> {
  await updateUserData(code, (u) => ({
    ...u,
    ownWaypoints: [...u.ownWaypoints.filter((w) => w.code !== wp.code), { ...wp, own: true }],
  }));
}

export async function deleteOwnWaypoint(code: string, wpCode: string): Promise<void> {
  await updateUserData(code, (u) => ({ ...u, ownWaypoints: u.ownWaypoints.filter((w) => w.code !== wpCode) }));
}

/** Wegpunkte aus dem Listing plus eigene Wegpunkte */
export async function getWaypoints(code: string): Promise<Waypoint[]> {
  const [det, u] = await Promise.all([getDetails(code), getUserData(code)]);
  return [...(det?.waypoints ?? []), ...u.ownWaypoints];
}

/* ---------- Datensicherung ---------- */

export interface Backup {
  app: 'dosenfinder';
  version: 1;
  exportedAt: string;
  caches: CacheSummary[];
  details: CacheDetails[];
  fieldnotes: FieldNote[];
  userdata: UserData[];
}

export async function createBackup(): Promise<Backup> {
  const d = await db();
  const [caches, details, fieldnotes, userdata] = await Promise.all([
    d.getAll('caches'),
    d.getAll('details'),
    d.getAll('fieldnotes'),
    d.getAll('userdata'),
  ]);
  return { app: 'dosenfinder', version: 1, exportedAt: new Date().toISOString(), caches, details, fieldnotes, userdata };
}

export class BackupError extends Error {}

/** Spielt eine Sicherung ein. Vorhandene Einträge mit gleichem Code werden ersetzt, andere bleiben. */
export async function restoreBackup(b: unknown): Promise<{ caches: number; fieldnotes: number; userdata: number }> {
  const data = b as Partial<Backup>;
  if (!data || data.app !== 'dosenfinder' || !Array.isArray(data.caches)) {
    throw new BackupError('Das ist keine Dosenfinder-Sicherung.');
  }
  const d = await db();
  const tx = d.transaction(['caches', 'details', 'fieldnotes', 'userdata'], 'readwrite');
  for (const c of data.caches) await tx.objectStore('caches').put(c);
  for (const x of data.details ?? []) await tx.objectStore('details').put(x);
  for (const x of data.fieldnotes ?? []) await tx.objectStore('fieldnotes').put(x);
  for (const x of data.userdata ?? []) await tx.objectStore('userdata').put(x);
  await tx.done;
  return { caches: data.caches.length, fieldnotes: data.fieldnotes?.length ?? 0, userdata: data.userdata?.length ?? 0 };
}

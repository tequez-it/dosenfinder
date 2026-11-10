import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CacheDetails, CacheSummary, ParseResult } from './types';

/*
 * Lokale Datenbank im Browser (IndexedDB). Alles bleibt auf dem Gerät.
 * - caches:  Kurzdaten für Liste/Karte (klein, wird komplett geladen)
 * - details: Beschreibung, Hint, Logs, Wegpunkte (nur bei Bedarf geladen)
 */
interface DosenDB extends DBSchema {
  caches: { key: string; value: CacheSummary };
  details: { key: string; value: CacheDetails };
}

let dbPromise: Promise<IDBPDatabase<DosenDB>> | null = null;

function db(): Promise<IDBPDatabase<DosenDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DosenDB>('dosenfinder', 1, {
      upgrade(d) {
        d.createObjectStore('caches', { keyPath: 'code' });
        d.createObjectStore('details', { keyPath: 'code' });
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
  const tx = d.transaction(['caches', 'details'], 'readwrite');
  const caches = tx.objectStore('caches');
  const details = tx.objectStore('details');
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

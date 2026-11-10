import { unzipSync } from 'fflate';
import { GpxError, parseGpx } from './parse';
import type { ParseResult } from '../types';

export interface FileParseResult extends ParseResult {
  /** Namen der gelesenen GPX-Dateien (bei ZIP mehrere) */
  files: string[];
}

function isZip(bytes: Uint8Array): boolean {
  // ZIP-Dateien beginnen mit "PK\x03\x04"
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

const decoder = new TextDecoder('utf-8');

/**
 * Liest eine GPX- oder Pocket-Query-ZIP-Datei (Bytes) und gibt alle Caches und
 * Wegpunkte zurück. Bei ZIPs werden alle enthaltenen .gpx-Dateien gelesen.
 */
export function parseBytes(fileName: string, bytes: Uint8Array, importedAt = Date.now()): FileParseResult {
  const out: FileParseResult = { caches: [], waypoints: [], files: [] };

  let entries: [string, Uint8Array][];
  if (isZip(bytes)) {
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(bytes);
    } catch {
      throw new GpxError('Die ZIP-Datei konnte nicht entpackt werden.');
    }
    entries = Object.entries(unzipped).filter(([name]) => name.toLowerCase().endsWith('.gpx'));
    if (entries.length === 0) {
      throw new GpxError('In der ZIP-Datei ist keine GPX-Datei.');
    }
  } else {
    entries = [[fileName, bytes]];
  }

  for (const [name, data] of entries) {
    const r = parseGpx(decoder.decode(data), importedAt);
    out.caches.push(...r.caches);
    out.waypoints.push(...r.waypoints);
    out.files.push(name);
  }
  return out;
}

export async function parseFile(file: File): Promise<FileParseResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return parseBytes(file.name, buf);
}

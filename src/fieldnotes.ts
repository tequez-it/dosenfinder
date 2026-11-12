import type { CacheType } from './types';

/*
 * Field Notes ("Drafts" auf geocaching.com): Logs werden unterwegs nur auf dem
 * Handy gespeichert und später als Datei exportiert. Die Datei lädt man auf
 * geocaching.com hoch und schickt die Logs dort ab.
 *
 * Dateiformat wie bei Garmin-Geräten und c:geo (geocache_visits.txt):
 *   GCxxxxx,2026-11-12T18:30:00Z,Found it,"Logtext"
 * Eine Zeile pro Log, Zeit in UTC, Text in Anführungszeichen, Kodierung UTF-16LE.
 */

export type FieldNoteType = 'found' | 'dnf' | 'note' | 'maintenance' | 'attended' | 'webcam';

export interface FieldNote {
  /** Cache-Code; pro Cache gibt es höchstens eine Field Note */
  code: string;
  type: FieldNoteType;
  /** Zeitpunkt des Besuchs als ISO-String (UTC) */
  date: string;
  text: string;
  /** schon in einer exportierten Datei enthalten */
  exported: boolean;
  updatedAt: number;
}

export const FIELD_NOTE_TYPES: Record<FieldNoteType, { label: string; gc: string; cls: string }> = {
  found: { label: 'Gefunden', gc: 'Found it', cls: 'log-found' },
  attended: { label: 'Teilgenommen', gc: 'Attended', cls: 'log-found' },
  webcam: { label: 'Webcam-Foto gemacht', gc: 'Webcam photo taken', cls: 'log-found' },
  dnf: { label: 'Nicht gefunden', gc: "Didn't find it", cls: 'log-dnf' },
  note: { label: 'Notiz', gc: 'Write note', cls: '' },
  maintenance: { label: 'Wartung nötig', gc: 'Needs maintenance', cls: 'log-dnf' },
};

/** Welche Logtypen zu welchem Cache-Typ passen */
export function typesFor(cacheType: CacheType): FieldNoteType[] {
  if (cacheType === 'event') return ['attended', 'note'];
  if (cacheType === 'webcam') return ['webcam', 'dnf', 'note', 'maintenance'];
  return ['found', 'dnf', 'note', 'maintenance'];
}

/** Zählt als Fund – der Cache wird dann in der App als gefunden markiert */
export function countsAsFind(t: FieldNoteType): boolean {
  return t === 'found' || t === 'attended' || t === 'webcam';
}

function utcStamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}

/** Baut den Inhalt von geocache_visits.txt, älteste zuerst. */
export function buildFieldNotesText(notes: FieldNote[]): string {
  return [...notes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((n) => {
      // Doppelte Anführungszeichen würden das Format zerbrechen
      const text = n.text.trim().replace(/"/g, "'").replace(/\r\n?/g, '\n');
      return `${n.code},${utcStamp(n.date)},${FIELD_NOTE_TYPES[n.type].gc},"${text}"\n`;
    })
    .join('');
}

/** UTF-16LE ohne BOM – so schreibt es auch c:geo. */
export function encodeUtf16le(s: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(s.length * 2));
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c & 0xff;
    out[i * 2 + 1] = c >> 8;
  }
  return out;
}

/** Datum für <input type="datetime-local"> in lokaler Zeit */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

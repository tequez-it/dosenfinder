/** Eine Koordinate im Geocaching-üblichen Format: N 50° 59.227' */
function part(value: number, pos: string, neg: string, degDigits: number): string {
  const hemi = value < 0 ? neg : pos;
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = Math.round((abs - deg) * 60 * 1000) / 1000;
  if (min >= 60) {
    deg += 1;
    min = 0;
  }
  return `${hemi} ${String(deg).padStart(degDigits, '0')}° ${min.toFixed(3).padStart(6, '0')}'`;
}

export function formatCoords(lat: number, lon: number): string {
  return `${part(lat, 'N', 'S', 2)} ${part(lon, 'E', 'W', 3)}`;
}

/** ROT13 – so verschlüsselt geocaching.com Hinweise. Zweimal angewendet = Klartext. */
export function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

const df = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** ISO-Datum aus der GPX-Datei als "01.10.2026"; unlesbare Werte unverändert. */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : df.format(d);
}

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

/**
 * Liest Koordinaten in den üblichen Schreibweisen:
 *   N 50° 59.123 E 010° 01.456   (Grad + Dezimalminuten, wie auf geocaching.com)
 *   N 50° 59' 07.4" E 10° 01' 27.3"   (Grad, Minuten, Sekunden)
 *   50.98538, 10.02427   (Dezimalgrad)
 * "O" statt "E" (Ost) ist erlaubt, Komma statt Punkt in den Minuten auch.
 * Gibt null zurück, wenn nichts Gültiges erkannt wird.
 */
export function parseCoords(input: string): { lat: number; lon: number } | null {
  const s = input.trim().toUpperCase().replace(/[′’‘]/g, "'").replace(/[″“”]/g, '"');
  const num = (v: string) => Number.parseFloat(v.replace(',', '.'));
  const check = (lat: number, lon: number) =>
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;

  // Grad, Minuten, Sekunden
  const dms = s.match(
    /^([NS])\s*(\d{1,2})\s*°?\s+(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*"?\s*[, ]?\s*([EWO])\s*(\d{1,3})\s*°?\s+(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*"?$/,
  );
  if (dms) {
    const lat = (num(dms[2]) + num(dms[3]) / 60 + num(dms[4]) / 3600) * (dms[1] === 'S' ? -1 : 1);
    const lon = (num(dms[6]) + num(dms[7]) / 60 + num(dms[8]) / 3600) * (dms[5] === 'W' ? -1 : 1);
    if (num(dms[3]) < 60 && num(dms[4]) < 60 && num(dms[7]) < 60 && num(dms[8]) < 60) return check(lat, lon);
    return null;
  }

  // Grad und Dezimalminuten
  const ddm = s.match(/^([NS])\s*(\d{1,2})\s*°?\s+(\d{1,2}(?:[.,]\d+)?)\s*'?\s*[, ]?\s*([EWO])\s*(\d{1,3})\s*°?\s+(\d{1,2}(?:[.,]\d+)?)\s*'?$/);
  if (ddm) {
    if (num(ddm[3]) >= 60 || num(ddm[6]) >= 60) return null;
    const lat = (num(ddm[2]) + num(ddm[3]) / 60) * (ddm[1] === 'S' ? -1 : 1);
    const lon = (num(ddm[5]) + num(ddm[6]) / 60) * (ddm[4] === 'W' ? -1 : 1);
    return check(lat, lon);
  }

  // Dezimalgrad: "50.98538, 10.02427" oder "50,98538; 10,02427" oder "50.98538 10.02427"
  const dec = s.match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/) ?? s.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (dec) return check(num(dec[1]), num(dec[2]));

  return null;
}

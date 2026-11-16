import type { CacheDetails, CacheSummary, Waypoint } from '../types';

/*
 * GPX-Export im Groundspeak-Format (wie Pocket Queries), damit andere Programme
 * – und Dosenfinder selbst – die Datei wieder einlesen können.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (n: number) => n.toFixed(6);
const rating = (n: number | null) => (n === null ? '' : String(n));

export interface ExportItem {
  summary: CacheSummary;
  details?: CacheDetails;
  ownWaypoints?: Waypoint[];
}

function waypointXml(parentCode: string, w: Waypoint, i: number): string {
  if (w.lat === null || w.lon === null) return '';
  // Eigene Wegpunkte bekommen einen gültigen Code, der zum Cache passt (XX + Cache-Code ohne GC)
  const code = w.own ? `${String(i).padStart(2, '0').slice(-2)}${parentCode.replace(/^GC/, '')}` : w.code;
  return `  <wpt lat="${num(w.lat)}" lon="${num(w.lon)}">
    <name>${esc(code)}</name>
    <cmt>${esc(w.comment)}</cmt>
    <desc>${esc(w.name)}</desc>
    <sym>${esc(w.own ? 'Reference Point' : w.type)}</sym>
    <type>Waypoint|${esc(w.own ? 'Reference Point' : w.type)}</type>
  </wpt>
`;
}

export function buildGpx(items: ExportItem[], now = new Date()): string {
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="utf-8"?>
<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0" creator="Dosenfinder" xmlns="http://www.topografix.com/GPX/1/0" xmlns:groundspeak="http://www.groundspeak.com/cache/1/0/1">
  <name>Dosenfinder-Export</name>
  <time>${now.toISOString()}</time>
`);
  const wpts: string[] = [];
  for (const { summary: c, details: d, ownWaypoints } of items) {
    const logs = (d?.logs ?? [])
      .map(
        (l) => `        <groundspeak:log id="${esc(l.id)}">
          <groundspeak:date>${esc(l.date)}</groundspeak:date>
          <groundspeak:type>${esc(l.type)}</groundspeak:type>
          <groundspeak:finder>${esc(l.finder)}</groundspeak:finder>
          <groundspeak:text encoded="False">${esc(l.text)}</groundspeak:text>
        </groundspeak:log>`,
      )
      .join('\n');
    const attrs = (d?.attributes ?? [])
      .map((a) => `        <groundspeak:attribute id="${a.id}" inc="${a.inc ? 1 : 0}">${esc(a.name)}</groundspeak:attribute>`)
      .join('\n');
    parts.push(`  <wpt lat="${num(c.lat)}" lon="${num(c.lon)}">
    <time>${esc(d?.placedAt ?? '')}</time>
    <name>${esc(c.code)}</name>
    <desc>${esc(`${c.name} by ${c.owner}`)}</desc>
    <url>${esc(d?.url ?? '')}</url>
    <urlname>${esc(c.name)}</urlname>
    <sym>${c.found ? 'Geocache Found' : 'Geocache'}</sym>
    <type>Geocache|${esc(c.typeLabel)}</type>
    <groundspeak:cache available="${c.available ? 'True' : 'False'}" archived="${c.archived ? 'True' : 'False'}">
      <groundspeak:name>${esc(c.name)}</groundspeak:name>
      <groundspeak:placed_by>${esc(c.owner)}</groundspeak:placed_by>
      <groundspeak:type>${esc(c.typeLabel)}</groundspeak:type>
      <groundspeak:container>${esc(c.container)}</groundspeak:container>
      <groundspeak:attributes>
${attrs}
      </groundspeak:attributes>
      <groundspeak:difficulty>${rating(c.difficulty)}</groundspeak:difficulty>
      <groundspeak:terrain>${rating(c.terrain)}</groundspeak:terrain>
      <groundspeak:country>${esc(d?.country ?? '')}</groundspeak:country>
      <groundspeak:state>${esc(d?.state ?? '')}</groundspeak:state>
      <groundspeak:short_description html="${d?.shortDescriptionHtml ? 'True' : 'False'}">${esc(d?.shortDescription ?? '')}</groundspeak:short_description>
      <groundspeak:long_description html="${d?.longDescriptionHtml ? 'True' : 'False'}">${esc(d?.longDescription ?? '')}</groundspeak:long_description>
      <groundspeak:encoded_hints>${esc(d?.hint ?? '')}</groundspeak:encoded_hints>
      <groundspeak:logs>
${logs}
      </groundspeak:logs>
    </groundspeak:cache>
  </wpt>
`);
    let i = 1;
    for (const w of [...(d?.waypoints ?? []), ...(ownWaypoints ?? [])]) {
      wpts.push(waypointXml(c.code, w, w.own ? 90 + i++ : 0));
    }
  }
  parts.push(...wpts);
  parts.push('</gpx>\n');
  return parts.join('');
}

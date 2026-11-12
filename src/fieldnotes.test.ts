import { describe, expect, it } from 'vitest';
import { buildFieldNotesText, encodeUtf16le, typesFor, type FieldNote } from './fieldnotes';

const note = (p: Partial<FieldNote>): FieldNote => ({
  code: 'GCTEST1',
  type: 'found',
  date: '2026-11-12T18:30:05.000Z',
  text: 'TFTC',
  exported: false,
  updatedAt: 0,
  ...p,
});

describe('Field Notes', () => {
  it('Format wie geocache_visits.txt, älteste zuerst', () => {
    const txt = buildFieldNotesText([
      note({ code: 'GCTEST2', type: 'dnf', date: '2026-11-12T19:00:00.000Z', text: 'Nichts "gefunden"' }),
      note({}),
    ]);
    expect(txt).toBe(
      'GCTEST1,2026-11-12T18:30:05Z,Found it,"TFTC"\n' +
        "GCTEST2,2026-11-12T19:00:00Z,Didn't find it,\"Nichts 'gefunden'\"\n",
    );
  });

  it('mehrzeiliger Text bleibt erhalten', () => {
    expect(buildFieldNotesText([note({ text: 'Zeile 1\r\nZeile 2' })])).toContain('"Zeile 1\nZeile 2"');
  });

  it('UTF-16LE ohne BOM', () => {
    expect([...encodeUtf16le('Aä')]).toEqual([0x41, 0x00, 0xe4, 0x00]);
  });

  it('Logtypen je Cache-Typ', () => {
    expect(typesFor('event')).toEqual(['attended', 'note']);
    expect(typesFor('traditional')[0]).toBe('found');
  });
});

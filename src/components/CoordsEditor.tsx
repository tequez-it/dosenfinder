import { useState } from 'preact/hooks';
import { formatCoords, parseCoords } from '../format';
import { project, type LatLon } from '../geo';

interface Props {
  /** Startwert im Eingabefeld */
  initial: LatLon | null;
  /** Bezugspunkt für die Projektion (z. B. Listing-Koordinaten) */
  base: LatLon;
  baseLabel: string;
  /** eigener Standort, falls bekannt */
  pos: LatLon | null;
  saveLabel?: string;
  onSave: (c: LatLon) => void;
  onCancel: () => void;
}

type Mode = 'input' | 'project';

/**
 * Koordinaten eingeben (alle üblichen Schreibweisen), eigenen Standort übernehmen
 * oder per Projektion (Richtung + Entfernung) berechnen – wie in c:geo.
 */
export function CoordsEditor({ initial, base, baseLabel, pos, saveLabel = 'Speichern', onSave, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('input');
  const [text, setText] = useState(initial ? formatCoords(initial.lat, initial.lon) : '');
  const [from, setFrom] = useState<'base' | 'pos'>('base');
  const [brg, setBrg] = useState('');
  const [dist, setDist] = useState('');

  const parsed = parseCoords(text);

  const projStart = from === 'pos' && pos ? pos : base;
  const b = Number.parseFloat(brg.replace(',', '.'));
  const m = Number.parseFloat(dist.replace(',', '.'));
  const projValid = Number.isFinite(b) && b >= 0 && b <= 360 && Number.isFinite(m) && m >= 0 && m < 1e6;
  const projected = projValid ? project(projStart, b, m) : null;

  const result = mode === 'input' ? parsed : projected;

  return (
    <div class="coords-editor">
      <div class="segmented">
        <button class={mode === 'input' ? 'seg-on' : ''} onClick={() => setMode('input')}>Eingeben</button>
        <button class={mode === 'project' ? 'seg-on' : ''} onClick={() => setMode('project')}>Projektion</button>
      </div>

      {mode === 'input' ? (
        <>
          <input
            class="field coords-input"
            value={text}
            placeholder="N 50° 59.123 E 010° 01.456"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
            aria-label="Koordinaten"
          />
          <div class="coords-quick">
            <button class="text-btn" onClick={() => setText(formatCoords(base.lat, base.lon))}>{baseLabel} übernehmen</button>
            {pos && (
              <button class="text-btn" onClick={() => setText(formatCoords(pos.lat, pos.lon))}>Mein Standort</button>
            )}
          </div>
          {text.trim() && !parsed && <p class="status-error coords-msg">Koordinaten nicht erkannt.</p>}
        </>
      ) : (
        <>
          <div class="coords-row">
            <span class="filter-label-wide">Von</span>
            <select value={from} onChange={(e) => setFrom((e.target as HTMLSelectElement).value as 'base' | 'pos')}>
              <option value="base">{baseLabel}</option>
              {pos && <option value="pos">Mein Standort</option>}
            </select>
          </div>
          <div class="coords-row">
            <span class="filter-label-wide">Richtung</span>
            <input class="field" inputMode="decimal" value={brg} placeholder="z. B. 245" onInput={(e) => setBrg((e.target as HTMLInputElement).value)} aria-label="Richtung in Grad" />
            <span class="filter-sep">°</span>
          </div>
          <div class="coords-row">
            <span class="filter-label-wide">Entfernung</span>
            <input class="field" inputMode="decimal" value={dist} placeholder="z. B. 120" onInput={(e) => setDist((e.target as HTMLInputElement).value)} aria-label="Entfernung in Metern" />
            <span class="filter-sep">m</span>
          </div>
        </>
      )}

      {result && <p class="coords-msg">Ergebnis: <b>{formatCoords(result.lat, result.lon)}</b></p>}

      <div class="detail-actions coords-actions">
        <button class="secondary-btn" onClick={onCancel}>Abbrechen</button>
        <button class="primary-btn" disabled={!result} onClick={() => result && onSave(result)}>{saveLabel}</button>
      </div>
    </div>
  );
}

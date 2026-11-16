import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { resolveVariables, FUNCTION_HELP, asString } from '../formula/formula';
import { evaluateCalcCoord, type CalcCoordDef } from '../formula/calcCoords';
import { savePuzzleData, setCorrectedCoords } from '../db';
import { formatCoords } from '../format';
import { distance, formatDistance, type LatLon } from '../geo';
import type { CacheSummary, UserData, Waypoint } from '../types';

interface Props {
  c: CacheSummary;
  user: UserData;
  pos: LatLon | null;
  onChanged: () => void;
  onNavigate: (wp?: string) => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** "50° 59.123" aus einer Dezimal-Koordinate, als Startwert für eine berechnete Koordinate */
function partFromCoord(value: number, isLat: boolean): string {
  const f = formatCoords(isLat ? Math.abs(value) : 0, isLat ? 0 : Math.abs(value)); // "N 50° 59.123' E 010° 01.456'"
  const m = f.match(/^N (.+?)' E (.+?)'$/);
  return m ? (isLat ? m[1] : m[2]) : '';
}

/** Berechnete Wegpunkte an die aktuellen Variablen anpassen (wie c:geo) */
function recalcWaypoints(own: Waypoint[], defs: CalcCoordDef[], variables: Record<string, string>): Waypoint[] {
  const { lookup } = resolveVariables(variables);
  return own.map((w) => {
    if (!w.calc) return w;
    const def = defs.find((d) => d.id === w.calc!.defId);
    if (!def) return w;
    const r = evaluateCalcCoord(def, lookup);
    const p = r.points[w.calc.index];
    return p ? { ...w, lat: p.lat, lon: p.lon } : { ...w, lat: null, lon: null };
  });
}

/**
 * Reiter "Variablen" wie in c:geo: Rätsel-Variablen (Werte oder Formeln) und
 * berechnete Koordinaten, die sich aus den Variablen automatisch ergeben.
 */
export function VariablesTab({ c, user, pos, onChanged, onNavigate }: Props) {
  const [vars, setVars] = useState<Record<string, string>>(() => ({ ...(user.variables ?? {}) }));
  const [defs, setDefs] = useState<CalcCoordDef[]>(() => user.calcCoords ?? []);
  const [showHelp, setShowHelp] = useState(false);
  const [saved, setSaved] = useState('');

  const { results, lookup } = useMemo(() => resolveVariables(vars), [vars]);
  const calcResults = useMemo(() => defs.map((d) => evaluateCalcCoord(d, lookup)), [defs, lookup]);

  // Variablen, die in Koordinaten gebraucht werden, aber noch keine Zeile haben
  const neededMissing = useMemo(() => {
    const all = new Set(calcResults.flatMap((r) => r.neededVars));
    return [...all].filter((n) => !(n in vars)).sort();
  }, [calcResults, vars]);

  const persist = async (nextVars: Record<string, string>, nextDefs: CalcCoordDef[]) => {
    await savePuzzleData(c.code, { variables: nextVars, calcCoords: nextDefs }, (stored) => recalcWaypoints(stored, nextDefs, nextVars));
    onChanged();
  };

  // Automatisch speichern, kurz nachdem nichts mehr getippt wird
  const first = useRef(true);
  const pending = useRef<{ vars: Record<string, string>; defs: CalcCoordDef[] } | null>(null);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = { vars, defs };
    const t = setTimeout(() => {
      pending.current = null;
      void persist(vars, defs);
    }, 500);
    return () => clearTimeout(t);
  }, [vars, defs]);
  // Beim Verlassen des Reiters Ungespeichertes sofort sichern
  useEffect(
    () => () => {
      if (pending.current) void persist(pending.current.vars, pending.current.defs);
    },
    [],
  );

  const setVar = (name: string, value: string) => setVars((v) => ({ ...v, [name]: value }));
  const removeVar = (name: string) => {
    const next = { ...vars };
    delete next[name];
    setVars(next);
  };
  const addVar = () => {
    const free = ALPHABET.find((l) => !(l in vars));
    if (free) setVars((v) => ({ ...v, [free]: '' }));
  };

  const updateDef = (id: string, change: Partial<CalcCoordDef>) =>
    setDefs((ds) => ds.map((d) => (d.id === id ? { ...d, ...change } : d)));
  const addDef = () => {
    const next = [
      ...defs,
      {
        id: `C${Date.now().toString(36)}`,
        name: `Final${defs.length ? ` ${defs.length + 1}` : ''}`,
        latHemi: (c.lat < 0 ? 'S' : 'N') as 'N' | 'S',
        lat: partFromCoord(c.lat, true),
        lonHemi: (c.lon < 0 ? 'W' : 'E') as 'E' | 'W',
        lon: partFromCoord(c.lon, false),
      },
    ];
    setDefs(next);
  };
  const removeDef = (id: string) => {
    setDefs(defs.filter((d) => d.id !== id));
  };

  const saveAsWaypoint = async (def: CalcCoordDef, index: number, p: LatLon, count: number) => {
    const newCode = `EIGEN${Date.now().toString(36).toUpperCase()}${index}`;
    const wp: Waypoint = {
      code: newCode,
      name: count > 1 ? `${def.name} (${index + 1})` : def.name,
      type: 'Berechnete Koordinate',
      lat: p.lat,
      lon: p.lon,
      comment: `${def.latHemi} ${def.lat} ${def.lonHemi} ${def.lon}`,
      own: true,
      calc: { defId: def.id, index },
    };
    await savePuzzleData(c.code, { variables: vars, calcCoords: defs }, (stored) => {
      // Gibt es zu dieser Formel schon einen Wegpunkt, wird er aktualisiert statt verdoppelt
      const existing = stored.find((w) => w.calc?.defId === def.id && w.calc.index === index);
      const next = { ...wp, code: existing?.code ?? newCode };
      return [...stored.filter((w) => w.code !== next.code), next];
    });
    setSaved(`Wegpunkt „${wp.name}“ gespeichert. Er rechnet sich bei geänderten Variablen neu.`);
    onChanged();
  };

  const saveAsCacheCoords = async (p: LatLon) => {
    await setCorrectedCoords(c.code, p);
    setSaved('Cache-Koordinaten korrigiert.');
    onChanged();
  };

  const varNames = [...Object.keys(vars), ...neededMissing].sort();

  return (
    <section class="section section-first vars">
      <h2>Variablen</h2>
      {varNames.length === 0 && <p class="muted">Noch keine Variablen. Werte, die du unterwegs ermittelst (z. B. „Anzahl Bänke“), hier eintragen.</p>}
      <ul class="var-list">
        {varNames.map((name) => {
          const r = results[name];
          const isNeeded = !(name in vars);
          return (
            <li class="var-row">
              <span class="var-name">{name}</span>
              <input
                class="field var-input"
                value={vars[name] ?? ''}
                placeholder={isNeeded ? 'wird gebraucht' : 'Wert oder Formel'}
                autocapitalize="characters"
                autocomplete="off"
                spellcheck={false}
                onInput={(e) => setVar(name, (e.target as HTMLInputElement).value)}
               
                aria-label={`Variable ${name}`}
              />
              <span class={`var-result ${r?.error ? 'status-error' : ''}`}>
                {r?.error ? '⚠' : r?.value !== undefined && asString(r.value) !== (vars[name] ?? '').trim() ? `= ${asString(r.value)}` : ''}
              </span>
              {!isNeeded && (
                <button class="icon-btn var-del" onClick={() => removeVar(name)} aria-label={`Variable ${name} löschen`}>
                  ×
                </button>
              )}
              {r?.error && <div class="var-error status-error">{r.error}</div>}
            </li>
          );
        })}
      </ul>
      <button class="text-btn" onClick={addVar}>+ Variable</button>

      <h2>Berechnete Koordinaten</h2>
      {defs.length === 0 && (
        <p class="muted">
          Formel für das Final eingeben, z. B. N 50° 5A.B(C*2)7. Teile direkt hintereinander werden aneinandergehängt.
        </p>
      )}
      {defs.map((d, i) => {
        const r = calcResults[i];
        return (
          <div class="calc-card">
            <div class="calc-head">
              <input class="field calc-name" value={d.name} onInput={(e) => updateDef(d.id, { name: (e.target as HTMLInputElement).value })} aria-label="Name" />
              <button class="icon-btn" onClick={() => removeDef(d.id)} aria-label="Berechnete Koordinate löschen">×</button>
            </div>
            <div class="calc-line">
              <button class="hemi" onClick={() => { updateDef(d.id, { latHemi: d.latHemi === 'N' ? 'S' : 'N' }); }} aria-label="Nord/Süd wechseln">{d.latHemi}</button>
              <input class="field coords-input" value={d.lat} onInput={(e) => updateDef(d.id, { lat: (e.target as HTMLInputElement).value })} autocapitalize="characters" autocomplete="off" spellcheck={false} aria-label="Breite (Formel)" />
            </div>
            <div class="calc-line">
              <button class="hemi" onClick={() => { updateDef(d.id, { lonHemi: d.lonHemi === 'E' ? 'W' : 'E' }); }} aria-label="Ost/West wechseln">{d.lonHemi}</button>
              <input class="field coords-input" value={d.lon} onInput={(e) => updateDef(d.id, { lon: (e.target as HTMLInputElement).value })} autocapitalize="characters" autocomplete="off" spellcheck={false} aria-label="Länge (Formel)" />
            </div>
            {r.error && <p class="status-error coords-msg">{r.error}</p>}
            {r.missing.length > 0 && <p class="muted coords-msg">Es fehlen noch: {r.missing.join(', ')}</p>}
            {r.points.map((p, idx) => (
              <div class="calc-result">
                <div>
                  <b>{formatCoords(p.lat, p.lon)}</b>
                  {pos && <span class="muted"> · {formatDistance(distance(pos, p))}</span>}
                </div>
                <div class="calc-actions">
                  <button class="text-btn" onClick={() => saveAsWaypoint(d, idx, p, r.points.length)}>Als Wegpunkt</button>
                  {r.points.length === 1 && <button class="text-btn" onClick={() => saveAsCacheCoords(p)}>Als Cache-Koordinaten</button>}
                  {user.ownWaypoints.some((w) => w.calc?.defId === d.id && w.calc.index === idx) && (
                    <button
                      class="text-btn"
                      onClick={() => onNavigate(user.ownWaypoints.find((w) => w.calc?.defId === d.id && w.calc.index === idx)!.code)}
                    >
                      Navigieren
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <button class="text-btn" onClick={addDef}>+ Berechnete Koordinate</button>

      {saved && <p class="status status-ok">{saved}</p>}

      <button class="text-btn help-toggle" onClick={() => setShowHelp(!showHelp)}>
        {showHelp ? 'Formel-Hilfe ausblenden' : 'Formel-Hilfe'}
      </button>
      {showHelp && (
        <div class="formula-help">
          <p>
            Rechnen mit + − * / % ^ ! und Klammern. Variablen sind einzelne Buchstaben; direkt hintereinander werden sie
            aneinandergehängt: mit A=1, B=2 ist <code>AB</code> = 12 und <code>5A(B+1)</code> = 513. Texte in
            Anführungszeichen: <code>'Dose'</code>. Variablen dürfen selbst Formeln sein, z. B. C = <code>A+B</code>.
          </p>
          <table>
            <tbody>
              {FUNCTION_HELP.map((f) => (
                <tr>
                  <td><code>{f.name}</code></td>
                  <td>
                    {f.text}
                    <br />
                    <span class="muted">{f.example}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

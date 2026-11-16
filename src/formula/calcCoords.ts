import { compile, FormulaError, MissingVariablesError, asString, type CompiledFormula, type VarLookup } from './formula';

/**
 * Berechnete Koordinate (wie "berechnete Koordinaten" in c:geo):
 * Breite und Länge werden getrennt eingegeben, jeweils "Grad° Minuten.Dezimalen",
 * wobei jeder Teil eine Formel sein darf, z. B.  N  50° 5A.B(C*2)7
 * Mehrere Teile direkt hintereinander werden aneinandergehängt.
 */
export interface CalcCoordDef {
  id: string;
  name: string;
  latHemi: 'N' | 'S';
  lat: string;
  lonHemi: 'E' | 'W';
  lon: string;
}

export interface CalcCoordResult {
  /** alle Ergebnisse (mehrere bei Bereichen wie [:1-3]) */
  points: { lat: number; lon: number }[];
  neededVars: string[];
  missing: string[];
  error?: string;
}

interface PartFormulas {
  deg: CompiledFormula;
  min: CompiledFormula;
  frac: CompiledFormula | null;
}

/** "50° 5A.B(C*2)7" → Grad-, Minuten- und Dezimal-Formel */
export function splitCoordPart(text: string): { deg: string; min: string; frac: string | null } {
  const s = text.trim().replace(/[′']/g, '');
  let degPart: string;
  let rest: string;
  const degIdx = s.indexOf('°');
  if (degIdx >= 0) {
    degPart = s.slice(0, degIdx);
    rest = s.slice(degIdx + 1);
  } else {
    const m = s.match(/^(\S+)\s+(.+)$/);
    if (!m) throw new FormulaError('Grad und Minuten trennen (° oder Leerzeichen)');
    degPart = m[1];
    rest = m[2];
  }
  rest = rest.trim();
  // Dezimalpunkt der Minuten: der letzte Punkt außerhalb von Klammern/Text
  let depth = 0;
  let quote = '';
  let dot = -1;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === "'" || c === '"') quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if ((c === '.' || c === ',') && depth === 0) dot = i;
  }
  if (!degPart.trim() || !rest) throw new FormulaError('Grad oder Minuten fehlen');
  return {
    deg: degPart.trim(),
    min: (dot >= 0 ? rest.slice(0, dot) : rest).trim(),
    frac: dot >= 0 ? rest.slice(dot + 1).trim() : null,
  };
}

function compilePart(text: string): PartFormulas {
  const p = splitCoordPart(text);
  return { deg: compile(p.deg), min: compile(p.min), frac: p.frac ? compile(p.frac) : null };
}

/** Ziffern aus einem Formelergebnis; erlaubt nur Ziffern (keine Kommastellen) */
function digits(v: string, what: string): string {
  const s = v.trim();
  if (!/^\d+$/.test(s)) throw new FormulaError(`${what} ergibt „${s}“ – erwartet werden nur Ziffern`);
  return s;
}

const MAX_POINTS = 100;

export function evaluateCalcCoord(def: Pick<CalcCoordDef, 'latHemi' | 'lat' | 'lonHemi' | 'lon'>, vars: VarLookup): CalcCoordResult {
  let lat: PartFormulas;
  let lon: PartFormulas;
  try {
    lat = compilePart(def.lat);
    lon = compilePart(def.lon);
  } catch (e) {
    return { points: [], neededVars: [], missing: [], error: (e as Error).message };
  }
  const formulas = [lat.deg, lat.min, lat.frac, lon.deg, lon.min, lon.frac].filter((f): f is CompiledFormula => f !== null);
  const neededVars = [...new Set(formulas.flatMap((f) => f.neededVars))].sort();
  const missing = neededVars.filter((n) => {
    try {
      return vars(n) === undefined;
    } catch {
      return false;
    }
  });
  if (missing.length) return { points: [], neededVars, missing };

  const total = formulas.reduce((n, f) => n * f.combinations, 1);
  if (total > MAX_POINTS) {
    return { points: [], neededVars, missing: [], error: `Zu viele Kombinationen (${total}, höchstens ${MAX_POINTS})` };
  }

  // Bereichs-Index auf die einzelnen Formeln verteilen
  const idxFor = (combo: number) => {
    const map = new Map<CompiledFormula, number>();
    let div = 1;
    for (const f of formulas) {
      map.set(f, Math.floor(combo / div) % f.combinations);
      div *= f.combinations;
    }
    return map;
  };

  const calc = (p: PartFormulas, idx: Map<CompiledFormula, number>, maxDeg: number, label: string) => {
    const deg = Number(digits(asString(p.deg.evaluate(vars, idx.get(p.deg))), `${label} Grad`));
    const minWhole = digits(asString(p.min.evaluate(vars, idx.get(p.min))), `${label} Minuten`);
    const frac = p.frac ? digits(asString(p.frac.evaluate(vars, idx.get(p.frac!))), `${label} Minuten-Dezimalen`) : '0';
    const min = Number(`${minWhole}.${frac}`);
    if (deg > maxDeg) throw new FormulaError(`${label}: ${deg}° ist zu groß`);
    if (min >= 60) throw new FormulaError(`${label}: ${min}' Minuten ist zu groß (unter 60)`);
    return deg + min / 60;
  };

  const points: { lat: number; lon: number }[] = [];
  try {
    for (let i = 0; i < total; i++) {
      const idx = idxFor(i);
      const la = calc(lat, idx, 90, 'Breite') * (def.latHemi === 'S' ? -1 : 1);
      const lo = calc(lon, idx, 180, 'Länge') * (def.lonHemi === 'W' ? -1 : 1);
      if (Math.abs(la) > 90 || Math.abs(lo) > 180) throw new FormulaError('Koordinate außerhalb des gültigen Bereichs');
      points.push({ lat: la, lon: lo });
    }
  } catch (e) {
    if (e instanceof MissingVariablesError) return { points: [], neededVars, missing: e.names };
    return { points: [], neededVars, missing: [], error: (e as Error).message };
  }
  return { points, neededVars, missing: [] };
}

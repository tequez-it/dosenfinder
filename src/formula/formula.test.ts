import { describe, expect, it } from 'vitest';
import { checksum, compile, evaluate, letterValue, MissingVariablesError, resolveVariables, roman, rot, vanity } from './formula';
import { evaluateCalcCoord, splitCoordPart } from './calcCoords';
import { formatCoords } from '../format';

describe('Rechnen', () => {
  it('Grundrechenarten und Vorrang', () => {
    expect(evaluate('1+2*3')).toBe(7);
    expect(evaluate('(1+2)*3')).toBe(9);
    expect(evaluate('2^3^2')).toBe(512);
    expect(evaluate('10/4')).toBe(2.5);
    expect(evaluate('7%3')).toBe(1);
    expect(evaluate('5!')).toBe(120);
    expect(evaluate('3²')).toBe(9);
    expect(evaluate('-3+5')).toBe(2);
    expect(evaluate('6 × 7')).toBe(42);
    expect(evaluate('12 : 4')).toBe(3);
  });
  it('Vergleiche', () => {
    expect(evaluate('3>2')).toBe(1);
    expect(evaluate('3<>3')).toBe(0);
    expect(evaluate('2<=2')).toBe(1);
  });
  it('Fehler', () => {
    expect(() => evaluate('1/0')).toThrow('Division durch 0');
    expect(() => evaluate('1+')).toThrow();
    expect(() => evaluate('(1+2')).toThrow('„)“ fehlt');
  });
});

describe('Variablen und Aneinanderhängen (wie c:geo)', () => {
  const v = { A: 1, B: 2, C: '05' };
  it('Buchstabenblöcke', () => {
    expect(evaluate('AB', v)).toBe('12');
    expect(evaluate('AA5(A+1)3', v)).toBe('11523');
    expect(evaluate('3(5+1)4')).toBe('364');
    expect(evaluate('A+B', v)).toBe(3);
    expect(evaluate('C', v)).toBe('05');
    expect(evaluate('0A', v)).toBe('01');
  });
  it('Leerzeichen hängen aneinander', () => {
    expect(evaluate('A B', v)).toBe('12');
  });
  it('fehlende Variablen', () => {
    try {
      evaluate('A+X', v);
      throw new Error('kein Fehler');
    } catch (e) {
      expect(e).toBeInstanceOf(MissingVariablesError);
      expect((e as MissingVariablesError).names).toEqual(['X']);
    }
    expect(compile('AB+C*D').neededVars).toEqual(['A', 'B', 'C', 'D']);
  });
  it('lange Namen mit $', () => {
    expect(evaluate('$Bank+1', { Bank: 4 })).toBe(5);
    expect(evaluate('${Bank}0', { Bank: 4 })).toBe('40');
  });
  it('Variablen dürfen Formeln sein, Zirkel wird erkannt', () => {
    const r = resolveVariables({ A: '3', B: 'A*2', C: 'AB', D: 'E', E: 'D' });
    expect(r.results.B.value).toBe(6);
    expect(r.results.C.value).toBe('36');
    expect(r.results.D.error).toContain('Zirkelbezug');
  });
});

describe('Rätsel-Funktionen', () => {
  it('Quersumme', () => {
    expect(evaluate('cs(1234)')).toBe(10);
    expect(evaluate('ics(1234)')).toBe(1);
    expect(checksum(99, true)).toBe(9);
  });
  it('Buchstabenwert', () => {
    expect(letterValue('Dose')).toBe(4 + 15 + 19 + 5);
    expect(letterValue('Äß')).toBe(57);
    expect(evaluate("bww('ABC')")).toBe(6);
  });
  it('ROT, römisch, Handy', () => {
    expect(rot('Hallo', 13)).toBe('Unyyb');
    expect(evaluate("rot('abc';1)")).toBe('bcd');
    expect(evaluate("rot13('Unyyb')")).toBe('Hallo');
    expect(roman('MCMXCIV')).toBe(1994);
    expect(evaluate("roman('XIV')")).toBe(14);
    expect(vanity('Dose')).toBe('3673');
  });
  it('Text', () => {
    expect(evaluate("len('Dose')")).toBe(4);
    expect(evaluate("sub('Dosenfinder';1;4)")).toBe('Dose');
    expect(evaluate("sub('Dosenfinder';-6)")).toBe('finder');
    expect(evaluate("ch('Dose';1;3)")).toBe('Ds');
  });
  it('Summe & Co. mit Variablenbereich', () => {
    const v = { A: 1, B: 2, C: 3 };
    expect(evaluate("sum('A-C';5)", v)).toBe(11);
    expect(evaluate("prod('A-C')", v)).toBe(6);
    expect(evaluate('max(A;B;5)', v)).toBe(5);
    expect(evaluate("avg('A-C')", v)).toBe(2);
    expect(evaluate("cnt('A-C')", v)).toBe(3);
  });
  it('Runden, Winkel, Wenn', () => {
    expect(evaluate('round(10/3;2)')).toBe(3.33);
    expect(evaluate('trunc(9.99)')).toBe(9);
    expect(evaluate('sin(30)')).toBeCloseTo(0.5, 10);
    expect(evaluate('if(2>1;7;8)')).toBe('7');
    expect(evaluate('sqrt(16)')).toBe(4);
  });
  it('Bereiche', () => {
    const f = compile('5[:1-3]');
    expect(f.combinations).toBe(3);
    expect([0, 1, 2].map((i) => f.evaluate(() => undefined, i))).toEqual(['51', '52', '53']);
  });
});

describe('Berechnete Koordinaten', () => {
  const vars = { A: 3, B: 1, C: 4 };
  const lookup = (n: string) => (vars as Record<string, number>)[n];

  it('zerlegt Grad/Minuten/Dezimalen', () => {
    expect(splitCoordPart('50° 5A.B(C*2)7')).toEqual({ deg: '50', min: '5A', frac: 'B(C*2)7' });
    expect(splitCoordPart('010 0A.BC0')).toEqual({ deg: '010', min: '0A', frac: 'BC0' });
  });

  it('rechnet aus', () => {
    const r = evaluateCalcCoord({ latHemi: 'N', lat: '50° 5A.B(C*2)7', lonHemi: 'E', lon: '010° 0C.ABC' }, lookup);
    expect(r.error).toBeUndefined();
    expect(r.points).toHaveLength(1);
    expect(formatCoords(r.points[0].lat, r.points[0].lon)).toBe("N 50° 53.187' E 010° 04.314'");
  });

  it('meldet fehlende Variablen', () => {
    const r = evaluateCalcCoord({ latHemi: 'N', lat: '50° 5X.000', lonHemi: 'E', lon: '010° 0Y.000' }, lookup);
    expect(r.missing).toEqual(['X', 'Y']);
  });

  it('prüft Minuten', () => {
    const r = evaluateCalcCoord({ latHemi: 'N', lat: '50° 7A.000', lonHemi: 'E', lon: '010° 00.000' }, lookup);
    expect(r.error).toContain('Minuten');
  });

  it('Bereiche ergeben mehrere Punkte', () => {
    const r = evaluateCalcCoord({ latHemi: 'N', lat: '50° 5[:1-2].000', lonHemi: 'E', lon: '010° 0[:3-4].000' }, lookup);
    expect(r.points).toHaveLength(4);
  });
});

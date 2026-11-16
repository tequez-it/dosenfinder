/*
 * Formel-Rechner für Rätsel-Caches, angelehnt an c:geo (utils/formulas, Apache-2.0).
 *
 * Unterstützt:
 *  - Rechnen: + - * / % ^ ² ³ ! sowie × ÷ : als Alternativen, Klammern () und []
 *  - Vergleiche: == <> < <= > >=  (Ergebnis 1 oder 0)
 *  - Variablen: einzelne Buchstaben (A, B, …), mehrere hintereinander werden
 *    aneinandergehängt: mit A=1, B=2 ergibt "AB" → 12 und "5A(B+1)" → 513.
 *    Längere Namen mit $Name oder ${Name}.
 *  - Texte in '…' oder "…"
 *  - Leerzeichen zwischen Ausdrücken hängen ebenfalls aneinander: "A B" → "12"
 *  - Bereiche [:1-3] oder [:1,4,7-9]: liefern mehrere Ergebnisse (jede Kombination)
 *  - Funktionen: siehe FUNCTIONS unten
 */

export type Value = string | number;

export class FormulaError extends Error {}

/** Fehlende Variablen – wird gesondert gemeldet, damit die UI sie anzeigen kann */
export class MissingVariablesError extends FormulaError {
  constructor(public readonly names: string[]) {
    super(`Wert fehlt für: ${names.join(', ')}`);
  }
}

export type VarLookup = (name: string) => Value | undefined;

/* ---------- Werte ---------- */

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new FormulaError('Ergebnis ist keine endliche Zahl');
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  // Rundungsrauschen (0.1 + 0.2) wegschneiden
  const s = n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

export function asString(v: Value): string {
  return typeof v === 'number' ? formatNumber(v) : v;
}

export function asNumber(v: Value): number {
  if (typeof v === 'number') return v;
  const s = v.trim().replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) throw new FormulaError(`„${v}“ ist keine Zahl`);
  return Number.parseFloat(s);
}

function concat(values: Value[]): Value {
  return values.map(asString).join('');
}

/* ---------- Rätsel-Hilfsfunktionen ---------- */

const SPECIAL_LETTER_VALUES: Record<string, number> = { ä: 27, ö: 28, ü: 29, ß: 30, Ä: 27, Ö: 28, Ü: 29 };

/** Buchstabenwert (A=1 … Z=26, Ziffern zählen mit ihrem Wert, Ä=27, Ö=28, Ü=29, ß=30) */
export function letterValue(s: string): number {
  let sum = 0;
  for (const ch of s) {
    const special = SPECIAL_LETTER_VALUES[ch];
    if (special !== undefined) {
      sum += special;
      continue;
    }
    const c = ch.normalize('NFD')[0];
    if (c >= 'a' && c <= 'z') sum += c.charCodeAt(0) - 96;
    else if (c >= 'A' && c <= 'Z') sum += c.charCodeAt(0) - 64;
    else if (c >= '0' && c <= '9') sum += c.charCodeAt(0) - 48;
  }
  return sum;
}

/** Quersumme; iterativ = so lange, bis eine Ziffer übrig bleibt */
export function checksum(v: Value, iterative: boolean): number {
  const s = asString(v);
  const cs = letterValue(s);
  const negate = s.trim().startsWith('-');
  if (!iterative || cs === 0) return negate ? -cs : cs;
  const it = cs % 9 === 0 ? 9 : cs % 9;
  return negate ? -it : it;
}

export function rot(s: string, n: number): string {
  const r = ((n % 26) + 26) % 26;
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + r) % 26) + base);
  });
}

export function roman(s: string): number {
  const d: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let result = 0;
  let last = -1;
  for (const ch of s.toUpperCase()) {
    const cur = d[ch] ?? -1;
    if (last > 0) result += cur > last ? -last : last;
    last = cur;
  }
  if (last > 0) result += last;
  return result;
}

const VANITY: Record<string, string> = {};
for (const [digit, letters] of Object.entries({ 1: '.,?!', 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ', 0: ' ' })) {
  for (const l of letters) VANITY[l] = digit;
}

/** Handy-Tastatur: Buchstaben → Ziffern (ABC=2, DEF=3, …) */
export function vanity(s: string): string {
  return [...s.toUpperCase()].map((c) => (c >= '0' && c <= '9' ? c : VANITY[c] ?? '')).join('');
}

/* ---------- Funktionen ---------- */

interface FnCtx {
  vars: VarLookup;
}

type Fn = (args: Value[], ctx: FnCtx) => Value;

function argCount(name: string, args: Value[], min: number, max = min) {
  if (args.length < min || args.length > max) {
    throw new FormulaError(`${name}: ${min === max ? min : `${min}–${max}`} Parameter erwartet, ${args.length} erhalten`);
  }
}

function num1(name: string, f: (x: number) => number): Fn {
  return (a) => {
    argCount(name, a, 1);
    return f(asNumber(a[0]));
  };
}

function truncRound(name: string, trunc: boolean): Fn {
  return (a) => {
    argCount(name, a, 1, 2);
    const x = asNumber(a[0]);
    const digits = a.length > 1 ? asNumber(a[1]) : 0;
    const f = 10 ** digits;
    return (trunc ? Math.trunc(x * f) : Math.round(x * f)) / f;
  };
}

/**
 * Für Summe & Co.: Parameter sind Zahlen oder Variablenbereiche als Text,
 * z. B. sum('A-C'; 5) = A + B + C + 5.
 */
function expandAggregate(args: Value[], ctx: FnCtx): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (typeof a === 'string' && /^\s*[A-Za-z]\s*-\s*[A-Za-z]\s*$/.test(a)) {
      const [from, to] = a.split('-').map((x) => x.trim().charCodeAt(0));
      const missing: string[] = [];
      for (let c = Math.min(from, to); c <= Math.max(from, to); c++) {
        const v = ctx.vars(String.fromCharCode(c));
        if (v === undefined) missing.push(String.fromCharCode(c));
        else out.push(asNumber(v));
      }
      if (missing.length) throw new MissingVariablesError(missing);
    } else {
      out.push(asNumber(a));
    }
  }
  return out;
}

const fact = (n: number): number => {
  if (!Number.isInteger(n) || n < 0) throw new FormulaError('Fakultät nur für ganze Zahlen ≥ 0');
  if (n > 170) throw new FormulaError('Zahl zu groß');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

/** Name(n) → Funktion. Namen und Abkürzungen wie in c:geo. */
const FUNCTIONS: Record<string, Fn> = {};
function def(names: string[], fn: Fn) {
  for (const n of names) FUNCTIONS[n] = fn;
}

def(['sqrt'], num1('sqrt', Math.sqrt));
def(['sin'], num1('sin', (x) => Math.sin((x * Math.PI) / 180)));
def(['cos'], num1('cos', (x) => Math.cos((x * Math.PI) / 180)));
def(['tan'], num1('tan', (x) => Math.tan((x * Math.PI) / 180)));
def(['abs'], num1('abs', Math.abs));
def(['round', 'rd'], truncRound('round', false));
def(['trunc', 'tr', 'floor', 'fl'], truncRound('trunc', true));
def(['if'], (a) => {
  for (let i = 0; i + 1 < a.length; i += 2) if (asNumber(a[i]) !== 0) return a[i + 1];
  return a.length % 2 === 1 ? a[a.length - 1] : 0;
});
def(['length', 'len'], (a) => {
  argCount('length', a, 1);
  return asString(a[0]).length;
});
def(['substring', 'substr', 'sub'], (a) => {
  argCount('substring', a, 1, 3);
  const s = asString(a[0]);
  let start = a.length > 1 ? asNumber(a[1]) : 1;
  if (start === 0 || Math.abs(start) > s.length + 1) throw new FormulaError('substring: Startposition ungültig');
  start = start < 0 ? s.length + start : start - 1;
  const len = a.length > 2 ? asNumber(a[2]) : s.length - start;
  return s.substr(start, len);
});
def(['chars', 'ch'], (a) => {
  if (a.length < 1) throw new FormulaError('chars: Text erwartet');
  const s = asString(a[0]);
  return a
    .slice(1)
    .map((i) => {
      const n = asNumber(i);
      if (n < 1 || n > s.length) throw new FormulaError(`chars: Position ${n} gibt es nicht`);
      return s[n - 1];
    })
    .join('');
});
def(['rot13'], (a) => {
  argCount('rot13', a, 1);
  return rot(asString(a[0]), 13);
});
def(['rot'], (a) => {
  argCount('rot', a, 1, 2);
  return rot(asString(a[0]), a.length > 1 ? asNumber(a[1]) : 13);
});
def(['checksum', 'cs'], (a) => {
  argCount('checksum', a, 1);
  return checksum(a[0], false);
});
def(['ichecksum', 'ics'], (a) => {
  argCount('ichecksum', a, 1);
  return checksum(a[0], true);
});
def(['lettervalue', 'lv', 'wordvalue', 'wv', 'bww'], (a) => {
  argCount('lettervalue', a, 1);
  return letterValue(asString(a[0]));
});
def(['roman'], (a) => {
  argCount('roman', a, 1);
  return roman(asString(a[0]));
});
def(['vanity', 'vanitycode', 'vc'], (a) => {
  argCount('vanity', a, 1);
  return vanity(asString(a[0]));
});
def(['add', 'sum'], (a, c) => expandAggregate(a, c).reduce((x, y) => x + y, 0));
def(['multiply', 'product', 'prod'], (a, c) => expandAggregate(a, c).reduce((x, y) => x * y, 1));
def(['minimum', 'min'], (a, c) => Math.min(...expandAggregate(a, c)));
def(['maximum', 'max'], (a, c) => Math.max(...expandAggregate(a, c)));
def(['count', 'cnt'], (a, c) => expandAggregate(a, c).length);
def(['average', 'avg'], (a, c) => {
  const l = expandAggregate(a, c);
  if (!l.length) throw new FormulaError('average: keine Werte');
  return l.reduce((x, y) => x + y, 0) / l.length;
});

/** Für die Hilfe-Anzeige */
export const FUNCTION_HELP: { name: string; example: string; text: string }[] = [
  { name: 'cs', example: "cs(1234) → 10", text: 'Quersumme' },
  { name: 'ics', example: "ics(1234) → 1", text: 'Iterierte Quersumme (bis eine Ziffer bleibt)' },
  { name: 'bww', example: "bww('Dose') → 43", text: 'Buchstabenwortwert (A=1 … Z=26, Ä=27, Ö=28, Ü=29, ß=30)' },
  { name: 'rot', example: "rot('abc';1) → bcd", text: 'Buchstaben verschieben (ohne Zahl: ROT13)' },
  { name: 'roman', example: "roman('XIV') → 14", text: 'Römische Zahl in Dezimalzahl' },
  { name: 'vanity', example: "vanity('Dose') → 3673", text: 'Handy-Tastatur: Buchstaben → Ziffern' },
  { name: 'len', example: "len('Dose') → 4", text: 'Länge eines Textes' },
  { name: 'sub', example: "sub('Dosenfinder';1;4) → Dose", text: 'Teiltext (Start ab 1; Länge)' },
  { name: 'ch', example: "ch('Dose';1;3) → Ds", text: 'Einzelne Zeichen auswählen' },
  { name: 'sum', example: "sum('A-C';5)", text: 'Summe; Bereiche wie A-C für Variablen' },
  { name: 'prod', example: "prod('A-C')", text: 'Produkt' },
  { name: 'min / max', example: 'max(A;B;5)', text: 'Kleinster / größter Wert' },
  { name: 'avg', example: "avg('A-D')", text: 'Durchschnitt' },
  { name: 'cnt', example: "cnt('A-D')", text: 'Anzahl Werte' },
  { name: 'round / trunc', example: 'round(A/3;2)', text: 'Runden / abschneiden (optional Nachkommastellen)' },
  { name: 'sqrt, abs', example: 'sqrt(A)', text: 'Wurzel, Betrag' },
  { name: 'sin, cos, tan', example: 'sin(30) → 0.5', text: 'Winkelfunktionen in Grad' },
  { name: 'if', example: 'if(A>5;1;0)', text: 'Wenn-Dann(-Sonst)' },
  { name: '!', example: '5! → 120', text: 'Fakultät' },
  { name: '[:1-3]', example: '5[:1-3]', text: 'Bereich: liefert mehrere Ergebnisse (51, 52, 53)' },
];

/* ---------- Parser ---------- */

interface Node {
  eval(vars: VarLookup, rangeIdx: number): Value;
}

const LETTERS = /[A-Za-z]/;
const DIGITS = /[0-9]/;

class Parser {
  private pos = 0;
  readonly neededVars = new Set<string>();
  /** Produkt der Bereichsgrößen = Anzahl Kombinationen */
  rangeCount = 1;

  constructor(private readonly s: string) {}

  private get ch(): string {
    return this.s[this.pos] ?? '';
  }

  private skipWs() {
    while (/\s/.test(this.ch)) this.pos++;
  }

  private eat(c: string): boolean {
    this.skipWs();
    if (this.s.startsWith(c, this.pos)) {
      this.pos += c.length;
      return true;
    }
    return false;
  }

  parse(): Node {
    const n = this.parseExpression();
    this.skipWs();
    if (this.pos < this.s.length) throw new FormulaError(`Unerwartetes Zeichen „${this.ch}“ an Stelle ${this.pos + 1}`);
    return n;
  }

  private parseExpression(): Node {
    const parts = [this.parseRelational()];
    // Durch Leerzeichen getrennte Ausdrücke aneinanderhängen
    while (this.pos < this.s.length && (/\s/.test(this.ch) || /\s/.test(this.s[this.pos - 1] ?? ''))) {
      this.skipWs();
      if (this.pos >= this.s.length || /[)\];]/.test(this.ch)) break;
      parts.push(this.parseRelational());
    }
    if (parts.length === 1) return parts[0];
    return { eval: (v, r) => concat(parts.map((p) => p.eval(v, r))) };
  }

  private parseRelational(): Node {
    const x = this.parsePlusMinus();
    for (const op of ['==', '<>', '<=', '>=', '<', '>']) {
      if (this.eat(op)) {
        const y = this.parsePlusMinus();
        const cmp = (a: Value, b: Value): number => {
          try {
            return asNumber(a) - asNumber(b);
          } catch {
            return asString(a).localeCompare(asString(b));
          }
        };
        const test: Record<string, (c: number) => boolean> = {
          '==': (c) => c === 0,
          '<>': (c) => c !== 0,
          '<=': (c) => c <= 0,
          '>=': (c) => c >= 0,
          '<': (c) => c < 0,
          '>': (c) => c > 0,
        };
        return { eval: (v, r) => (test[op](cmp(x.eval(v, r), y.eval(v, r))) ? 1 : 0) };
      }
    }
    return x;
  }

  private parsePlusMinus(): Node {
    let x = this.parseMulDiv();
    for (;;) {
      if (this.eat('+')) {
        const a = x;
        const b = this.parseMulDiv();
        x = { eval: (v, r) => asNumber(a.eval(v, r)) + asNumber(b.eval(v, r)) };
      } else if (this.eat('-') || this.eat('–') || this.eat('—')) {
        const a = x;
        const b = this.parseMulDiv();
        x = { eval: (v, r) => asNumber(a.eval(v, r)) - asNumber(b.eval(v, r)) };
      } else {
        return x;
      }
    }
  }

  private parseMulDiv(): Node {
    let x = this.parseFactor();
    for (;;) {
      const a = x;
      if (this.eat('*') || this.eat('×') || this.eat('•') || this.eat('⋅')) {
        const b = this.parseFactor();
        x = { eval: (v, r) => asNumber(a.eval(v, r)) * asNumber(b.eval(v, r)) };
      } else if (this.eat('/') || this.eat(':') || this.eat('÷')) {
        const b = this.parseFactor();
        x = {
          eval: (v, r) => {
            const d = asNumber(b.eval(v, r));
            if (d === 0) throw new FormulaError('Division durch 0');
            return asNumber(a.eval(v, r)) / d;
          },
        };
      } else if (this.eat('%')) {
        const b = this.parseFactor();
        x = { eval: (v, r) => asNumber(a.eval(v, r)) % asNumber(b.eval(v, r)) };
      } else {
        return x;
      }
    }
  }

  private parseFactor(): Node {
    if (this.eat('+')) return this.parseFactor();
    if (this.eat('-') || this.eat('–') || this.eat('—')) {
      const f = this.parseFactor();
      return { eval: (v, r) => -asNumber(f.eval(v, r)) };
    }
    let x = this.parseConcatBlock();
    if (this.s[this.pos] === '!' && this.s[this.pos + 1] !== '=') {
      this.pos++;
      const a = x;
      x = { eval: (v, r) => fact(asNumber(a.eval(v, r))) };
    }
    this.skipWs();
    if (this.ch === '^') {
      this.pos++;
      const a = x;
      const b = this.parseFactor();
      x = { eval: (v, r) => asNumber(a.eval(v, r)) ** asNumber(b.eval(v, r)) };
    } else if (this.ch === '²' || this.ch === '³') {
      const e = this.ch === '²' ? 2 : 3;
      this.pos++;
      const a = x;
      x = { eval: (v, r) => asNumber(a.eval(v, r)) ** e };
    }
    return x;
  }

  /** Mehrere direkt aufeinanderfolgende Teile werden aneinandergehängt: 5A(B+1) */
  private parseConcatBlock(): Node {
    this.skipWs();
    const nodes: Node[] = [];
    for (;;) {
      const c = this.ch;
      if (c === '[' && this.s[this.pos + 1] === ':') {
        nodes.push(this.parseRange());
      } else if (c === '(' || c === '[') {
        const close = c === '(' ? ')' : ']';
        this.pos++;
        const inner = this.parseExpression();
        this.skipWs();
        if (this.ch !== close) throw new FormulaError(`„${close}“ fehlt`);
        this.pos++;
        nodes.push(inner);
      } else if (c === "'" || c === '"') {
        nodes.push(this.parseString(c));
      } else if (c === '$') {
        nodes.push(this.parseExplicitVar());
      } else if (c && LETTERS.test(c)) {
        nodes.push(this.parseAlpha());
      } else if (c && DIGITS.test(c)) {
        nodes.push(this.parseNumber());
      } else {
        break;
      }
    }
    if (nodes.length === 0) {
      throw new FormulaError(this.ch ? `Unerwartetes Zeichen „${this.ch}“ an Stelle ${this.pos + 1}` : 'Formel unvollständig');
    }
    if (nodes.length === 1) return nodes[0];
    return { eval: (v, r) => concat(nodes.map((n) => n.eval(v, r))) };
  }

  private parseNumber(): Node {
    const start = this.pos;
    while (DIGITS.test(this.ch)) this.pos++;
    if ((this.ch === '.' || this.ch === ',') && DIGITS.test(this.s[this.pos + 1] ?? '')) {
      this.pos++;
      while (DIGITS.test(this.ch)) this.pos++;
    }
    // Als Text behalten, damit führende Nullen beim Aneinanderhängen erhalten bleiben ("0A")
    const raw = this.s.slice(start, this.pos).replace(',', '.');
    return { eval: () => raw };
  }

  private parseString(quote: string): Node {
    this.pos++;
    const start = this.pos;
    while (this.pos < this.s.length && this.ch !== quote) this.pos++;
    if (this.ch !== quote) throw new FormulaError('Text nicht abgeschlossen (Anführungszeichen fehlt)');
    const text = this.s.slice(start, this.pos);
    this.pos++;
    return { eval: () => text };
  }

  private varNode(name: string): Node {
    this.neededVars.add(name);
    return {
      eval: (v) => {
        const val = v(name);
        if (val === undefined) throw new MissingVariablesError([name]);
        return val;
      },
    };
  }

  private parseExplicitVar(): Node {
    this.pos++; // $
    const braces = this.ch === '{';
    if (braces) this.pos++;
    const start = this.pos;
    if (!LETTERS.test(this.ch)) throw new FormulaError('Nach $ muss ein Variablenname folgen');
    while (/[A-Za-z0-9]/.test(this.ch)) this.pos++;
    const name = this.s.slice(start, this.pos);
    if (braces) {
      if (this.s[this.pos] !== '}') throw new FormulaError('„}“ fehlt');
      this.pos++;
    }
    return this.varNode(name);
  }

  /** Buchstabenblock: Funktionsname mit "(" oder einzelne Buchstaben-Variablen */
  private parseAlpha(): Node {
    const start = this.pos;
    let end = start;
    while (/[A-Za-z0-9]/.test(this.s[end] ?? '')) end++;
    const word = this.s.slice(start, end);
    const fn = FUNCTIONS[word.toLowerCase()];
    if (fn && this.s[end] === '(') {
      this.pos = end + 1;
      const args: Node[] = [];
      this.skipWs();
      if (this.ch === ')') {
        this.pos++;
      } else {
        do {
          args.push(this.parseExpression());
        } while (this.eat(';'));
        if (!this.eat(')')) throw new FormulaError(`${word}: „;“ oder „)“ erwartet`);
      }
      return {
        eval: (v, r) => {
          const vals = args.map((a) => a.eval(v, r));
          return fn(vals, { vars: v });
        },
      };
    }
    // Nur die führenden Buchstaben sind Variablen, je ein Buchstabe = eine Variable
    let letters = start;
    while (LETTERS.test(this.s[letters] ?? '')) letters++;
    const names = this.s.slice(start, letters).split('');
    this.pos = letters;
    const nodes = names.map((n) => this.varNode(n));
    if (nodes.length === 1) return nodes[0];
    return {
      eval: (v, r) => {
        const missing = names.filter((n) => v(n) === undefined);
        if (missing.length) throw new MissingVariablesError(missing);
        return concat(nodes.map((n) => n.eval(v, r)));
      },
    };
  }

  /** [:1-3] oder [:1,4,7-9] */
  private parseRange(): Node {
    this.pos += 2;
    const start = this.pos;
    while (this.pos < this.s.length && this.ch !== ']') this.pos++;
    if (this.ch !== ']') throw new FormulaError('„]“ fehlt beim Bereich');
    const spec = this.s.slice(start, this.pos);
    this.pos++;
    const values: number[] = [];
    for (const part of spec.split(',')) {
      const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) throw new FormulaError(`Ungültiger Bereich „${spec}“`);
      const a = Number(m[1]);
      const b = m[2] !== undefined ? Number(m[2]) : a;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) values.push(i);
    }
    if (values.length === 0) throw new FormulaError('Leerer Bereich');
    const divisor = this.rangeCount;
    this.rangeCount *= values.length;
    if (this.rangeCount > 10000) throw new FormulaError('Zu viele Kombinationen');
    return { eval: (_v, r) => values[Math.floor(r / divisor) % values.length] };
  }
}

export interface CompiledFormula {
  /** Variablen, die die Formel direkt benutzt */
  neededVars: string[];
  /** Anzahl Ergebnisse (> 1 bei Bereichen) */
  combinations: number;
  evaluate(vars: VarLookup, rangeIdx?: number): Value;
}

export function compile(expression: string): CompiledFormula {
  if (!expression.trim()) throw new FormulaError('Leere Formel');
  const p = new Parser(expression);
  const node = p.parse();
  return {
    neededVars: [...p.neededVars].sort(),
    combinations: p.rangeCount,
    evaluate: (vars, rangeIdx = 0) => node.eval(vars, rangeIdx),
  };
}

/** Kurzform: Formel direkt ausrechnen */
export function evaluate(expression: string, vars: Record<string, Value> = {}): Value {
  return compile(expression).evaluate((n) => vars[n]);
}

/* ---------- Variablen, die selbst Formeln sind ---------- */

/**
 * Löst Variablen auf, deren Werte wieder Formeln sein dürfen (z. B. C = A+B).
 * Zirkelbezüge werden erkannt. Bereiche in Variablen werden nicht unterstützt
 * (nur in Koordinaten), es zählt dort die erste Kombination.
 */
export function resolveVariables(defs: Record<string, string>): {
  lookup: VarLookup;
  results: Record<string, { value?: Value; error?: string }>;
} {
  const cache = new Map<string, Value | FormulaError>();
  const visiting = new Set<string>();

  const lookup: VarLookup = (name) => {
    const raw = defs[name];
    if (raw === undefined || raw.trim() === '') return undefined;
    const hit = cache.get(name);
    if (hit !== undefined) {
      if (hit instanceof FormulaError) throw hit;
      return hit;
    }
    if (visiting.has(name)) throw new FormulaError(`Zirkelbezug bei ${name}`);
    visiting.add(name);
    try {
      const v = compile(raw).evaluate(lookup);
      cache.set(name, v);
      return v;
    } catch (e) {
      const err = e instanceof FormulaError ? e : new FormulaError(String(e));
      cache.set(name, err);
      throw err;
    } finally {
      visiting.delete(name);
    }
  };

  const results: Record<string, { value?: Value; error?: string }> = {};
  for (const name of Object.keys(defs)) {
    if (!defs[name].trim()) {
      results[name] = {};
      continue;
    }
    try {
      results[name] = { value: lookup(name) };
    } catch (e) {
      results[name] = { error: (e as Error).message };
    }
  }
  return { lookup, results };
}

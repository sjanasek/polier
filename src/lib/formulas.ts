// ---------------------------------------------------------------------------
// Aufmaßformeln – Katalog angelehnt an REB-VB 23.003 (Allgemeine Formeln),
// wie sie in der Abrechnung nach VOB/C (Abrechnungsregeln der ATV) üblich sind.
// Nummern, Parameter und Formeln sind hier zentral gepflegt und können
// bei Bedarf an die betriebliche Formelsammlung angepasst werden.
// ---------------------------------------------------------------------------

export interface Formel {
  nr: string;
  name: string;
  /** Darstellung der Formel */
  text: string;
  /** Parameternamen in Reihenfolge */
  params: string[];
  /** Dimension des Ergebnisses: 1 = Länge, 2 = Fläche, 3 = Volumen, 0 = Stück/Wert */
  dim: 0 | 1 | 2 | 3;
  fn: (v: number[]) => number;
}

const PI = Math.PI;
const p = (v: number[], i: number) => (Number.isFinite(v[i]) ? v[i] : 0);

export const FORMELN: Formel[] = [
  { nr: '01', name: 'Rechteck', text: 'a · b', params: ['a Länge', 'b Breite'], dim: 2, fn: v => p(v, 0) * p(v, 1) },
  { nr: '02', name: 'Quader', text: 'a · b · c', params: ['a Länge', 'b Breite', 'c Höhe'], dim: 3, fn: v => p(v, 0) * p(v, 1) * p(v, 2) },
  { nr: '03', name: 'Dreieck', text: 'a · h / 2', params: ['a Grundseite', 'h Höhe'], dim: 2, fn: v => (p(v, 0) * p(v, 1)) / 2 },
  { nr: '04', name: 'Dreiecksprisma', text: 'a · h / 2 · l', params: ['a Grundseite', 'h Höhe', 'l Länge'], dim: 3, fn: v => (p(v, 0) * p(v, 1) * p(v, 2)) / 2 },
  { nr: '05', name: 'Trapez', text: '(a + b) / 2 · h', params: ['a Seite 1', 'b Seite 2', 'h Höhe'], dim: 2, fn: v => ((p(v, 0) + p(v, 1)) / 2) * p(v, 2) },
  { nr: '06', name: 'Trapezprisma (Graben)', text: '(a + b) / 2 · h · l', params: ['a Breite unten', 'b Breite oben', 'h Tiefe', 'l Länge'], dim: 3, fn: v => ((p(v, 0) + p(v, 1)) / 2) * p(v, 2) * p(v, 3) },
  { nr: '07', name: 'Kreis (Durchmesser)', text: 'π · d² / 4', params: ['d Durchmesser'], dim: 2, fn: v => (PI * p(v, 0) ** 2) / 4 },
  { nr: '08', name: 'Zylinder', text: 'π · d² / 4 · h', params: ['d Durchmesser', 'h Höhe'], dim: 3, fn: v => (PI * p(v, 0) ** 2 * p(v, 1)) / 4 },
  { nr: '09', name: 'Kreisring', text: 'π / 4 · (D² − d²)', params: ['D Außen-Ø', 'd Innen-Ø'], dim: 2, fn: v => (PI / 4) * (p(v, 0) ** 2 - p(v, 1) ** 2) },
  { nr: '10', name: 'Kreisringzylinder (Rohr)', text: 'π / 4 · (D² − d²) · l', params: ['D Außen-Ø', 'd Innen-Ø', 'l Länge'], dim: 3, fn: v => (PI / 4) * (p(v, 0) ** 2 - p(v, 1) ** 2) * p(v, 2) },
  { nr: '11', name: 'Kreisausschnitt', text: 'π · r² · α / 360', params: ['r Radius', 'α Winkel °'], dim: 2, fn: v => (PI * p(v, 0) ** 2 * p(v, 1)) / 360 },
  { nr: '12', name: 'Kreisbogen (Länge)', text: 'π · d · α / 360', params: ['d Durchmesser', 'α Winkel °'], dim: 1, fn: v => (PI * p(v, 0) * p(v, 1)) / 360 },
  { nr: '13', name: 'Ellipse', text: 'π · a · b / 4', params: ['a Achse 1', 'b Achse 2'], dim: 2, fn: v => (PI * p(v, 0) * p(v, 1)) / 4 },
  { nr: '14', name: 'Kugel', text: 'π · d³ / 6', params: ['d Durchmesser'], dim: 3, fn: v => (PI * p(v, 0) ** 3) / 6 },
  { nr: '15', name: 'Pyramide', text: 'a · b · h / 3', params: ['a Länge', 'b Breite', 'h Höhe'], dim: 3, fn: v => (p(v, 0) * p(v, 1) * p(v, 2)) / 3 },
  { nr: '16', name: 'Pyramidenstumpf', text: 'h / 3 · (A1 + √(A1·A2) + A2)', params: ['A1 Fläche unten', 'A2 Fläche oben', 'h Höhe'], dim: 3, fn: v => (p(v, 2) / 3) * (p(v, 0) + Math.sqrt(p(v, 0) * p(v, 1)) + p(v, 1)) },
  { nr: '17', name: 'Kegel', text: 'π · d² / 4 · h / 3', params: ['d Durchmesser', 'h Höhe'], dim: 3, fn: v => (PI * p(v, 0) ** 2 * p(v, 1)) / 12 },
  { nr: '18', name: 'Kegelstumpf', text: 'π · h / 12 · (D² + D·d + d²)', params: ['D Ø unten', 'd Ø oben', 'h Höhe'], dim: 3, fn: v => (PI * p(v, 2) / 12) * (p(v, 0) ** 2 + p(v, 0) * p(v, 1) + p(v, 1) ** 2) },
  { nr: '19', name: 'Prismatoid (Simpson)', text: 'l / 6 · (A1 + 4·Am + A2)', params: ['A1 Fläche Anfang', 'Am Fläche Mitte', 'A2 Fläche Ende', 'l Länge'], dim: 3, fn: v => (p(v, 3) / 6) * (p(v, 0) + 4 * p(v, 1) + p(v, 2)) },
  { nr: '20', name: 'Mittelwert zweier Querschnitte (Gauß-Elling)', text: '(A1 + A2) / 2 · l', params: ['A1 Fläche Anfang', 'A2 Fläche Ende', 'l Länge'], dim: 3, fn: v => ((p(v, 0) + p(v, 1)) / 2) * p(v, 2) },
  { nr: '21', name: 'Rechteck mit Mittelhöhe', text: 'a · b · (h1 + h2) / 2', params: ['a Länge', 'b Breite', 'h1 Höhe 1', 'h2 Höhe 2'], dim: 3, fn: v => (p(v, 0) * p(v, 1) * (p(v, 2) + p(v, 3))) / 2 },
  { nr: '22', name: 'Rechteck mit 4 Eckhöhen', text: 'a · b · (h1 + h2 + h3 + h4) / 4', params: ['a Länge', 'b Breite', 'h1', 'h2', 'h3', 'h4'], dim: 3, fn: v => (p(v, 0) * p(v, 1) * (p(v, 2) + p(v, 3) + p(v, 4) + p(v, 5))) / 4 },
  { nr: '23', name: 'Dreieck aus 3 Seiten (Heron)', text: '√(s·(s−a)·(s−b)·(s−c))', params: ['a', 'b', 'c'], dim: 2, fn: v => { const s = (p(v, 0) + p(v, 1) + p(v, 2)) / 2; const r = s * (s - p(v, 0)) * (s - p(v, 1)) * (s - p(v, 2)); return r > 0 ? Math.sqrt(r) : 0; } },
  { nr: '24', name: 'Böschungsfläche', text: '√(b² + h²) · l', params: ['b Horizontalbreite', 'h Höhe', 'l Länge'], dim: 2, fn: v => Math.sqrt(p(v, 0) ** 2 + p(v, 1) ** 2) * p(v, 2) },
  { nr: '25', name: 'Graben mit Böschung', text: '(b + n · t) · t · l', params: ['b Sohlbreite', 'n Böschungsneigung 1:n', 't Tiefe', 'l Länge'], dim: 3, fn: v => (p(v, 0) + p(v, 1) * p(v, 2)) * p(v, 2) * p(v, 3) },
  { nr: '26', name: 'Rohrgraben nach DIN 4124 (Breite × Tiefe × Länge)', text: 'b · t · l', params: ['b Grabenbreite', 't Grabentiefe', 'l Länge'], dim: 3, fn: v => p(v, 0) * p(v, 1) * p(v, 2) },
  { nr: '30', name: 'Länge', text: 'l', params: ['l Länge'], dim: 1, fn: v => p(v, 0) },
  { nr: '31', name: 'Summe von Längen', text: 'l1 + l2 + l3 + l4', params: ['l1', 'l2', 'l3', 'l4'], dim: 1, fn: v => p(v, 0) + p(v, 1) + p(v, 2) + p(v, 3) },
  { nr: '32', name: 'Fläche minus Abzug', text: 'a · b − c · d', params: ['a', 'b', 'c Abzug', 'd Abzug'], dim: 2, fn: v => p(v, 0) * p(v, 1) - p(v, 2) * p(v, 3) },
  { nr: '40', name: 'Stück / Anzahl', text: 'n', params: ['n Anzahl'], dim: 0, fn: v => p(v, 0) },
  { nr: '41', name: 'Gewicht aus Länge', text: 'l · g (kg/m) / 1000', params: ['l Länge', 'g kg/m'], dim: 0, fn: v => (p(v, 0) * p(v, 1)) / 1000 },
  { nr: '42', name: 'Masse aus Volumen', text: 'V · ρ', params: ['V Volumen', 'ρ Dichte t/m³'], dim: 0, fn: v => p(v, 0) * p(v, 1) },
  { nr: '43', name: 'Fläche aus Masse (Asphalt)', text: 'm / (d · ρ)', params: ['m Masse t', 'd Dicke m', 'ρ Dichte t/m³'], dim: 2, fn: v => { const n = p(v, 1) * p(v, 2); return n ? p(v, 0) / n : 0; } },
  { nr: '90', name: 'Wert (direkt)', text: 'w', params: ['w Wert'], dim: 0, fn: v => p(v, 0) },
  { nr: '91', name: 'Freie Formel', text: 'Ausdruck mit a … h', params: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], dim: 0, fn: () => 0 },
];

export const FREIE_FORMEL_NR = '91';

export function formelByNr(nr: string): Formel {
  return FORMELN.find(f => f.nr === nr) ?? FORMELN[0];
}

export function parameterShortName(label: string): string {
  return label.split(' ')[0];
}

// ---------------------------------------------------------------------------
// Sicherer Ausdrucks-Parser für freie Formeln
// Unterstützt: + - * / ^ ( ) , Zahlen (Komma oder Punkt), Variablen a..h,
// Konstante pi, Funktionen sqrt, abs, sin, cos, tan, round
// ---------------------------------------------------------------------------

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src.replace(/,/g, '.').replace(/·|×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      toks.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j; continue;
    }
    if (/[a-zA-Zπ]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9π]/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    if ('+-*/^()'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`Ungültiges Zeichen "${c}"`);
  }
  return toks;
}

export function evalFormel(src: string, vars: Record<string, number>): number {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expectOp = (o: string) => { const t = next(); if (!t || t.t !== 'op' || t.v !== o) throw new Error(`"${o}" erwartet`); };

  function primary(): number {
    const t = next();
    if (!t) throw new Error('Unerwartetes Ende');
    if (t.t === 'num') return t.v;
    if (t.t === 'op' && t.v === '(') { const v = expr(); expectOp(')'); return v; }
    if (t.t === 'op' && t.v === '-') return -unary();
    if (t.t === 'op' && t.v === '+') return unary();
    if (t.t === 'id') {
      if (t.v === 'pi' || t.v === 'π') return Math.PI;
      const fns: Record<string, (x: number) => number> = { sqrt: Math.sqrt, abs: Math.abs, sin: x => Math.sin((x * Math.PI) / 180), cos: x => Math.cos((x * Math.PI) / 180), tan: x => Math.tan((x * Math.PI) / 180), round: Math.round };
      if (fns[t.v]) { expectOp('('); const v = expr(); expectOp(')'); return fns[t.v](v); }
      if (t.v in vars) return vars[t.v] ?? 0;
      throw new Error(`Unbekannte Variable "${t.v}"`);
    }
    throw new Error('Syntaxfehler');
  }
  function unary(): number { return power(); }
  function power(): number {
    const base = primary();
    const t = peek();
    if (t && t.t === 'op' && t.v === '^') { next(); return base ** power(); }
    return base;
  }
  function term(): number {
    let v = power();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { next(); const r = power(); v = t.v === '*' ? v * r : r === 0 ? 0 : v / r; }
      else return v;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) { next(); const r = term(); v = t.v === '+' ? v + r : v - r; }
      else return v;
    }
  }
  const result = expr();
  if (pos < toks.length) throw new Error('Unerwartetes Zeichen am Ende');
  return Number.isFinite(result) ? result : 0;
}

/** Ergebnis einer Aufmaßzeile (ohne Faktor/Abzug) */
export function formelErgebnis(formelNr: string, werte: number[], freieFormel: string): { wert: number; fehler?: string } {
  if (formelNr === FREIE_FORMEL_NR) {
    const vars: Record<string, number> = {};
    'abcdefgh'.split('').forEach((k, i) => (vars[k] = Number.isFinite(werte[i]) ? werte[i] : 0));
    try {
      return { wert: freieFormel.trim() ? evalFormel(freieFormel, vars) : 0 };
    } catch (e) {
      return { wert: 0, fehler: (e as Error).message };
    }
  }
  return { wert: formelByNr(formelNr).fn(werte) };
}

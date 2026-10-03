// ---------------------------------------------------------------------------
// CSV-Parser für Exporte aus Fremdsystemen: Trennzeichen-Erkennung, Anführungs-
// zeichen nach RFC 4180, Kodierung (UTF-8 / Windows-1252), BOM, deutsche Zahlen
// und Datumsformate. Keine Abhängigkeiten, ohne DOM testbar.
// ---------------------------------------------------------------------------

export type Kodierung = 'auto' | 'utf-8' | 'windows-1252';

export const KODIERUNGEN: Record<Kodierung, string> = {
  auto: 'automatisch erkennen',
  'utf-8': 'UTF-8',
  'windows-1252': 'Windows-1252 (ANSI)',
};

export type Trennzeichen = ';' | ',' | '\t' | '|';

export interface CsvTabelle {
  kopf: string[];
  zeilen: string[][];
  trennzeichen: Trennzeichen;
  /** erkannte bzw. verwendete Kodierung */
  kodierung: 'utf-8' | 'windows-1252' | 'text';
}

/** Entfernt eine Byte-Order-Mark am Anfang */
export const ohneBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * Bytes → Text. Bei "auto" wird zuerst strikt UTF-8 versucht; schlägt das fehl
 * (ungültige Bytefolgen, typisch für Umlaute in Windows-1252), wird Windows-1252 verwendet.
 */
export function dekodieren(buf: ArrayBuffer, kodierung: Kodierung = 'auto'): { text: string; kodierung: 'utf-8' | 'windows-1252' } {
  const bytes = new Uint8Array(buf);
  if (kodierung === 'windows-1252') return { text: ohneBom(new TextDecoder('windows-1252').decode(bytes)), kodierung: 'windows-1252' };
  if (kodierung === 'utf-8') return { text: ohneBom(new TextDecoder('utf-8').decode(bytes)), kodierung: 'utf-8' };
  try {
    return { text: ohneBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), kodierung: 'utf-8' };
  } catch {
    return { text: ohneBom(new TextDecoder('windows-1252').decode(bytes)), kodierung: 'windows-1252' };
  }
}

/** Trennzeichen aus den ersten Zeilen bestimmen: das Zeichen mit der stabilsten, größten Häufigkeit */
export function erkenneTrennzeichen(text: string): Trennzeichen {
  const zeilen = text.split(/\r?\n/).filter(z => z.trim()).slice(0, 20);
  const kandidaten: Trennzeichen[] = [';', '\t', ',', '|'];
  let best: Trennzeichen = ';', bestScore = -1;
  for (const k of kandidaten) {
    const counts = zeilen.map(z => zaehleAusserhalbAnfuehrung(z, k));
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const konsistent = counts.filter(c => c === first).length;
    const score = konsistent * 1000 + first;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}

function zaehleAusserhalbAnfuehrung(z: string, k: string): number {
  let n = 0, q = false;
  for (const ch of z) {
    if (ch === '"') q = !q;
    else if (!q && ch === k) n++;
  }
  return n;
}

/** Zerlegt CSV-Text in Zeilen und Felder (Anführungszeichen, doppelte Anführungszeichen, Zeilenumbrüche im Feld) */
export function csvZeilen(text: string, trenn: Trennzeichen): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], feld = '', q = false;
  const src = ohneBom(text);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { feld += '"'; i++; }
        else q = false;
      } else feld += ch;
    } else if (ch === '"') {
      q = true;
    } else if (ch === trenn) {
      row.push(feld); feld = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(feld); feld = '';
      rows.push(row); row = [];
    } else feld += ch;
  }
  if (feld !== '' || row.length) { row.push(feld); rows.push(row); }
  // Leerzeilen entfernen
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

/** Text → Tabelle mit Kopfzeile. Trennzeichen optional vorgeben. */
export function parseCsv(text: string, trenn?: Trennzeichen): CsvTabelle {
  const t = ohneBom(text);
  const trennzeichen = trenn ?? erkenneTrennzeichen(t);
  const rows = csvZeilen(t, trennzeichen);
  const kopf = (rows[0] ?? []).map(h => h.trim());
  const zeilen = rows.slice(1).map(r => {
    const out = r.map(f => f.trim());
    while (out.length < kopf.length) out.push('');
    return out;
  });
  return { kopf, zeilen, trennzeichen, kodierung: 'text' };
}

/**
 * Zahl aus Exporttext: "1.234,56", "1234,56", "1234.56", "1,234.56", "-12,5", "12,5-" (nachgestelltes Minus),
 * "(12,50)" (Buchhaltungs-Negativ), Währungs- und Prozentzeichen. Nicht lesbar → null.
 */
export function parseZahl(s: string | undefined | null): number | null {
  if (s == null) return null;
  let t = String(s).replace(/[\s €%]/g, '').replace(/EUR$/i, '');
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.endsWith('-')) { neg = !neg; t = t.slice(0, -1); }
  if (t.startsWith('-')) { neg = !neg; t = t.slice(1); }
  if (t.startsWith('+')) t = t.slice(1);
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // das hintere Zeichen ist der Dezimaltrenner
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // nur Komma: Dezimalkomma, außer mehrere Kommas (Tausender im englischen Format)
    t = (t.match(/,/g) || []).length > 1 ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if ((t.match(/\./g) || []).length > 1) {
    t = t.replace(/\./g, '');
  }
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Datum aus Exporttext → ISO yyyy-mm-dd. Unterstützt dd.mm.yyyy, dd.mm.yy, yyyy-mm-dd, dd/mm/yyyy, yyyymmdd. */
export function parseDatum(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:\s.*)?$/);
  if (m) {
    let j = +m[3];
    if (m[3].length === 2) j += j < 70 ? 2000 : 1900;
    return iso(j, +m[2], +m[1]);
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  return null;
}

function iso(j: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || j < 1900 || j > 2200) return null;
  const dt = new Date(Date.UTC(j, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Tabelle → CSV-Text (Semikolon, Anführungszeichen bei Bedarf, CRLF, Dezimalkomma für Zahlen) */
export function csvErzeugen(kopf: string[], zeilen: (string | number | null | undefined)[][]): string {
  const feld = (v: string | number | null | undefined): string => {
    if (v == null) return '';
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [kopf, ...zeilen].map(r => r.map(feld).join(';')).join('\r\n') + '\r\n';
}

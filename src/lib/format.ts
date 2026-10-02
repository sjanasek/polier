const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const nfFlex = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

export const eur = (v: number) => nf2.format(round2(v)) + ' €';
export const num2 = (v: number) => nf2.format(v);
export const num3 = (v: number) => nf3.format(v);
export const numFlex = (v: number) => nfFlex.format(v);
export const pct = (v: number) => nfFlex.format(v) + ' %';

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export const round3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

/** Zahl aus deutscher Eingabe ("1.234,56" / "1234,56" / "1234.56") */
export function parseDe(s: string): number {
  if (s == null) return 0;
  let t = String(s).trim().replace(/\s/g, '').replace('€', '').replace('%', '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function datumDe(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export const heute = () => new Date().toISOString().slice(0, 10);

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Station in m → "0+125,50" */
export function stationFmt(m: number): string {
  const km = Math.floor(m / 1000);
  const rest = m - km * 1000;
  return `${km}+${rest.toFixed(2).padStart(6, '0').replace('.', ',')}`;
}

/** "0+125,50" oder "125,5" → m */
export function stationParse(s: string): number {
  const t = s.trim();
  if (t.includes('+')) {
    const [km, m] = t.split('+');
    return parseDe(km) * 1000 + parseDe(m);
  }
  return parseDe(t);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

import type { VerlaufPunkt } from '../lib/nachkalkulation';
import { tageZwischen } from '../lib/bauzeit';
import { datumDe, num2 } from '../lib/format';

interface Props {
  punkte: VerlaufPunkt[];
  modus: 'stunden' | 'kosten';
  /** Druckfassung: feste helle Farben */
  print?: boolean;
  hoehe?: number;
}

const W = 720, LEFT = 64, RIGHT = 36, TOP = 14, BOTTOM = 34;

/** Runde Achsenschritte (1, 2, 5 × 10ⁿ) */
function schritt(max: number): number {
  if (max <= 0) return 1;
  const roh = max / 5;
  const p = Math.pow(10, Math.floor(Math.log10(roh)));
  const n = roh / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const kurz = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} T` : String(Math.round(v)));

/** Kumulierter Verlauf Soll / Ist (/ Plan) als Linien-Diagramm im Stil des Balkenplans */
export function SollIstChart({ punkte, modus, print = false, hoehe = 240 }: Props) {
  if (punkte.length === 0) return <div className="empty">Keine Daten für den Zeitverlauf.</div>;
  const c = print
    ? { text: '#000', muted: '#555', grid: '#cfcfcf', soll: '#55ab4d', ist: '#d9622b', plan: '#777', bg: '#fff' }
    : { text: 'var(--text)', muted: 'var(--muted)', grid: 'var(--line)', soll: 'var(--g-500)', ist: 'var(--crit)', plan: 'var(--muted)', bg: 'transparent' };
  const serien: { key: 'soll' | 'ist' | 'plan'; label: string; farbe: string; werte: (number | null)[]; dash?: string }[] = modus === 'stunden'
    ? [
        { key: 'soll', label: 'Soll-Stunden (Leistungsstand)', farbe: c.soll, werte: punkte.map(p => p.sollStunden) },
        { key: 'ist', label: 'Ist-Stunden', farbe: c.ist, werte: punkte.map(p => p.istStunden) },
        { key: 'plan', label: 'Plan laut Bauzeitenplan', farbe: c.plan, werte: punkte.map(p => p.planStunden), dash: '5 4' },
      ]
    : [
        { key: 'soll', label: 'Soll-Kosten (Leistungsstand)', farbe: c.soll, werte: punkte.map(p => p.sollKosten) },
        { key: 'ist', label: 'Ist-Kosten', farbe: c.ist, werte: punkte.map(p => p.istKosten) },
        { key: 'plan', label: 'Leistung (Menge × EP)', farbe: c.plan, werte: punkte.map(p => p.leistung), dash: '5 4' },
      ];
  const sichtbar = serien.filter(s => s.werte.some(v => v != null));
  const max = Math.max(1, ...sichtbar.flatMap(s => s.werte.map(v => v ?? 0)));
  const st = schritt(max);
  const yMax = Math.ceil(max / st) * st;
  const H = hoehe;
  const innenW = W - LEFT - RIGHT, innenH = H - TOP - BOTTOM;
  const d0 = punkte[0].datum;
  const spanne = Math.max(1, tageZwischen(d0, punkte[punkte.length - 1].datum));
  // Ein einzelner Punkt wird am rechten Rand gezeichnet (Linie ab 0 am linken Rand)
  const x = (datum: string) => LEFT + (punkte.length === 1 ? innenW : (tageZwischen(d0, datum) / spanne) * innenW);
  const y = (v: number) => TOP + innenH - (v / yMax) * innenH;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += st) ticks.push(v);
  const pfad = (werte: (number | null)[]) => {
    let d = `M${LEFT} ${y(0)}`;
    punkte.forEach((p, i) => { const v = werte[i]; if (v != null) d += ` L${x(p.datum)} ${y(v)}`; });
    return d;
  };
  const einheit = modus === 'stunden' ? 'h' : '€';
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Zeitverlauf Soll/Ist ${modus}`} style={{ display: 'block', fontFamily: 'inherit', background: c.bg, maxWidth: '100%' }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(t)} y2={y(t)} style={{ stroke: c.grid }} />
            <text x={LEFT - 6} y={y(t) + 3} fontSize={10} textAnchor="end" style={{ fill: c.muted }}>{kurz(t)}</text>
          </g>
        ))}
        <text x={LEFT - 6} y={TOP - 4} fontSize={9} textAnchor="end" style={{ fill: c.muted }}>{einheit}</text>
        {punkte.map(p => (
          <g key={p.datum}>
            <line x1={x(p.datum)} x2={x(p.datum)} y1={TOP} y2={TOP + innenH} style={{ stroke: c.grid, strokeOpacity: 0.6 }} />
            <text x={x(p.datum)} y={H - BOTTOM + 14} fontSize={10} textAnchor={p === punkte[0] ? 'start' : p === punkte[punkte.length - 1] ? 'end' : 'middle'} style={{ fill: c.muted }}>{datumDe(p.datum).slice(3)}</text>
          </g>
        ))}
        {sichtbar.map(s => (
          <g key={s.key}>
            <path d={pfad(s.werte)} style={{ fill: 'none', stroke: s.farbe, strokeWidth: 2, strokeDasharray: s.dash }} />
            {punkte.map((p, i) => s.werte[i] != null && <circle key={p.datum} cx={x(p.datum)} cy={y(s.werte[i]!)} r={3} style={{ fill: s.farbe }}><title>{`${s.label} ${datumDe(p.datum)}: ${num2(s.werte[i]!)} ${einheit}`}</title></circle>)}
          </g>
        ))}
        {sichtbar.map((s, i) => (
          <g key={s.key + 'l'} transform={`translate(${LEFT + i * 220}, ${H - 8})`}>
            <line x1={0} x2={22} y1={0} y2={0} style={{ stroke: s.farbe, strokeWidth: 2, strokeDasharray: s.dash }} />
            <text x={28} y={3} fontSize={10} style={{ fill: c.text }}>{s.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

import { addDaysIso, isoWoche, tageZwischen, wochentag, type VorgangZeile } from '../lib/bauzeit';

interface Props {
  zeilen: VorgangZeile[];
  arbeitstage: number[];
  feiertage: string[];
  /** Pixel je Kalendertag (nur Bildschirm) */
  dayPx?: number;
  labelW?: number;
  /** Druckfassung: feste helle Farben, skaliert auf die Breite */
  print?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const ROW = 24;

export function Gantt({ zeilen, arbeitstage, feiertage, dayPx = 18, labelW = 230, print = false, selectedId, onSelect }: Props) {
  const geplant = zeilen.filter(z => z.start);
  if (geplant.length === 0) return <div className="empty">Keine Vorgänge geplant.</div>;

  const start = geplant.reduce((m, z) => (z.start < m ? z.start : m), geplant[0].start);
  const ende = geplant.reduce((m, z) => (z.ende > m ? z.ende : m), geplant[0].ende);
  const tage = tageZwischen(start, ende) + 3;
  const frei = new Set(feiertage);
  const wd = new Set(arbeitstage.length ? arbeitstage : [1, 2, 3, 4, 5]);
  const showDays = dayPx >= 18;
  const headH = 14 + 14 + (showDays ? 12 : 0);
  const W = labelW + tage * dayPx;
  const H = headH + zeilen.length * ROW + 4;
  const xOf = (d: string) => labelW + tageZwischen(start, d) * dayPx;

  const c = print
    ? { text: '#000', muted: '#555', grid: '#cfcfcf', free: '#ececec', bar: '#55ab4d', crit: '#d9622b', head: '#e9f3e8', dep: '#777' }
    : { text: 'var(--text)', muted: 'var(--muted)', grid: 'var(--line)', free: 'var(--g-100)', bar: 'var(--g-500)', crit: 'var(--crit)', head: 'var(--g-100)', dep: 'var(--muted)' };

  // Monate und Wochen für den Kopf
  const monate: { x: number; w: number; label: string }[] = [];
  const wochen: { x: number; w: number; kw: number }[] = [];
  for (let i = 0; i < tage; i++) {
    const d = addDaysIso(start, i);
    const m = d.slice(0, 7);
    const lastM = monate[monate.length - 1];
    if (lastM && lastM.label === m) lastM.w += dayPx;
    else monate.push({ x: labelW + i * dayPx, w: dayPx, label: m });
    const kw = isoWoche(d);
    const lastW = wochen[wochen.length - 1];
    if (lastW && lastW.kw === kw) lastW.w += dayPx;
    else wochen.push({ x: labelW + i * dayPx, w: dayPx, kw });
  }
  const monatsName = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const rowOf = new Map(zeilen.map((z, i) => [z.vorgang.id, i]));
  const maxChars = Math.floor((labelW - 34) / 6.4);

  return (
    <svg
      width={print ? '100%' : W}
      height={print ? undefined : H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Balkenplan der Bauzeit"
      style={{ display: 'block', fontFamily: 'inherit', maxWidth: print ? '100%' : undefined }}
    >
      {/* Kopf */}
      <rect x={0} y={0} width={W} height={headH} style={{ fill: c.head }} />
      {monate.map(m => (
        <g key={m.label}>
          <line x1={m.x} x2={m.x} y1={0} y2={H} style={{ stroke: c.grid }} />
          <text x={m.x + 3} y={11} fontSize={10} fontWeight={600} style={{ fill: c.text }}>{monatsName(m.label)}</text>
        </g>
      ))}
      {wochen.map(w => (
        <g key={w.x}>
          <line x1={w.x} x2={w.x} y1={14} y2={H} style={{ stroke: c.grid, strokeOpacity: 0.6 }} />
          {w.w >= 26 && <text x={w.x + 3} y={25} fontSize={9} style={{ fill: c.muted }}>KW {w.kw}</text>}
        </g>
      ))}
      {/* Wochenenden/Feiertage und Tageszahlen */}
      {Array.from({ length: tage }, (_, i) => {
        const d = addDaysIso(start, i);
        const arbeit = wd.has(wochentag(d)) && !frei.has(d);
        return (
          <g key={d}>
            {!arbeit && <rect x={labelW + i * dayPx} y={headH} width={dayPx} height={H - headH} style={{ fill: c.free, fillOpacity: 0.7 }} />}
            {showDays && <text x={labelW + i * dayPx + dayPx / 2} y={headH - 2} fontSize={8} textAnchor="middle" style={{ fill: arbeit ? c.muted : c.crit }}>{Number(d.slice(8))}</text>}
          </g>
        );
      })}
      {/* Zeilen */}
      {zeilen.map((z, i) => {
        const y = headH + i * ROW;
        const x1 = xOf(z.start), x2 = xOf(addDaysIso(z.ende, 1));
        const meilenstein = z.dauer === 0;
        const farbe = z.kritisch ? c.crit : c.bar;
        const name = z.vorgang.name.length > maxChars ? z.vorgang.name.slice(0, maxChars - 1) + '…' : z.vorgang.name;
        return (
          <g key={z.vorgang.id} onClick={onSelect ? () => onSelect(z.vorgang.id) : undefined} style={{ cursor: onSelect ? 'pointer' : undefined }}>
            {selectedId === z.vorgang.id && <rect x={0} y={y} width={W} height={ROW} style={{ fill: c.bar, fillOpacity: 0.15 }} />}
            <line x1={0} x2={W} y1={y + ROW} y2={y + ROW} style={{ stroke: c.grid, strokeOpacity: 0.6 }} />
            <text x={4} y={y + 16} fontSize={11} style={{ fill: c.muted }}>{z.nr}</text>
            <text x={26} y={y + 16} fontSize={11} style={{ fill: c.text }}>{name}</text>
            {meilenstein
              ? <path d={`M${x1 + dayPx / 2} ${y + 5} l6 7 l-6 7 l-6 -7 z`} style={{ fill: farbe }} />
              : <rect x={x1 + 1} y={y + 5} width={Math.max(x2 - x1 - 2, 3)} height={ROW - 10} rx={3} style={{ fill: farbe }} />}
            {!meilenstein && x2 - x1 > 34 && (
              <text x={(x1 + x2) / 2} y={y + 16} fontSize={9} textAnchor="middle" style={{ fill: '#fff' }}>{z.dauer} AT</text>
            )}
          </g>
        );
      })}
      {/* Abhängigkeiten */}
      {zeilen.map(z => z.vorgaenger.map(pid => {
        const p = zeilen[rowOf.get(pid) ?? -1];
        if (!p) return null;
        const y1 = headH + rowOf.get(pid)! * ROW + ROW / 2;
        const y2 = headH + rowOf.get(z.vorgang.id)! * ROW + ROW / 2;
        const xa = p.dauer === 0 ? xOf(p.ende) + dayPx / 2 + 6 : xOf(addDaysIso(p.ende, 1));
        const xb = xOf(z.start) + (z.dauer === 0 ? dayPx / 2 - 6 : 1);
        return (
          <g key={`${pid}-${z.vorgang.id}`} style={{ stroke: c.dep, fill: 'none', strokeWidth: 1 }}>
            <path d={`M${xa} ${y1} H${xa + 4} V${y2 - 4} H${xb - 4} V${y2} H${xb - 1}`} />
            <path d={`M${xb - 1} ${y2} l-4 -3 v6 z`} style={{ fill: c.dep, stroke: 'none' }} />
          </g>
        );
      }))}
    </svg>
  );
}

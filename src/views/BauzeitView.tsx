import { useMemo, useState } from 'react';
import { useProjekt } from '../store';
import { Card, KPI, NumberInput, confirmDelete } from '../components/ui';
import { Gantt } from '../components/Gantt';
import { DAUER_MODI, type Bauzeitenplan, type DauerModus, type Vorgang } from '../types';
import { bauzeitVon, bundesFeiertage, neuerVorgang, nichtVerplant, planen, vorgaengeAusLV } from '../lib/bauzeit';
import { datumDe, num2, numFlex } from '../lib/format';

const WOCHENTAGE = [['Mo', 1], ['Di', 2], ['Mi', 3], ['Do', 4], ['Fr', 5], ['Sa', 6], ['So', 0]] as const;

/** Vorgänger als Zeilennummern ("1, 3") eingeben */
function VorgaengerInput({ value, onCommit }: { value: string; onCommit: (nrs: number[]) => void }) {
  const [txt, setTxt] = useState(value);
  const [focus, setFocus] = useState(false);
  return (
    <input
      value={focus ? txt : value}
      placeholder="–"
      style={{ width: 80 }}
      onFocus={() => { setTxt(value); setFocus(true); }}
      onChange={e => setTxt(e.target.value)}
      onBlur={() => { setFocus(false); onCommit(txt.split(/[^\d]+/).filter(Boolean).map(Number)); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function BauzeitView() {
  const { projekt, update } = useProjekt();
  const [sel, setSel] = useState<string | null>(null);
  const [dayPx, setDayPx] = useState(18);
  const [je, setJe] = useState<'titel' | 'position'>('titel');
  const [verketten, setVerketten] = useState(true);
  const [neuerFeiertag, setNeuerFeiertag] = useState('');

  const plan = projekt ? bauzeitVon(projekt) : null;
  const termin = useMemo(() => (projekt && plan ? planen(plan, projekt.lv) : null), [projekt]);
  if (!projekt || !plan || !termin) return null;

  const setPlan = (fn: (b: Bauzeitenplan) => Bauzeitenplan) => update(p => ({ ...p, bauzeit: fn(bauzeitVon(p)) }));
  const setVorgang = (id: string, patch: Partial<Vorgang>) => setPlan(b => ({ ...b, vorgaenge: b.vorgaenge.map(v => (v.id === id ? { ...v, ...patch } : v)) }));
  const loeschen = (v: Vorgang) => {
    if (!confirmDelete(`Vorgang „${v.name}“`)) return;
    setPlan(b => ({ ...b, vorgaenge: b.vorgaenge.filter(x => x.id !== v.id).map(x => ({ ...x, vorgaenger: x.vorgaenger.filter(id => id !== v.id) })) }));
    setSel(null);
  };
  const verschieben = (i: number, dir: -1 | 1) => setPlan(b => {
    const arr = [...b.vorgaenge]; const j = i + dir;
    if (j < 0 || j >= arr.length) return b;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...b, vorgaenge: arr };
  });
  const erzeugen = () => {
    if (plan.vorgaenge.length && !window.confirm('Die vorhandenen Vorgänge werden durch neu aus dem LV erzeugte ersetzt. Fortfahren?')) return;
    setPlan(b => ({ ...b, vorgaenge: vorgaengeAusLV(projekt.lv, je, verketten) }));
    setSel(null);
  };
  const feiertageEintragen = () => {
    const j0 = new Date(plan.start || projekt.datum).getUTCFullYear();
    const neu = [...bundesFeiertage(j0), ...bundesFeiertage(j0 + 1)];
    setPlan(b => ({ ...b, feiertage: Array.from(new Set([...b.feiertage, ...neu])).sort() }));
  };

  const nr2id = (nr: number) => plan.vorgaenge[nr - 1]?.id;
  const selected = plan.vorgaenge.find(v => v.id === sel) ?? null;
  const nv = nichtVerplant(plan, projekt.lv);
  const lvPositionen = projekt.lv.map(t => ({ t, pos: t.positionen.filter(p => p.art !== 'H') })).filter(x => x.pos.length);

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <KPI label="Baubeginn" value={termin.zeilen.length ? datumDe(termin.start) : '–'} />
        <KPI label="Bauende" value={termin.zeilen.length ? datumDe(termin.ende) : '–'} />
        <KPI label="Bauzeit" value={termin.zeilen.length ? `${termin.arbeitstage} AT · ${termin.kalendertage} KT · ca. ${numFlex(Math.round((termin.kalendertage / 7) * 10) / 10)} Wo.` : '–'} big />
        <KPI label="Lohnstunden · max. Besetzung" value={`${num2(termin.lohnstunden)} h · ${termin.spitze} Kräfte`} />
      </div>

      {termin.fehler && <div className="hint" style={{ marginBottom: 14, borderColor: 'var(--danger)' }}>{termin.fehler}</div>}
      {nv.anzahl > 0 && <div className="hint" style={{ marginBottom: 14 }}>{nv.anzahl} Position(en) mit Zeitansätzen ({num2(nv.lohnstunden)} Lohnstunden) sind keinem Vorgang zugeordnet und fehlen daher im Plan.</div>}

      <div className="cols">
        <Card title="Kalender und Standardwerte">
          <div className="grid grid-3">
            <div className="field"><label>Baubeginn</label><input type="date" value={plan.start} onChange={e => setPlan(b => ({ ...b, start: e.target.value }))} /></div>
            <div className="field"><label>Arbeitsstunden je Tag</label><NumberInput value={plan.stundenProTag} onChange={v => setPlan(b => ({ ...b, stundenProTag: v }))} /></div>
            <div className="field"><label>Standardbesetzung (Kräfte)</label><NumberInput value={plan.standardKraefte} decimals={0} onChange={v => setPlan(b => ({ ...b, standardKraefte: v }))} /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="muted">Arbeitstage:</span>
            {WOCHENTAGE.map(([l, n]) => (
              <label key={n} className="check"><input type="checkbox" checked={plan.arbeitstage.includes(n)} onChange={e => setPlan(b => ({ ...b, arbeitstage: e.target.checked ? [...b.arbeitstage, n] : b.arbeitstage.filter(x => x !== n) }))} />{l}</label>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="muted">Feiertage / Ausfalltage:</span>
            <input type="date" value={neuerFeiertag} onChange={e => setNeuerFeiertag(e.target.value)} style={{ width: 160 }} />
            <button className="btn secondary sm" disabled={!neuerFeiertag} onClick={() => { setPlan(b => ({ ...b, feiertage: Array.from(new Set([...b.feiertage, neuerFeiertag])).sort() })); setNeuerFeiertag(''); }}>+ Tag</button>
            <button className="btn secondary sm" onClick={feiertageEintragen} title="Bundesweite gesetzliche Feiertage für Baujahr und Folgejahr eintragen">Gesetzl. Feiertage eintragen</button>
          </div>
          {plan.feiertage.length > 0 && (
            <div className="row" style={{ marginTop: 8, gap: 4 }}>
              {plan.feiertage.map(f => <span key={f} className="badge">{datumDe(f)} <a href="#" onClick={e => { e.preventDefault(); setPlan(b => ({ ...b, feiertage: b.feiertage.filter(x => x !== f) })); }} aria-label="Entfernen">✕</a></span>)}
            </div>
          )}
        </Card>
        <Card title="Vorgänge aus dem Leistungsverzeichnis">
          <p className="muted">Die Dauer wird aus den <b>Zeitansätzen der Kalkulation</b> berechnet: Lohnstunden je Einheit × Menge, geteilt durch Kräfte × Stunden je Tag. Änderungen an Kalkulation oder Mengen wirken sofort auf den Plan.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <select value={je} onChange={e => setJe(e.target.value as 'titel' | 'position')} style={{ width: 180 }}>
              <option value="titel">Ein Vorgang je Titel</option>
              <option value="position">Ein Vorgang je Position</option>
            </select>
            <label className="check"><input type="checkbox" checked={verketten} onChange={e => setVerketten(e.target.checked)} />nacheinander verknüpfen</label>
            <button className="btn" onClick={erzeugen}>Aus LV erzeugen</button>
          </div>
        </Card>
      </div>

      <Card title={`Vorgänge (${plan.vorgaenge.length})`} actions={<button className="btn sm" onClick={() => setPlan(b => ({ ...b, vorgaenge: [...b.vorgaenge, neuerVorgang()] }))}>+ Vorgang</button>}>
        {plan.vorgaenge.length === 0 ? <div className="empty">Noch keine Vorgänge. Oben „Aus LV erzeugen“ wählen oder einen Vorgang anlegen.</div> : (
          <div className="scroll" style={{ maxHeight: 'none' }}>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Nr.</th><th style={{ minWidth: 200 }}>Vorgang</th><th className="num">Lohn-Std</th><th className="num">Geräte-Std</th>
                  <th>Basis</th><th className="num" title="0 = Standardbesetzung">Kräfte</th><th className="num">Dauer AT</th>
                  <th>Vorgänger</th><th className="num" title="Arbeitstage nach dem Vorgänger, negativ = Überlappung">Verzug</th>
                  <th>Beginn</th><th>Ende</th><th className="num">Puffer</th><th></th>
                </tr>
              </thead>
              <tbody>
                {termin.zeilen.map((z, i) => {
                  const v = z.vorgang;
                  return (
                    <tr key={v.id} className={sel === v.id ? 'sel' : ''} onClick={() => setSel(v.id)} style={{ cursor: 'pointer' }}>
                      <td>{z.nr}</td>
                      <td onClick={e => e.stopPropagation()}><input value={v.name} onChange={e => setVorgang(v.id, { name: e.target.value })} /></td>
                      <td className="num">{num2(z.aufwand.lohn)}</td>
                      <td className="num">{num2(z.aufwand.geraete)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select value={v.modus} onChange={e => setVorgang(v.id, { modus: e.target.value as DauerModus })}>
                          {Object.entries(DAUER_MODI).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </td>
                      <td style={{ width: 70 }} onClick={e => e.stopPropagation()}><NumberInput value={v.kraefte} decimals={0} title={`0 = Standard (${plan.standardKraefte})`} onChange={n => setVorgang(v.id, { kraefte: n })} /></td>
                      <td className="num" style={{ width: 80 }} onClick={e => e.stopPropagation()}>
                        {v.modus === 'manuell'
                          ? <NumberInput value={v.dauerManuell} decimals={0} onChange={n => setVorgang(v.id, { dauerManuell: n })} />
                          : <span title={z.ohneAufwand ? 'Keine Zeitansätze gefunden, 1 Tag angesetzt' : undefined}>{z.dauer}{z.ohneAufwand && <span className="badge warn" style={{ marginLeft: 4 }}>!</span>}</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <VorgaengerInput
                          value={v.vorgaenger.map(id => plan.vorgaenge.findIndex(x => x.id === id) + 1).filter(n => n > 0).join(', ')}
                          onCommit={nrs => setVorgang(v.id, { vorgaenger: nrs.map(nr2id).filter((x): x is string => !!x && x !== v.id) })} />
                      </td>
                      <td style={{ width: 70 }} onClick={e => e.stopPropagation()}><NumberInput value={v.verzug} decimals={0} onChange={n => setVorgang(v.id, { verzug: n })} /></td>
                      <td>{termin.fehler ? '' : datumDe(z.start)}</td>
                      <td>{termin.fehler ? '' : datumDe(z.ende)}</td>
                      <td className="num">{termin.fehler ? '' : z.kritisch ? <span className="badge warn">kritisch</span> : z.puffer}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                          <button className="btn ghost sm" onClick={() => verschieben(i, -1)}>↑</button>
                          <button className="btn ghost sm" onClick={() => verschieben(i, 1)}>↓</button>
                          <button className="btn ghost sm" onClick={() => loeschen(v)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          Dauer in Arbeitstagen (AT) = aufgerundet(Stunden ÷ (Kräfte × Stunden je Tag)). Basis „Gerätestunden“ zählt nur Geräteansätze mit Einheit „h“, Fremdleistungen und Materialien haben keine Zeitansätze und fließen nicht ein. Vorgänger als Zeilennummern, z. B. „1, 3“.
        </p>
      </Card>

      {selected && (
        <Card title={`Vorgang ${plan.vorgaenge.indexOf(selected) + 1}: Positionen und Randbedingungen`} actions={<button className="btn ghost sm" onClick={() => setSel(null)}>Schließen</button>}>
          <div className="grid grid-3" style={{ marginBottom: 10 }}>
            <div className="field"><label>Frühester Beginn (optional)</label><input type="date" value={selected.fruehesterStart} onChange={e => setVorgang(selected.id, { fruehesterStart: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Notiz</label><input value={selected.notiz} onChange={e => setVorgang(selected.id, { notiz: e.target.value })} /></div>
          </div>
          <label className="muted">Zugeordnete Positionen (deren Zeitansätze aus der Kalkulation fließen in den Vorgang ein)</label>
          <div className="scroll" style={{ maxHeight: 280 }}>
            <table className="tbl compact">
              <tbody>
                {lvPositionen.map(({ t, pos }) => [
                  <tr key={t.id} className="titel"><td colSpan={4}>{t.oz} {t.bezeichnung}</td></tr>,
                  ...pos.map(p => {
                    const lohn = p.ansaetze.filter(x => x.kostenart === 'lohn').reduce((s, x) => s + x.menge, 0) * p.menge;
                    return (
                      <tr key={p.id}>
                        <td style={{ width: 30 }}><input type="checkbox" checked={selected.positionIds.includes(p.id)} onChange={e => setVorgang(selected.id, { positionIds: e.target.checked ? [...selected.positionIds, p.id] : selected.positionIds.filter(x => x !== p.id) })} /></td>
                        <td>{p.oz}</td><td>{p.kurztext}</td><td className="num">{num2(lohn)} h</td>
                      </tr>
                    );
                  }),
                ])}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Balkenplan" actions={
        <>
          <span className="muted">Maßstab</span>
          <select value={dayPx} onChange={e => setDayPx(Number(e.target.value))} style={{ width: 110 }}>
            <option value={10}>klein</option><option value={18}>mittel</option><option value={30}>groß</option>
          </select>
        </>
      }>
        {termin.fehler ? <div className="empty">Wegen der Abhängigkeitsfehler kann kein Plan gezeichnet werden.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <Gantt zeilen={termin.zeilen} arbeitstage={plan.arbeitstage} feiertage={plan.feiertage} dayPx={dayPx} selectedId={sel} onSelect={setSel} />
          </div>
        )}
        <p className="muted" style={{ marginTop: 8 }}><span style={{ color: 'var(--crit)' }}>■</span> kritischer Weg (kein Puffer) · <span style={{ color: 'var(--g-500)' }}>■</span> mit Puffer · grau hinterlegt: Wochenende und Feiertage</p>
      </Card>
    </div>
  );
}

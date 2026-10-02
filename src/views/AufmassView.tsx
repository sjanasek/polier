import { useMemo, useState } from 'react';
import { useProjekt, useStore } from '../store';
import { Card, NumberInput, KPI, confirmDelete } from '../components/ui';
import type { AufmassZeile } from '../types';
import { FORMELN, FREIE_FORMEL_NR, formelByNr, parameterShortName } from '../lib/formulas';
import { aufmassZeileErgebnis, mengenBisStichtag } from '../lib/calc';
import { heute, num3, numFlex, uid, datumDe } from '../lib/format';
import { stationierungSumme } from '../lib/station';

export function AufmassView() {
  const { projekt, update } = useProjekt();
  const setView = useStore(s => s.setView);
  const [filterPos, setFilterPos] = useState<string>('');
  const [filterBlatt, setFilterBlatt] = useState<string>('');
  if (!projekt) return null;

  const positionen = projekt.lv.flatMap(t => t.positionen.filter(p => p.art !== 'H').map(p => ({ t, p })));
  const posById = new Map(positionen.map(x => [x.p.id, x.p]));
  const mengen = mengenBisStichtag(projekt, null);
  const blaetter = Array.from(new Set(projekt.aufmass.map(z => z.blattNr))).sort();

  const zeilen = projekt.aufmass.filter(z => (!filterPos || z.positionId === filterPos) && (!filterBlatt || z.blattNr === filterBlatt));
  const summe = zeilen.reduce((a, z) => a + aufmassZeileErgebnis(z).wert, 0);

  const upd = (id: string, fn: (z: AufmassZeile) => AufmassZeile) => update(p => ({ ...p, aufmass: p.aufmass.map(z => (z.id === id ? fn(z) : z)) }));
  const add = () => {
    const last = projekt.aufmass[projekt.aufmass.length - 1];
    const z: AufmassZeile = {
      id: uid(), blattNr: filterBlatt || last?.blattNr || 'A-01', datum: last?.datum || heute(),
      positionId: filterPos || last?.positionId || positionen[0]?.p.id || '', formelNr: '01', werte: [], freieFormel: '', faktor: 1, abzug: false, bemerkung: '',
    };
    update(p => ({ ...p, aufmass: [...p.aufmass, z] }));
  };
  const kopieren = (z: AufmassZeile) => update(p => {
    const i = p.aufmass.findIndex(x => x.id === z.id);
    const n = { ...z, id: uid(), werte: [...z.werte] };
    return { ...p, aufmass: [...p.aufmass.slice(0, i + 1), n, ...p.aufmass.slice(i + 1)] };
  });

  // Mengenübersicht je Position
  const uebersicht = useMemo(() => positionen.map(({ t, p }) => {
    const reb = projekt.aufmass.filter(z => z.positionId === p.id).reduce((a, z) => a + aufmassZeileErgebnis(z).wert, 0);
    const stat = projekt.stationierungen.filter(s => s.positionId === p.id).reduce((a, s) => a + stationierungSumme(s), 0);
    return { t, p, reb, stat, gesamt: mengen.get(p.id) ?? 0 };
  }), [projekt]);

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <KPI label="Aufmaßzeilen" value={String(projekt.aufmass.length)} />
        <KPI label="Aufmaßblätter" value={String(blaetter.length)} />
        <KPI label="Stationierungen" value={String(projekt.stationierungen.length)} />
        <KPI label="Positionen mit Aufmaß" value={`${uebersicht.filter(u => u.gesamt !== 0).length} / ${positionen.length}`} />
      </div>
      <Card title="Aufmaßblatt" actions={
        <>
          <select value={filterBlatt} onChange={e => setFilterBlatt(e.target.value)} style={{ width: 140 }}>
            <option value="">Alle Blätter</option>
            {blaetter.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterPos} onChange={e => setFilterPos(e.target.value)} style={{ width: 300 }}>
            <option value="">Alle Positionen</option>
            {positionen.map(({ p }) => <option key={p.id} value={p.id}>{p.oz} {p.kurztext}</option>)}
          </select>
          <button className="btn secondary sm" onClick={() => setView('stationierung')}>Stationierung →</button>
          <button className="btn sm" onClick={add}>+ Zeile</button>
        </>
      }>
        {zeilen.length === 0 && <div className="empty">Keine Aufmaßzeilen. Mit „+ Zeile“ beginnen.</div>}
        {zeilen.length > 0 && (
          <div className="scroll">
            <table className="tbl compact">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Blatt</th><th style={{ width: 150 }}>Datum</th><th style={{ minWidth: 200 }}>Position</th><th style={{ minWidth: 190 }}>Formel (REB)</th>
                  <th style={{ minWidth: 260 }}>Werte</th><th className="num" style={{ width: 70 }}>Faktor</th><th style={{ width: 50 }}>Abzug</th><th className="num" style={{ width: 120 }}>Ergebnis</th><th style={{ minWidth: 140 }}>Bemerkung</th><th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map(z => {
                  const f = formelByNr(z.formelNr);
                  const r = aufmassZeileErgebnis(z);
                  const pos = posById.get(z.positionId);
                  return (
                    <tr key={z.id}>
                      <td><input value={z.blattNr} onChange={e => upd(z.id, x => ({ ...x, blattNr: e.target.value }))} /></td>
                      <td><input type="date" value={z.datum} onChange={e => upd(z.id, x => ({ ...x, datum: e.target.value }))} /></td>
                      <td>
                        <select value={z.positionId} onChange={e => upd(z.id, x => ({ ...x, positionId: e.target.value }))}>
                          <option value="">– Position –</option>
                          {positionen.map(({ p }) => <option key={p.id} value={p.id}>{p.oz} {p.kurztext.slice(0, 40)}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={z.formelNr} onChange={e => upd(z.id, x => ({ ...x, formelNr: e.target.value, werte: x.werte.slice(0, formelByNr(e.target.value).params.length) }))}>
                          {FORMELN.map(fo => <option key={fo.nr} value={fo.nr}>{fo.nr} {fo.name}</option>)}
                        </select>
                        <div className="formel-text">{f.text}</div>
                      </td>
                      <td>
                        {z.formelNr === FREIE_FORMEL_NR && (
                          <input className="formel-text" placeholder="z. B. a * b - c * d / 2" value={z.freieFormel} onChange={e => upd(z.id, x => ({ ...x, freieFormel: e.target.value }))} style={{ marginBottom: 4 }} />
                        )}
                        <div className="row" style={{ gap: 4 }}>
                          {f.params.map((pn, i) => (
                            <div key={i} className="field" style={{ width: 68 }}>
                              <label title={pn}>{parameterShortName(pn)}</label>
                              <NumberInput value={z.werte[i] ?? 0} decimals={3} onChange={v => upd(z.id, x => { const w = [...x.werte]; while (w.length <= i) w.push(0); w[i] = v; return { ...x, werte: w }; })} />
                            </div>
                          ))}
                        </div>
                        {r.fehler && <div className="err">{r.fehler}</div>}
                      </td>
                      <td><NumberInput value={z.faktor} decimals={3} onChange={v => upd(z.id, x => ({ ...x, faktor: v }))} /></td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={z.abzug} onChange={e => upd(z.id, x => ({ ...x, abzug: e.target.checked }))} /></td>
                      <td className="num"><b style={{ color: r.wert < 0 ? 'var(--danger)' : undefined }}>{num3(r.wert)}</b> <small>{pos?.einheit}</small></td>
                      <td><input value={z.bemerkung} onChange={e => upd(z.id, x => ({ ...x, bemerkung: e.target.value }))} /></td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                          <button className="btn ghost sm" title="Zeile kopieren" onClick={() => kopieren(z)}>⧉</button>
                          <button className="btn ghost sm" onClick={() => confirmDelete('Aufmaßzeile') && update(p => ({ ...p, aufmass: p.aufmass.filter(x => x.id !== z.id) }))}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {zeilen.length > 0 && (
          <div className="sticky-sum">
            <span>Zeilen: <b>{zeilen.length}</b></span>
            {filterPos && <span>Summe Position: <b>{num3(summe)} {posById.get(filterPos)?.einheit}</b></span>}
          </div>
        )}
      </Card>

      <Card title="Mengenübersicht je Position (Aufmaß + Stationierung)">
        <table className="tbl compact">
          <thead><tr><th>OZ</th><th>Kurztext</th><th className="num">LV-Menge</th><th className="num">Aufmaß (REB)</th><th className="num">Stationierung</th><th className="num">Gesamt</th><th className="num">Erfüllung</th><th>Status</th></tr></thead>
          <tbody>
            {uebersicht.map(({ t, p, reb, stat, gesamt }) => {
              const q = p.menge ? (gesamt / p.menge) * 100 : 0;
              return (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setFilterPos(p.id)}>
                  <td>{p.oz}</td><td>{p.kurztext} <small className="muted">({t.oz})</small></td>
                  <td className="num">{numFlex(p.menge)} {p.einheit}</td>
                  <td className="num">{reb ? num3(reb) : ''}</td>
                  <td className="num">{stat ? num3(stat) : ''}</td>
                  <td className="num"><b>{num3(gesamt)}</b></td>
                  <td className="num">{p.menge ? numFlex(Math.round(q * 10) / 10) + ' %' : ''}</td>
                  <td>{q > 110 ? <span className="badge warn">Mehrmenge &gt; 10 % (§ 2 Abs. 3 VOB/B)</span> : q >= 100 ? <span className="badge ok">vollständig</span> : gesamt ? <span className="badge">teilweise</span> : <span className="badge grey">offen</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="muted">Letztes Aufmaßdatum: {projekt.aufmass.length ? datumDe([...projekt.aufmass].sort((a, b) => b.datum.localeCompare(a.datum))[0].datum) : '–'}</p>
    </div>
  );
}

import { useState } from 'react';
import { useProjekt } from '../store';
import { Card, NumberInput, KPI, confirmDelete } from '../components/ui';
import { STATIONS_MODI, type Stationierung, type StationsModus, type StationsProfil } from '../types';
import { heute, num3, numFlex, stationFmt, stationParse, uid } from '../lib/format';
import { stationsAbschnitte, stationierungSumme } from '../lib/station';

function StationInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [txt, setTxt] = useState(stationFmt(value));
  const [focus, setFocus] = useState(false);
  const shown = focus ? txt : stationFmt(value);
  return (
    <input className="num" value={shown} style={{ width: 110 }}
      onFocus={e => { setTxt(stationFmt(value)); setFocus(true); e.target.select(); }}
      onChange={e => setTxt(e.target.value)}
      onBlur={() => { setFocus(false); onChange(stationParse(txt)); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

export function StationierungView() {
  const { projekt, update } = useProjekt();
  const [sel, setSel] = useState<string | null>(null);
  if (!projekt) return null;

  const positionen = projekt.lv.flatMap(t => t.positionen.filter(p => p.art !== 'H'));
  const posById = new Map(positionen.map(p => [p.id, p]));
  const s = projekt.stationierungen.find(x => x.id === sel) ?? null;

  const upd = (id: string, fn: (x: Stationierung) => Stationierung) => update(p => ({ ...p, stationierungen: p.stationierungen.map(x => (x.id === id ? fn(x) : x)) }));
  const updProfil = (sid: string, pid: string, fn: (x: StationsProfil) => StationsProfil) => upd(sid, x => ({ ...x, profile: x.profile.map(pr => (pr.id === pid ? fn(pr) : pr)) }));
  const add = () => {
    const n: Stationierung = { id: uid(), blattNr: `S-${String(projekt.stationierungen.length + 1).padStart(2, '0')}`, datum: heute(), positionId: positionen[0]?.id ?? '', bezeichnung: 'Neue Achse', modus: 'volumen', faktor: 1, abzug: false, bemerkung: '', profile: [{ id: uid(), station: 0, wert: 0, wert2: 0, bemerkung: '' }] };
    update(p => ({ ...p, stationierungen: [...p.stationierungen, n] }));
    setSel(n.id);
  };
  const addProfil = (st: Stationierung) => {
    const last = [...st.profile].sort((a, b) => a.station - b.station).pop();
    const n: StationsProfil = { id: uid(), station: (last?.station ?? 0) + 25, wert: last?.wert ?? 0, wert2: last?.wert2 ?? 0, bemerkung: '' };
    upd(st.id, x => ({ ...x, profile: [...x.profile, n] }));
  };

  const einheit = s ? posById.get(s.positionId)?.einheit ?? '' : '';
  const wertLabel = s ? ({ laenge: '', flaeche: 'Breite (m)', volumen: 'Querschnitt (m²)', volumenBT: 'Breite (m)' } as Record<StationsModus, string>)[s.modus] : '';
  const abschnitte = s ? stationsAbschnitte(s) : [];

  return (
    <div className="split-wide" style={{ gridTemplateColumns: '360px 1fr' }}>
      <Card title="Stationierungsaufmaße" actions={<button className="btn sm" onClick={add}>+ Neu</button>}>
        {projekt.stationierungen.length === 0 && <div className="empty">Noch keine Stationierung angelegt.</div>}
        <div className="list">
          {projekt.stationierungen.map(st => {
            const pos = posById.get(st.positionId);
            return (
              <div key={st.id} className={`list-item ${sel === st.id ? 'active' : ''}`} onClick={() => setSel(st.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{st.blattNr} · {st.bezeichnung}</div>
                  <small>{pos ? `${pos.oz} ${pos.kurztext.slice(0, 40)}` : 'keine Position'} · {st.profile.length} Stationen</small>
                </div>
                <b style={{ whiteSpace: 'nowrap' }}>{num3(stationierungSumme(st))} {pos?.einheit}</b>
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>Berechnung abschnittsweise nach dem Mittelwertverfahren (Gauß-Elling): (Q₁ + Q₂) / 2 × Δl. Stationen in km+m, z. B. 0+125,50.</p>
      </Card>

      {s ? (
        <div>
          <Card title={`${s.blattNr} – ${s.bezeichnung}`} actions={
            <button className="btn danger sm" onClick={() => { if (confirmDelete(`Stationierung ${s.blattNr}`)) { update(p => ({ ...p, stationierungen: p.stationierungen.filter(x => x.id !== s.id) })); setSel(null); } }}>Löschen</button>
          }>
            <div className="grid grid-4">
              <div className="field"><label>Blatt-Nr.</label><input value={s.blattNr} onChange={e => upd(s.id, x => ({ ...x, blattNr: e.target.value }))} /></div>
              <div className="field"><label>Datum</label><input type="date" value={s.datum} onChange={e => upd(s.id, x => ({ ...x, datum: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>Bezeichnung (Achse / Abschnitt)</label><input value={s.bezeichnung} onChange={e => upd(s.id, x => ({ ...x, bezeichnung: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>LV-Position</label>
                <select value={s.positionId} onChange={e => upd(s.id, x => ({ ...x, positionId: e.target.value }))}>
                  {positionen.map(p => <option key={p.id} value={p.id}>{p.oz} {p.kurztext} ({p.einheit})</option>)}
                </select>
              </div>
              <div className="field"><label>Berechnungsart</label>
                <select value={s.modus} onChange={e => upd(s.id, x => ({ ...x, modus: e.target.value as StationsModus }))}>
                  {Object.entries(STATIONS_MODI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Faktor / Abzug</label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <NumberInput value={s.faktor} decimals={3} onChange={v => upd(s.id, x => ({ ...x, faktor: v }))} />
                  <label className="check" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={s.abzug} onChange={e => upd(s.id, x => ({ ...x, abzug: e.target.checked }))} />Abzug</label>
                </div>
              </div>
              <div className="field" style={{ gridColumn: 'span 4' }}><label>Bemerkung</label><input value={s.bemerkung} onChange={e => upd(s.id, x => ({ ...x, bemerkung: e.target.value }))} /></div>
            </div>
          </Card>

          <div className="cols">
            <Card title="Stationen / Querprofile" actions={<button className="btn sm" onClick={() => addProfil(s)}>+ Station</button>}>
              <table className="tbl compact">
                <thead>
                  <tr><th>Station</th>{s.modus !== 'laenge' && <th className="num">{wertLabel}</th>}{s.modus === 'volumenBT' && <th className="num">Tiefe (m)</th>}<th>Bemerkung</th><th></th></tr>
                </thead>
                <tbody>
                  {[...s.profile].sort((a, b) => a.station - b.station).map(pr => (
                    <tr key={pr.id}>
                      <td><StationInput value={pr.station} onChange={v => updProfil(s.id, pr.id, x => ({ ...x, station: v }))} /></td>
                      {s.modus !== 'laenge' && <td style={{ width: 110 }}><NumberInput value={pr.wert} decimals={3} onChange={v => updProfil(s.id, pr.id, x => ({ ...x, wert: v }))} /></td>}
                      {s.modus === 'volumenBT' && <td style={{ width: 110 }}><NumberInput value={pr.wert2} decimals={3} onChange={v => updProfil(s.id, pr.id, x => ({ ...x, wert2: v }))} /></td>}
                      <td><input value={pr.bemerkung} onChange={e => updProfil(s.id, pr.id, x => ({ ...x, bemerkung: e.target.value }))} /></td>
                      <td><button className="btn ghost sm" onClick={() => upd(s.id, x => ({ ...x, profile: x.profile.filter(y => y.id !== pr.id) }))}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Abschnittsberechnung">
              <div className="scroll"><table className="tbl compact">
                <thead><tr><th>von</th><th>bis</th><th className="num">Δl (m)</th>{s.modus !== 'laenge' && <><th className="num">Q₁</th><th className="num">Q₂</th></>}<th className="num">Ergebnis</th></tr></thead>
                <tbody>
                  {abschnitte.map((a, i) => (
                    <tr key={i}>
                      <td>{stationFmt(a.von.station)}</td><td>{stationFmt(a.bis.station)}</td><td className="num">{num3(a.laenge)}</td>
                      {s.modus !== 'laenge' && <><td className="num">{num3(a.q1)}</td><td className="num">{num3(a.q2)}</td></>}
                      <td className="num">{num3(a.ergebnis)}</td>
                    </tr>
                  ))}
                  <tr className="sum"><td colSpan={s.modus !== 'laenge' ? 5 : 3}>Summe {s.faktor !== 1 ? `× Faktor ${numFlex(s.faktor)}` : ''} {s.abzug ? '(Abzug)' : ''}</td><td className="num">{num3(stationierungSumme(s))} {einheit}</td></tr>
                </tbody>
              </table></div>
              <div className="grid grid-2" style={{ marginTop: 10 }}>
                <KPI label="Gesamtlänge" value={`${num3(abschnitte.reduce((a, b) => a + b.laenge, 0))} m`} />
                <KPI label={`Ergebnis (${einheit || '–'})`} value={num3(stationierungSumme(s))} />
              </div>
            </Card>
          </div>
        </div>
      ) : <div className="empty">Stationierung links auswählen oder neu anlegen.</div>}
    </div>
  );
}

import { useState } from 'react';
import { useProjekt, useStore } from '../store';
import { Card, NumberInput, KPI, confirmDelete } from '../components/ui';
import type { Rechnung, RechnungsStatus, RechnungsTyp } from '../types';
import { neueRechnung } from '../lib/defaults';
import { addDays, datumDe, eur, heute, num2, num3, numFlex, uid } from '../lib/format';
import { kalkulation, mengenBisStichtag, rechnungBerechnen } from '../lib/calc';

const TYPEN: Record<RechnungsTyp, string> = { abschlag: 'Abschlagsrechnung', teilschluss: 'Teilschlussrechnung', schluss: 'Schlussrechnung' };
const STATUS: Record<RechnungsStatus, string> = { entwurf: 'Entwurf', gestellt: 'Gestellt', bezahlt: 'Bezahlt' };

export function RechnungenView() {
  const { projekt, update } = useProjekt();
  const setDruck = useStore(s => s.setDruck);
  const [sel, setSel] = useState<string | null>(null);
  if (!projekt) return null;

  const erg = kalkulation(projekt);
  const rechnungen = [...projekt.rechnungen].sort((a, b) => a.lfdNr - b.lfdNr);
  const r = rechnungen.find(x => x.id === sel) ?? null;
  const re = r ? rechnungBerechnen(projekt, r, erg) : null;
  const upd = (id: string, fn: (x: Rechnung) => Rechnung) => update(p => ({ ...p, rechnungen: p.rechnungen.map(x => (x.id === id ? fn(x) : x)) }));

  const add = () => {
    const n = neueRechnung(projekt, (rechnungen[rechnungen.length - 1]?.lfdNr ?? 0) + 1);
    update(p => ({ ...p, rechnungen: [...p.rechnungen, n] }));
    setSel(n.id);
  };
  const festschreiben = (x: Rechnung) => {
    const m = mengenBisStichtag(projekt, x.stichtag);
    upd(x.id, y => ({ ...y, status: 'gestellt', snapshot: Array.from(m.entries()).map(([positionId, mengeKum]) => ({ positionId, mengeKum })) }));
  };
  const freigeben = (x: Rechnung) => upd(x.id, y => ({ ...y, status: 'entwurf', snapshot: null }));

  const gesamtGestellt = rechnungen.filter(x => x.status !== 'entwurf').reduce((a, x) => a + rechnungBerechnen(projekt, x, erg).rechnungsbetrag, 0);
  const gesamtBezahlt = rechnungen.reduce((a, x) => a + x.zahlungen.reduce((b, z) => b + z.betrag, 0), 0);
  const letzte = rechnungen[rechnungen.length - 1];
  const leistungGesamt = letzte ? rechnungBerechnen(projekt, letzte, erg).leistungKum : 0;

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <KPI label="Leistungsstand netto (letzte Rechnung)" value={eur(leistungGesamt)} />
        <KPI label="Gestellt (brutto, kumuliert)" value={eur(gesamtGestellt)} />
        <KPI label="Zahlungseingänge" value={eur(gesamtBezahlt)} />
        <KPI label="Offen" value={eur(gesamtGestellt - gesamtBezahlt)} big />
      </div>
      <div className="split-wide" style={{ gridTemplateColumns: '340px 1fr' }}>
        <Card title="Rechnungen" actions={<button className="btn sm" onClick={add}>+ Rechnung</button>}>
          {rechnungen.length === 0 && <div className="empty">Noch keine Rechnung.</div>}
          <div className="list">
            {rechnungen.map(x => {
              const e = rechnungBerechnen(projekt, x, erg);
              return (
                <div key={x.id} className={`list-item ${sel === x.id ? 'active' : ''}`} onClick={() => setSel(x.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{x.lfdNr}. {TYPEN[x.typ]} {x.rechnungsNr}</div>
                    <small>{datumDe(x.datum)} · Stand {datumDe(x.stichtag)} · <span className={`badge ${x.status === 'bezahlt' ? 'ok' : x.status === 'gestellt' ? '' : 'grey'}`}>{STATUS[x.status]}</span></small>
                  </div>
                  <b style={{ whiteSpace: 'nowrap' }}>{eur(e.rechnungsbetrag)}</b>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>Kumulative Abrechnung nach § 16 VOB/B: Jede Rechnung weist den gesamten Leistungsstand aus und zieht die vorherigen Abschlagszahlungen ab.</p>
        </Card>

        {r && re ? (
          <div>
            <Card title={`${r.lfdNr}. ${TYPEN[r.typ]} ${r.rechnungsNr}`} actions={
              <>
                {r.status === 'entwurf'
                  ? <button className="btn secondary sm" onClick={() => festschreiben(r)} title="Mengen zum Stichtag einfrieren">Rechnung stellen (festschreiben)</button>
                  : <button className="btn secondary sm" onClick={() => window.confirm('Festschreibung aufheben? Die Mengen werden wieder live aus dem Aufmaß berechnet.') && freigeben(r)}>Festschreibung aufheben</button>}
                <button className="btn sm" onClick={() => setDruck({ art: 'rechnung', rechnungId: r.id })}>Drucken</button>
                <button className="btn danger sm" onClick={() => { if (confirmDelete(`Rechnung ${r.rechnungsNr}`)) { update(p => ({ ...p, rechnungen: p.rechnungen.filter(x => x.id !== r.id) })); setSel(null); } }}>✕</button>
              </>
            }>
              <div className="grid grid-4">
                <div className="field"><label>Rechnungs-Nr.</label><input value={r.rechnungsNr} disabled={r.status !== 'entwurf'} onChange={e => upd(r.id, x => ({ ...x, rechnungsNr: e.target.value }))} /></div>
                <div className="field"><label>Typ</label>
                  <select value={r.typ} disabled={r.status !== 'entwurf'} onChange={e => upd(r.id, x => ({ ...x, typ: e.target.value as RechnungsTyp }))}>
                    {Object.entries(TYPEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="field"><label>Rechnungsdatum</label><input type="date" value={r.datum} disabled={r.status !== 'entwurf'} onChange={e => upd(r.id, x => ({ ...x, datum: e.target.value }))} /></div>
                <div className="field"><label>Leistungsstand bis (Stichtag)</label><input type="date" value={r.stichtag} disabled={r.status !== 'entwurf'} onChange={e => upd(r.id, x => ({ ...x, stichtag: e.target.value }))} /></div>
                <div className="field"><label>Nachlass %</label><NumberInput value={r.nachlassProzent} disabled={r.status !== 'entwurf'} onChange={v => upd(r.id, x => ({ ...x, nachlassProzent: v }))} /></div>
                <div className="field"><label>Sicherheitseinbehalt %</label><NumberInput value={r.sicherheitseinbehaltProzent} disabled={r.status !== 'entwurf'} onChange={v => upd(r.id, x => ({ ...x, sicherheitseinbehaltProzent: v }))} /></div>
                <div className="field"><label>Skonto % / Tage</label>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <NumberInput value={r.skontoProzent} disabled={r.status !== 'entwurf'} onChange={v => upd(r.id, x => ({ ...x, skontoProzent: v }))} />
                    <NumberInput value={r.skontoTage} decimals={0} disabled={r.status !== 'entwurf'} onChange={v => upd(r.id, x => ({ ...x, skontoTage: v }))} />
                  </div>
                </div>
                <div className="field"><label>Zahlungsziel Tage</label><NumberInput value={r.zahlungszielTage} decimals={0} disabled={r.status !== 'entwurf'} onChange={v => upd(r.id, x => ({ ...x, zahlungszielTage: v }))} /></div>
                <div className="field"><label>Status</label>
                  <select value={r.status} onChange={e => upd(r.id, x => ({ ...x, status: e.target.value as RechnungsStatus }))}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="field"><label>Umsatzsteuer</label>
                  <label className="check"><input type="checkbox" checked={r.reverseCharge} disabled={r.status !== 'entwurf'} onChange={e => upd(r.id, x => ({ ...x, reverseCharge: e.target.checked }))} /> § 13b UStG (Steuerschuld AG)</label>
                </div>
                <div className="field" style={{ gridColumn: 'span 2' }}><label>Bemerkung / Leistungszeitraum</label><input value={r.bemerkung} onChange={e => upd(r.id, x => ({ ...x, bemerkung: e.target.value }))} /></div>
              </div>
              {r.snapshot && <div className="hint" style={{ marginTop: 8 }}>Mengen festgeschrieben ({r.snapshot.length} Positionen). Spätere Aufmaße wirken sich erst in der nächsten Rechnung aus.</div>}
            </Card>

            <div className="cols">
              <Card title="Rechnungssumme (kumulativ)">
                <table className="tbl compact">
                  <tbody>
                    <tr><td>Leistungsstand gesamt netto</td><td className="num">{num2(re.leistungKum)}</td></tr>
                    {re.nachlass !== 0 && <tr><td>− Nachlass {numFlex(r.nachlassProzent)} %</td><td className="num">− {num2(re.nachlass)}</td></tr>}
                    {re.sicherheitseinbehalt !== 0 && <tr><td>− Sicherheitseinbehalt {numFlex(r.sicherheitseinbehaltProzent)} %</td><td className="num">− {num2(re.sicherheitseinbehalt)}</td></tr>}
                    {r.sonstigeAbzuege.map(a => <tr key={a.id}><td>− {a.bezeichnung || 'Abzug'}</td><td className="num">− {num2(a.betrag)}</td></tr>)}
                    <tr className="sum"><td>Netto</td><td className="num">{num2(re.nettoZahlbar)}</td></tr>
                    <tr><td>+ MwSt. {r.reverseCharge ? '(§ 13b UStG, 0 %)' : `${numFlex(projekt.mwstProzent)} %`}</td><td className="num">{num2(re.mwst)}</td></tr>
                    <tr className="sum"><td>Brutto kumuliert</td><td className="num">{num2(re.bruttoKum)}</td></tr>
                    {re.vorherige.map(v => {
                      const ve = rechnungBerechnen(projekt, v, erg);
                      return <tr key={v.id}><td>− {v.lfdNr}. {TYPEN[v.typ]} {v.rechnungsNr} ({datumDe(v.datum)})</td><td className="num">− {num2(ve.rechnungsbetrag)}</td></tr>;
                    })}
                    <tr className="sum"><td><b>Rechnungsbetrag (zu zahlen)</b></td><td className="num"><b>{eur(re.rechnungsbetrag)}</b></td></tr>
                    {r.skontoProzent > 0 && <tr><td className="muted">bei Zahlung bis {datumDe(addDays(r.datum, r.skontoTage))}: {numFlex(r.skontoProzent)} % Skonto = {eur(re.skontoBetrag)} → {eur(re.rechnungsbetrag - re.skontoBetrag)}</td><td></td></tr>}
                    <tr><td className="muted">Fällig am {datumDe(addDays(r.datum, r.zahlungszielTage))}</td><td></td></tr>
                  </tbody>
                </table>
                <h3 style={{ margin: '12px 0 6px' }}>Sonstige Abzüge <button className="btn ghost sm" onClick={() => upd(r.id, x => ({ ...x, sonstigeAbzuege: [...x.sonstigeAbzuege, { id: uid(), bezeichnung: 'Bauwesenversicherung', betrag: 0 }] }))}>+ Abzug</button></h3>
                {r.sonstigeAbzuege.map(a => (
                  <div key={a.id} className="row" style={{ marginBottom: 4 }}>
                    <input value={a.bezeichnung} style={{ flex: 1 }} onChange={e => upd(r.id, x => ({ ...x, sonstigeAbzuege: x.sonstigeAbzuege.map(y => y.id === a.id ? { ...y, bezeichnung: e.target.value } : y) }))} />
                    <div style={{ width: 120 }}><NumberInput value={a.betrag} onChange={v => upd(r.id, x => ({ ...x, sonstigeAbzuege: x.sonstigeAbzuege.map(y => y.id === a.id ? { ...y, betrag: v } : y) }))} /></div>
                    <button className="btn ghost sm" onClick={() => upd(r.id, x => ({ ...x, sonstigeAbzuege: x.sonstigeAbzuege.filter(y => y.id !== a.id) }))}>✕</button>
                  </div>
                ))}
              </Card>
              <Card title="Zahlungseingänge" actions={<button className="btn sm" onClick={() => upd(r.id, x => ({ ...x, zahlungen: [...x.zahlungen, { id: uid(), datum: heute(), betrag: re.offen > 0 ? re.offen : 0, bemerkung: '' }] }))}>+ Zahlung</button>}>
                <table className="tbl compact">
                  <thead><tr><th>Datum</th><th className="num">Betrag</th><th>Bemerkung</th><th></th></tr></thead>
                  <tbody>
                    {r.zahlungen.map(z => (
                      <tr key={z.id}>
                        <td><input type="date" value={z.datum} onChange={e => upd(r.id, x => ({ ...x, zahlungen: x.zahlungen.map(y => y.id === z.id ? { ...y, datum: e.target.value } : y) }))} /></td>
                        <td style={{ width: 120 }}><NumberInput value={z.betrag} onChange={v => upd(r.id, x => ({ ...x, zahlungen: x.zahlungen.map(y => y.id === z.id ? { ...y, betrag: v } : y) }))} /></td>
                        <td><input value={z.bemerkung} onChange={e => upd(r.id, x => ({ ...x, zahlungen: x.zahlungen.map(y => y.id === z.id ? { ...y, bemerkung: e.target.value } : y) }))} /></td>
                        <td><button className="btn ghost sm" onClick={() => upd(r.id, x => ({ ...x, zahlungen: x.zahlungen.filter(y => y.id !== z.id) }))}>✕</button></td>
                      </tr>
                    ))}
                    <tr className="sum"><td>Bezahlt</td><td className="num">{num2(re.zahlungenGesamt)}</td><td colSpan={2}>Offen: <b>{eur(re.offen)}</b> {re.offen !== 0 && re.offen <= re.skontoBetrag + 0.005 && re.zahlungenGesamt > 0 && <span className="badge">Differenz = Skonto</span>}</td></tr>
                  </tbody>
                </table>
              </Card>
            </div>

            <Card title="Leistungsstand je Position">
              <table className="tbl compact">
                <thead><tr><th>OZ</th><th>Kurztext</th><th className="num">LV-Menge</th><th className="num">bisher</th><th className="num">neu</th><th className="num">kumuliert</th><th className="num">EP</th><th className="num">GP kumuliert</th><th className="num">davon neu</th></tr></thead>
                <tbody>
                  {projekt.lv.map(t => {
                    const z = re.zeilen.filter(x => x.titel.id === t.id);
                    if (!z.length) return null;
                    const ts = re.titelSummen.find(x => x.titel.id === t.id)?.summe ?? 0;
                    return [
                      <tr key={t.id} className="titel"><td colSpan={7}>{t.oz} {t.bezeichnung}</td><td className="num">{num2(ts)}</td><td></td></tr>,
                      ...z.map(x => (
                        <tr key={x.position.id}>
                          <td>{x.position.oz}</td><td>{x.position.kurztext}</td>
                          <td className="num">{numFlex(x.position.menge)} {x.position.einheit}</td>
                          <td className="num muted">{num3(x.mengeVorher)}</td>
                          <td className="num">{num3(x.mengeDiff)}</td>
                          <td className="num"><b>{num3(x.mengeKum)}</b></td>
                          <td className="num">{num2(x.ep)}</td>
                          <td className="num">{num2(x.gpKum)}</td>
                          <td className="num muted">{num2(x.gpDiff)}</td>
                        </tr>
                      )),
                    ];
                  })}
                  <tr className="sum"><td colSpan={7}>Leistungsstand netto kumuliert</td><td className="num">{num2(re.leistungKum)}</td><td></td></tr>
                </tbody>
              </table>
            </Card>
          </div>
        ) : <div className="empty">Rechnung links auswählen oder neu anlegen.</div>}
      </div>
    </div>
  );
}

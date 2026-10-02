import { useState } from 'react';
import { useStore, useProjekt } from '../store';
import { Card, NumberInput, KPI, NumField, confirmDelete } from '../components/ui';
import { KOSTENARTEN, KOSTENART_LISTE, type KalkAnsatz, type KalkMethode, type KalkParameter, type Kostenart, type Position } from '../types';
import { eur, num2, numFlex, pct, uid } from '../lib/format';
import { ansatzBetrag, kalkEP, kalkulation, lohnrechnung, lvSummen, zaehltInSumme } from '../lib/calc';

export function KalkulationView() {
  const { projekt, update } = useProjekt();
  const stamm = useStore(s => s.stammdaten);
  const [tab, setTab] = useState<'uebersicht' | 'positionen' | 'lohn' | 'zuschlaege'>('uebersicht');
  const [sel, setSel] = useState<string | null>(null);
  if (!projekt) return null;

  const k = projekt.kalk;
  const erg = kalkulation(projekt);
  const lohn = lohnrechnung(k);
  const summen = lvSummen(projekt, erg);
  const setK = (patch: Partial<KalkParameter>) => update(p => ({ ...p, kalk: { ...p.kalk, ...patch } }));
  const updPos = (pid: string, fn: (x: Position) => Position) => update(p => ({ ...p, lv: p.lv.map(t => ({ ...t, positionen: t.positionen.map(x => (x.id === pid ? fn(x) : x)) })) }));
  const alle = projekt.lv.flatMap(t => t.positionen.map(p => ({ t, p })));
  const selected = alle.find(x => x.p.id === sel);

  const tabs = [
    ['uebersicht', 'Übersicht & Endsumme'],
    ['positionen', 'Positionskalkulation (EKT)'],
    ['lohn', 'Mittellohn'],
    ['zuschlaege', 'Zuschläge & Gemeinkosten'],
  ] as const;

  return (
    <div>
      <div className="tabs">
        {tabs.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === 'uebersicht' && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <KPI label="Einzelkosten der Teilleistungen (EKT)" value={eur(erg.ektGesamt)} />
            <KPI label="Baustellengemeinkosten (BGK)" value={eur(erg.bgk)} />
            <KPI label="AGK + Wagnis & Gewinn" value={eur(erg.agk + erg.wug)} />
            <KPI label="Angebotssumme netto (kalkuliert)" value={eur(erg.angebotssumme)} big />
          </div>
          <div className="cols">
            <Card title="Kalkulationsmethode">
              <div className="field">
                <label>Verfahren</label>
                <select value={k.methode} onChange={e => setK({ methode: e.target.value as KalkMethode })}>
                  <option value="endsumme">Kalkulation über die Angebotsendsumme (Umlageverfahren)</option>
                  <option value="zuschlag">Zuschlagskalkulation (vorbestimmte Zuschläge je Kostenart)</option>
                </select>
              </div>
              {k.methode === 'endsumme' && (
                <>
                  <div className="grid grid-3" style={{ marginTop: 10 }}>
                    <NumField label="AGK" suffix="% der Angebotssumme" value={k.agkProzent} onChange={v => setK({ agkProzent: v })} />
                    <NumField label="Wagnis & Gewinn" suffix="% der Angebotssumme" value={k.wugProzent} onChange={v => setK({ wugProzent: v })} />
                    <NumField label="Angebotsendsumme vorgeben (0 = berechnen)" suffix="€ netto" value={k.zielSumme} onChange={v => setK({ zielSumme: v })} />
                  </div>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Angebotssumme = (EKT + BGK) × 100 / (100 − AGK % − W&amp;G %). Die Umlage (Angebotssumme − EKT) wird gewichtet nach Kostenarten auf die EKT verteilt.
                    Bei vorgegebener Endsumme werden die Zuschlagsätze rückwärts aus der Zielsumme ermittelt.
                  </p>
                  {erg.zielModus && <div className="hint">Zielsumme aktiv: {eur(k.zielSumme)}. Verbleibender Deckungsbeitrag für AGK + W&amp;G: {eur(erg.angebotssumme - erg.herstellkosten)} ({pct(erg.herstellkosten > 0 ? ((erg.angebotssumme - erg.herstellkosten) / erg.angebotssumme) * 100 : 0)} der Angebotssumme).</div>}
                </>
              )}
              {k.methode === 'zuschlag' && <p className="muted" style={{ marginTop: 8 }}>EP = Σ EKT je Kostenart × (1 + BGK % + AGK % + W&amp;G %). Zuschläge unter „Zuschläge &amp; Gemeinkosten“ pflegen.</p>}
            </Card>
            <Card title="Schlussblatt (Kalkulationsschema)">
              <table className="tbl compact">
                <tbody>
                  {KOSTENART_LISTE.map(ka => (
                    <tr key={ka}><td>EKT {KOSTENARTEN[ka]}</td><td className="num">{num2(erg.ektSumme[ka])}</td><td className="num muted">{pct(erg.ektGesamt ? (erg.ektSumme[ka] / erg.ektGesamt) * 100 : 0)}</td></tr>
                  ))}
                  <tr className="sum"><td>Summe EKT</td><td className="num">{num2(erg.ektGesamt)}</td><td></td></tr>
                  <tr><td>+ Baustellengemeinkosten (BGK)</td><td className="num">{num2(erg.bgk)}</td><td></td></tr>
                  <tr className="sum"><td>= Herstellkosten</td><td className="num">{num2(erg.herstellkosten)}</td><td></td></tr>
                  <tr><td>+ Allgemeine Geschäftskosten (AGK)</td><td className="num">{num2(erg.agk)}</td><td className="num muted">{pct(erg.angebotssumme ? (erg.agk / erg.angebotssumme) * 100 : 0)}</td></tr>
                  <tr><td>+ Wagnis &amp; Gewinn</td><td className="num">{num2(erg.wug)}</td><td className="num muted">{pct(erg.angebotssumme ? (erg.wug / erg.angebotssumme) * 100 : 0)}</td></tr>
                  <tr className="sum"><td>= Angebotssumme netto (kalkuliert)</td><td className="num">{num2(erg.angebotssumme)}</td><td></td></tr>
                  <tr><td className="muted">Angebotssumme laut LV (gerundete EP)</td><td className="num muted">{num2(summen.netto)}</td><td className="num muted">{num2(summen.netto - erg.angebotssumme)}</td></tr>
                </tbody>
              </table>
            </Card>
          </div>
          <Card title="Resultierende Zuschlagsätze je Kostenart">
            <table className="tbl compact">
              <thead><tr><th>Kostenart</th><th className="num">EKT</th><th className="num">Umlage / Zuschlag €</th><th className="num">Zuschlagsatz</th>{k.methode === 'endsumme' && <th className="num">Gewichtung Umlage</th>}</tr></thead>
              <tbody>
                {KOSTENART_LISTE.map(ka => (
                  <tr key={ka}>
                    <td>{KOSTENARTEN[ka]}</td>
                    <td className="num">{num2(erg.ektSumme[ka])}</td>
                    <td className="num">{num2(erg.umlageBetraege[ka])}</td>
                    <td className="num"><b>{pct(Math.round(erg.zuschlagsaetze[ka] * 100) / 100)}</b></td>
                    {k.methode === 'endsumme' && <td className="num" style={{ width: 120 }}><NumberInput value={k.umlageGewichte[ka]} onChange={v => setK({ umlageGewichte: { ...k.umlageGewichte, [ka]: v } })} /></td>}
                  </tr>
                ))}
                <tr className="sum"><td>Summe</td><td className="num">{num2(erg.ektGesamt)}</td><td className="num">{num2(erg.umlage)}</td><td className="num">{pct(erg.ektGesamt ? Math.round((erg.umlage / erg.ektGesamt) * 10000) / 100 : 0)}</td>{k.methode === 'endsumme' && <td></td>}</tr>
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === 'positionen' && (
        <div className="split-wide" style={{ gridTemplateColumns: selected ? 'minmax(0, 1fr) 480px' : '1fr' }}>
          <Card title="Einzelkosten je Position">
            <div className="scroll">
              <table className="tbl compact">
                <thead>
                  <tr><th>OZ</th><th>Kurztext</th><th className="num">Menge</th><th></th>
                    {KOSTENART_LISTE.map(ka => <th key={ka} className="num">{KOSTENARTEN[ka].split(' ')[0]}/E</th>)}
                    <th className="num">EKT/E</th><th className="num">Zuschlag</th><th className="num">EP kalk.</th><th className="num">EP LV</th><th className="num">GP</th></tr>
                </thead>
                <tbody>
                  {projekt.lv.map(t => (
                    <PosGroup key={t.id} tid={t.id} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {selected && (
            <Card title={`Ansätze ${selected.p.oz}`} actions={<button className="btn ghost sm" onClick={() => setSel(null)}>Schließen</button>}>
              <p><b>{selected.p.kurztext}</b> <small>je {selected.p.einheit}</small></p>
              <table className="tbl compact">
                <thead><tr><th>Kostenart</th><th>Bezeichnung</th><th className="num">Menge/E</th><th>Einh.</th><th className="num">Preis</th><th className="num">€/E</th><th></th></tr></thead>
                <tbody>
                  {selected.p.ansaetze.map(a => (
                    <tr key={a.id}>
                      <td>
                        <select value={a.kostenart} onChange={e => updAnsatz(selected.p.id, a.id, x => ({ ...x, kostenart: e.target.value as Kostenart }))}>
                          {KOSTENART_LISTE.map(ka => <option key={ka} value={ka}>{KOSTENARTEN[ka]}</option>)}
                        </select>
                      </td>
                      <td><input value={a.bezeichnung} list={a.kostenart === 'geraete' ? 'geraeteliste' : a.kostenart === 'stoffe' ? 'materialliste' : undefined} onChange={e => {
                        const bez = e.target.value;
                        const g = stamm.geraete.find(x => x.bezeichnung === bez);
                        const m = stamm.material.find(x => x.bezeichnung === bez);
                        updAnsatz(selected.p.id, a.id, x => ({ ...x, bezeichnung: bez, preis: g ? g.stundensatz : m ? m.preis : x.preis, einheit: g ? 'h' : m ? m.einheit : x.einheit }));
                      }} /></td>
                      <td style={{ width: 90 }}><NumberInput value={a.menge} decimals={3} onChange={v => updAnsatz(selected.p.id, a.id, x => ({ ...x, menge: v }))} /></td>
                      <td style={{ width: 60 }}><input value={a.einheit} onChange={e => updAnsatz(selected.p.id, a.id, x => ({ ...x, einheit: e.target.value }))} /></td>
                      <td style={{ width: 90 }}><NumberInput value={a.preis} placeholder={a.kostenart === 'lohn' ? num2(erg.kalkLohn) : undefined} title={a.kostenart === 'lohn' ? '0 = Kalkulationslohn' : undefined} onChange={v => updAnsatz(selected.p.id, a.id, x => ({ ...x, preis: v }))} /></td>
                      <td className="num">{num2(ansatzBetrag(a, erg.kalkLohn))}</td>
                      <td><button className="btn ghost sm" onClick={() => updPos(selected.p.id, x => ({ ...x, ansaetze: x.ansaetze.filter(y => y.id !== a.id) }))}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="geraeteliste">{stamm.geraete.map(g => <option key={g.id} value={g.bezeichnung} />)}</datalist>
              <datalist id="materialliste">{stamm.material.map(m => <option key={m.id} value={m.bezeichnung} />)}</datalist>
              <div className="row" style={{ marginTop: 8 }}>
                {KOSTENART_LISTE.map(ka => (
                  <button key={ka} className="btn secondary sm" onClick={() => addAnsatz(selected.p.id, ka)}>+ {KOSTENARTEN[ka].split(' ')[0]}</button>
                ))}
              </div>
              {(() => {
                const r = kalkEP(selected.p, erg);
                return (
                  <table className="tbl compact" style={{ marginTop: 12 }}>
                    <tbody>
                      {KOSTENART_LISTE.filter(ka => r.ekt[ka] > 0).map(ka => (
                        <tr key={ka}><td>{KOSTENARTEN[ka]}</td><td className="num">{num2(r.ekt[ka])}</td><td className="num muted">+ {pct(Math.round(erg.zuschlagsaetze[ka] * 100) / 100)}</td><td className="num">{num2(r.ekt[ka] * (1 + erg.zuschlagsaetze[ka] / 100))}</td></tr>
                      ))}
                      <tr className="sum"><td>EKT je Einheit → EP</td><td className="num">{num2(r.ektSumme)}</td><td className="num muted">+ {num2(r.zuschlag)}</td><td className="num">{num2(r.ep)} €</td></tr>
                    </tbody>
                  </table>
                );
              })()}
              <label className="check" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={selected.p.epAusKalkulation} onChange={e => updPos(selected.p.id, x => ({ ...x, epAusKalkulation: e.target.checked, ep: e.target.checked ? x.ep : kalkEP(x, erg).ep }))} />
                EP aus Kalkulation ins LV übernehmen (sonst manueller EP: {num2(selected.p.ep)} €)
              </label>
            </Card>
          )}
        </div>
      )}

      {tab === 'lohn' && (
        <div className="cols">
          <Card title="Mittellohnberechnung">
            <div className="grid grid-2">
              <NumField label="Grundlohn (gewichteter Mittellohn)" suffix="€/h" value={k.grundlohn} onChange={v => setK({ grundlohn: v })} />
              <NumField label="Zulagen (Erschwernis, Vorarbeiter, Überstunden …)" suffix="%" value={k.zulagenProzent} onChange={v => setK({ zulagenProzent: v })} />
              <NumField label="Lohngebundene Kosten / Sozialkosten" suffix="%" value={k.sozialkostenProzent} onChange={v => setK({ sozialkostenProzent: v })} />
              <NumField label="Lohnnebenkosten (Auslösung, Fahrtkosten …)" suffix="%" value={k.lohnnebenkostenProzent} onChange={v => setK({ lohnnebenkostenProzent: v })} />
            </div>
          </Card>
          <Card title="Kalkulationslohn (Mittellohn ASL)">
            <table className="tbl compact">
              <tbody>
                <tr><td>Grundlohn</td><td className="num">{num2(lohn.grundlohn)} €/h</td></tr>
                <tr><td>+ Zulagen ({numFlex(k.zulagenProzent)} %)</td><td className="num">{num2(lohn.zulagen)} €/h</td></tr>
                <tr className="sum"><td>= Mittellohn A</td><td className="num">{num2(lohn.mittellohnA)} €/h</td></tr>
                <tr><td>+ Sozialkosten ({numFlex(k.sozialkostenProzent)} %)</td><td className="num">{num2(lohn.sozialkosten)} €/h</td></tr>
                <tr><td>+ Lohnnebenkosten ({numFlex(k.lohnnebenkostenProzent)} %)</td><td className="num">{num2(lohn.lohnnebenkosten)} €/h</td></tr>
                <tr className="sum"><td>= Kalkulationslohn</td><td className="num">{num2(lohn.kalkulationslohn)} €/h</td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 8 }}>Der Kalkulationslohn wird für alle Lohnansätze mit Preis 0 verwendet. Gesamte Lohnstunden im Projekt: {numFlex(Math.round((erg.ektSumme.lohn / (lohn.kalkulationslohn || 1)) * 10) / 10)} h.</p>
          </Card>
        </div>
      )}

      {tab === 'zuschlaege' && (
        <div className="cols">
          <Card title="Detaillierte Zuschläge je Kostenart (Zuschlagskalkulation)">
            <table className="tbl compact">
              <thead><tr><th>Kostenart</th><th className="num">BGK %</th><th className="num">AGK %</th><th className="num">W&amp;G %</th><th className="num">Gesamt %</th></tr></thead>
              <tbody>
                {KOSTENART_LISTE.map(ka => {
                  const z = k.zuschlaege[ka];
                  const setZ = (patch: Partial<typeof z>) => setK({ zuschlaege: { ...k.zuschlaege, [ka]: { ...z, ...patch } } });
                  return (
                    <tr key={ka}>
                      <td>{KOSTENARTEN[ka]}</td>
                      <td style={{ width: 90 }}><NumberInput value={z.bgk} onChange={v => setZ({ bgk: v })} /></td>
                      <td style={{ width: 90 }}><NumberInput value={z.agk} onChange={v => setZ({ agk: v })} /></td>
                      <td style={{ width: 90 }}><NumberInput value={z.wug} onChange={v => setZ({ wug: v })} /></td>
                      <td className="num"><b>{pct(z.bgk + z.agk + z.wug)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 8 }}>Wirksam bei Methode „Zuschlagskalkulation“. {k.methode === 'endsumme' && <span className="badge warn">Aktuell inaktiv – Endsummenkalkulation gewählt</span>}</p>
          </Card>
          <Card title="Baustellengemeinkosten (Endsummenkalkulation)" actions={<button className="btn sm" onClick={() => setK({ bgkPosten: [...k.bgkPosten, { id: uid(), bezeichnung: 'Neuer Posten', betrag: 0 }] })}>+ Posten</button>}>
            <table className="tbl compact">
              <thead><tr><th>Bezeichnung</th><th className="num w-m">Betrag €</th><th className="w-s"></th></tr></thead>
              <tbody>
                {k.bgkPosten.map(b => (
                  <tr key={b.id}>
                    <td><input value={b.bezeichnung} onChange={e => setK({ bgkPosten: k.bgkPosten.map(x => x.id === b.id ? { ...x, bezeichnung: e.target.value } : x) })} /></td>
                    <td><NumberInput value={b.betrag} onChange={v => setK({ bgkPosten: k.bgkPosten.map(x => x.id === b.id ? { ...x, betrag: v } : x) })} /></td>
                    <td><button className="btn ghost sm" onClick={() => confirmDelete(b.bezeichnung) && setK({ bgkPosten: k.bgkPosten.filter(x => x.id !== b.id) })}>✕</button></td>
                  </tr>
                ))}
                <tr className="sum"><td>Summe BGK</td><td className="num">{num2(k.bgkPosten.reduce((a, b) => a + b.betrag, 0))}</td><td></td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 8 }}>Wirksam bei Methode „Endsummenkalkulation“. Bei der Zuschlagskalkulation sind die BGK in den Prozentsätzen enthalten.</p>
          </Card>
        </div>
      )}
    </div>
  );

  function updAnsatz(pid: string, aid: string, fn: (a: KalkAnsatz) => KalkAnsatz) {
    updPos(pid, x => ({ ...x, ansaetze: x.ansaetze.map(a => (a.id === aid ? fn(a) : a)) }));
  }
  function addAnsatz(pid: string, ka: Kostenart) {
    const a: KalkAnsatz = { id: uid(), kostenart: ka, bezeichnung: '', menge: ka === 'lohn' ? 0.1 : 1, preis: 0, einheit: ka === 'lohn' || ka === 'geraete' ? 'h' : '' };
    updPos(pid, x => ({ ...x, ansaetze: [...x.ansaetze, a] }));
  }
  function PosGroup({ tid }: { tid: string }) {
    const t = projekt!.lv.find(x => x.id === tid)!;
    return (
      <>
        <tr className="titel"><td colSpan={14}>{t.oz} {t.bezeichnung}</td></tr>
        {t.positionen.filter(p => p.art !== 'H').map(p => {
          const r = kalkEP(p, erg);
          const ep = p.epAusKalkulation ? r.ep : p.ep;
          return (
            <tr key={p.id} className={sel === p.id ? 'sel' : ''} style={{ cursor: 'pointer', color: zaehltInSumme(p) ? undefined : 'var(--muted)' }} onClick={() => setSel(p.id)}>
              <td>{p.oz}</td>
              <td>{p.kurztext}</td>
              <td className="num">{numFlex(p.menge)} {p.einheit}</td>
              <td><span className={`badge ${p.art === 'N' ? '' : 'warn'}`}>{p.art}</span></td>
              {KOSTENART_LISTE.map(ka => <td key={ka} className="num">{r.ekt[ka] ? num2(r.ekt[ka]) : ''}</td>)}
              <td className="num">{num2(r.ektSumme)}</td>
              <td className="num muted">{num2(r.zuschlag)}</td>
              <td className="num"><b>{num2(r.ep)}</b></td>
              <td className="num">{num2(ep)} {p.epAusKalkulation ? <small>∑</small> : <small title="manuell">✎</small>}</td>
              <td className="num">{num2(ep * p.menge)}</td>
            </tr>
          );
        })}
      </>
    );
  }
}

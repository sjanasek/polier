import { Fragment, useRef, useState } from 'react';
import { useStore, useProjekt } from '../store';
import { Card, NumberInput, KPI, confirmDelete } from '../components/ui';
import { POSITIONSARTEN, type Position, type PositionsArt, type Titel } from '../types';
import { neuePosition, neuerTitel } from '../lib/defaults';
import { eur, num2, numFlex } from '../lib/format';
import { effektiverEP, kalkulation, lvSummen, zaehltInSumme } from '../lib/calc';
import { gaebDateiname, gaebExport, gaebImport, gaebZuProjekt, type GaebPhase } from '../lib/gaeb';

function naechsteOZ(titel: Titel): string {
  const nums = titel.positionen.map(p => parseInt(p.oz.split('.').pop() || '0', 10)).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 10;
  return `${titel.oz}.${String(next).padStart(4, '0')}`;
}

export function LVView() {
  const { projekt, update } = useProjekt();
  const einheiten = useStore(s => s.stammdaten.einheiten);
  const firma = useStore(s => s.stammdaten.firma);
  const addProjekt = useStore(s => s.addProjekt);
  const setView = useStore(s => s.setView);
  const [sel, setSel] = useState<string | null>(null);
  const [gaebMeldung, setGaebMeldung] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (!projekt) return null;

  const gaebExportieren = (phase: GaebPhase) => {
    const xml = gaebExport(projekt, firma, kalkulation(projekt), phase);
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = gaebDateiname(projekt, phase);
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const gaebImportieren = async (f: File) => {
    try {
      const imp = gaebImport(await f.text());
      const info = `${imp.lv.length} Titel, ${imp.positionen} Positionen${imp.mitPreisen ? ' mit Preisen' : ''} (GAEB X${imp.phase})`;
      const alsNeu = window.confirm(`${f.name}: ${info}.\n\nOK = als neues Projekt anlegen\nAbbrechen = LV des aktuellen Projekts ersetzen`);
      if (alsNeu) {
        addProjekt(gaebZuProjekt(projekt, imp));
      } else if (window.confirm(`LV von „${projekt.bezeichnung}“ wirklich ersetzen? Vorhandene Positionen (und zugehörige Aufmaße) gehen verloren.`)) {
        update(p => ({ ...p, lv: imp.lv, aufmass: [], stationierungen: [], vorbemerkungen: imp.vorbemerkungen || p.vorbemerkungen }));
      }
      setGaebMeldung(`Importiert: ${info}`);
    } catch (e) {
      setGaebMeldung('Import fehlgeschlagen: ' + (e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const erg = kalkulation(projekt);
  const summen = lvSummen(projekt, erg);

  const updTitel = (id: string, fn: (t: Titel) => Titel) => update(p => ({ ...p, lv: p.lv.map(t => (t.id === id ? fn(t) : t)) }));
  const updPos = (tid: string, pid: string, fn: (x: Position) => Position) => updTitel(tid, t => ({ ...t, positionen: t.positionen.map(x => (x.id === pid ? fn(x) : x)) }));
  const addTitel = () => {
    const oz = String(projekt.lv.length + 1).padStart(2, '0');
    update(p => ({ ...p, lv: [...p.lv, neuerTitel(oz)] }));
  };
  const addPos = (t: Titel) => {
    const np = neuePosition(naechsteOZ(t));
    updTitel(t.id, x => ({ ...x, positionen: [...x.positionen, np] }));
    setSel(np.id);
  };
  const move = (t: Titel, idx: number, dir: -1 | 1) => {
    const arr = [...t.positionen];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    updTitel(t.id, x => ({ ...x, positionen: arr }));
  };
  const moveTitel = (idx: number, dir: -1 | 1) => {
    const arr = [...projekt.lv];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    update(p => ({ ...p, lv: arr }));
  };
  const neuNummerieren = () => update(p => ({
    ...p,
    lv: p.lv.map((t, ti) => {
      const toz = String(ti + 1).padStart(2, '0');
      return { ...t, oz: toz, positionen: t.positionen.map((x, i) => ({ ...x, oz: `${toz}.${String((i + 1) * 10).padStart(4, '0')}` })) };
    }),
  }));

  const selected = projekt.lv.flatMap(t => t.positionen.map(p => ({ t, p }))).find(x => x.p.id === sel);

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <KPI label="Angebotssumme netto" value={eur(summen.netto)} />
        <KPI label={`Nachlass ${numFlex(projekt.nachlassProzent)} %`} value={eur(summen.nachlass)} />
        <KPI label={`MwSt. ${numFlex(projekt.mwstProzent)} %`} value={eur(summen.mwst)} />
        <KPI label="Brutto" value={eur(summen.brutto)} big />
      </div>
      <div className="split-wide" style={{ gridTemplateColumns: selected ? '1fr 380px' : '1fr' }}>
        <Card title="Leistungsverzeichnis" actions={
          <>
            <button className="btn secondary sm" onClick={neuNummerieren}>OZ neu nummerieren</button>
            <button className="btn secondary sm" onClick={() => setView('druck')}>Drucken</button>
            <button className="btn sm" onClick={addTitel}>+ Titel</button>
          </>
        }>
          {projekt.lv.length === 0 && <div className="empty">Noch keine Titel. Mit „+ Titel“ beginnen.</div>}
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>OZ</th>
                  <th style={{ minWidth: 260 }}>Kurztext</th>
                  <th style={{ width: 44 }}>Art</th>
                  <th className="num" style={{ width: 100 }}>Menge</th>
                  <th style={{ width: 56 }}>Einh.</th>
                  <th className="num" style={{ width: 110 }}>EP €</th>
                  <th className="num" style={{ width: 110 }}>GP €</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {projekt.lv.map((t, ti) => (
                  renderTitel(t, ti)
                ))}
                <tr className="sum">
                  <td colSpan={6}>Summe netto (ohne Bedarfs-/Alternativpositionen)</td>
                  <td className="num">{num2(summen.netto)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          {summen.eventual > 0 && <p className="muted" style={{ marginTop: 8 }}>Nachrichtlich: Bedarfspositionen {eur(summen.eventual)}</p>}
          <div className="row" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <b>GAEB DA XML</b>
            <button className="btn secondary sm" onClick={() => gaebExportieren('83')} title="Leistungsverzeichnis ohne Preise (Ausschreibung)">Export X83 (Ausschreibung)</button>
            <button className="btn secondary sm" onClick={() => gaebExportieren('84')} title="Angebot mit Einheits- und Gesamtpreisen">Export X84 (Angebot)</button>
            <button className="btn secondary sm" onClick={() => fileRef.current?.click()}>Import (X81–X86)</button>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && gaebImportieren(e.target.files[0])} />
            {gaebMeldung && <span className={gaebMeldung.startsWith('Import fehl') ? 'err' : 'muted'}>{gaebMeldung}</span>}
          </div>
        </Card>
        {selected && (
          <Card title={`Position ${selected.p.oz}`} actions={<button className="btn ghost sm" onClick={() => setSel(null)}>Schließen</button>}>
            <div className="grid grid-2">
              <div className="field"><label>OZ</label><input value={selected.p.oz} onChange={e => updPos(selected.t.id, selected.p.id, x => ({ ...x, oz: e.target.value }))} /></div>
              <div className="field"><label>Positionsart</label>
                <select value={selected.p.art} onChange={e => updPos(selected.t.id, selected.p.id, x => ({ ...x, art: e.target.value as PositionsArt }))}>
                  {Object.entries(POSITIONSARTEN).map(([k, v]) => <option key={k} value={k}>{k} – {v}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>Kurztext</label><input value={selected.p.kurztext} onChange={e => updPos(selected.t.id, selected.p.id, x => ({ ...x, kurztext: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>Langtext</label><textarea rows={6} value={selected.p.langtext} onChange={e => updPos(selected.t.id, selected.p.id, x => ({ ...x, langtext: e.target.value }))} /></div>
              <div className="field"><label>Menge</label><NumberInput value={selected.p.menge} decimals={3} onChange={v => updPos(selected.t.id, selected.p.id, x => ({ ...x, menge: v }))} /></div>
              <div className="field"><label>Einheit</label>
                <input list="einheiten" value={selected.p.einheit} onChange={e => updPos(selected.t.id, selected.p.id, x => ({ ...x, einheit: e.target.value }))} />
                <datalist id="einheiten">{einheiten.map(e => <option key={e} value={e} />)}</datalist>
              </div>
              <div className="field"><label>Einheitspreis €</label><NumberInput value={effektiverEP(selected.p, erg)} disabled={selected.p.epAusKalkulation} onChange={v => updPos(selected.t.id, selected.p.id, x => ({ ...x, ep: v }))} /></div>
              <div className="field"><label>Preisermittlung</label>
                <label className="check"><input type="checkbox" checked={selected.p.epAusKalkulation} onChange={e => updPos(selected.t.id, selected.p.id, x => ({ ...x, epAusKalkulation: e.target.checked }))} /> EP aus Kalkulation</label>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn secondary sm" onClick={() => setView('kalkulation')}>Kalkulation öffnen</button>
              <span className="spacer" />
              <button className="btn danger sm" onClick={() => { if (confirmDelete(`Position ${selected.p.oz}`)) { updTitel(selected.t.id, t => ({ ...t, positionen: t.positionen.filter(x => x.id !== selected.p.id) })); setSel(null); } }}>Position löschen</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );

  function renderTitel(t: Titel, ti: number) {
    const ts = summen.titel.find(x => x.titel.id === t.id)?.summe ?? 0;
    return (
      <Fragment key={t.id}>
        <tr className="titel">
          <td><input value={t.oz} style={{ width: 60 }} onChange={e => updTitel(t.id, x => ({ ...x, oz: e.target.value }))} /></td>
          <td colSpan={5}><input value={t.bezeichnung} onChange={e => updTitel(t.id, x => ({ ...x, bezeichnung: e.target.value }))} /></td>
          <td className="num">{num2(ts)}</td>
          <td>
            <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
              <button className="btn ghost sm" title="Position hinzufügen" onClick={() => addPos(t)}>+ Pos</button>
              <button className="btn ghost sm" onClick={() => moveTitel(ti, -1)}>↑</button>
              <button className="btn ghost sm" onClick={() => moveTitel(ti, 1)}>↓</button>
              <button className="btn ghost sm" onClick={() => confirmDelete(`Titel ${t.oz} mit allen Positionen`) && update(p => ({ ...p, lv: p.lv.filter(x => x.id !== t.id) }))}>✕</button>
            </div>
          </td>
        </tr>
        {t.positionen.map((p, i) => {
          const ep = effektiverEP(p, erg);
          const gp = p.menge * ep;
          return (
            <tr key={p.id} className={sel === p.id ? 'sel' : ''} onClick={() => setSel(p.id)} style={{ cursor: 'pointer' }}>
              <td>{p.oz}</td>
              <td>
                <input value={p.kurztext} placeholder="Kurztext" onClick={e => e.stopPropagation()} onChange={e => updPos(t.id, p.id, x => ({ ...x, kurztext: e.target.value }))} />
              </td>
              <td><span className={`badge ${p.art === 'N' ? '' : p.art === 'H' ? 'grey' : 'warn'}`} title={POSITIONSARTEN[p.art]}>{p.art}</span></td>
              <td className="num" onClick={e => e.stopPropagation()}>{p.art === 'H' ? '' : <NumberInput value={p.menge} decimals={3} onChange={v => updPos(t.id, p.id, x => ({ ...x, menge: v }))} />}</td>
              <td>{p.einheit}</td>
              <td className="num" onClick={e => e.stopPropagation()}>
                {p.art === 'H' ? '' : p.epAusKalkulation ? <span title="aus Kalkulation">{num2(ep)} <small>∑</small></span> : <NumberInput value={p.ep} onChange={v => updPos(t.id, p.id, x => ({ ...x, ep: v }))} />}
              </td>
              <td className="num" style={{ color: zaehltInSumme(p) ? undefined : 'var(--muted)' }}>{p.art === 'H' ? '' : num2(gp)}</td>
              <td onClick={e => e.stopPropagation()}>
                <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                  <button className="btn ghost sm" onClick={() => move(t, i, -1)}>↑</button>
                  <button className="btn ghost sm" onClick={() => move(t, i, 1)}>↓</button>
                </div>
              </td>
            </tr>
          );
        })}
      </Fragment>
    );
  }
}

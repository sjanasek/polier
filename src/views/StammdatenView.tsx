import { useRef } from 'react';
import { useStore } from '../store';
import { Card, TextField, NumberInput, confirmDelete } from '../components/ui';
import { IMPORT_QUELLEN, KOSTENARTEN, KOSTENART_LISTE, type Firma, type Kostenart, type KontenRegel, type Stammdaten } from '../types';
import { uid } from '../lib/format';
import { felderFuer, neueKontenRegel, standardKontenRegeln } from '../lib/brzImport';

export function StammdatenView() {
  const stammdaten = useStore(s => s.stammdaten);
  const projekte = useStore(s => s.projekte);
  const updateStammdaten = useStore(s => s.updateStammdaten);
  const importAll = useStore(s => s.importAll);
  const fileRef = useRef<HTMLInputElement>(null);

  const setFirma = (patch: Partial<Firma>) => updateStammdaten(s => ({ ...s, firma: { ...s.firma, ...patch } }));
  const set = (fn: (s: Stammdaten) => Stammdaten) => updateStammdaten(fn);

  const exportieren = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportiert: new Date().toISOString(), projekte, stammdaten }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `polier-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importieren = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.projekte) || !data.stammdaten) throw new Error('Ungültiges Format');
      if (window.confirm(`${data.projekte.length} Projekt(e) importieren? Vorhandene Daten werden ersetzt.`)) importAll(data);
    } catch (e) {
      alert('Import fehlgeschlagen: ' + (e as Error).message);
    }
  };

  const f = stammdaten.firma;
  const regeln = stammdaten.kontenRegeln ?? [];
  const profile = stammdaten.importProfile ?? [];
  const setRegel = (id: string, patch: Partial<KontenRegel>) => set(s => ({ ...s, kontenRegeln: (s.kontenRegeln ?? []).map(r => (r.id === id ? { ...r, ...patch } : r)) }));
  const regelnLaden = (rahmen: 'skr03' | 'skr04') => {
    if (regeln.length && !window.confirm(`Vorhandene ${regeln.length} Kontenregeln durch den ${rahmen.toUpperCase()}-Vorschlag ersetzen?`)) return;
    set(s => ({ ...s, kontenRegeln: standardKontenRegeln(rahmen) }));
  };
  const regelVerschieben = (i: number, dir: -1 | 1) => set(s => {
    const arr = [...(s.kontenRegeln ?? [])]; const j = i + dir;
    if (j < 0 || j >= arr.length) return s;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...s, kontenRegeln: arr };
  });
  return (
    <div className="cols">
      <div>
        <Card title="Eigene Firma (Auftragnehmer)">
          <div className="grid grid-2">
            <TextField label="Firma" value={f.name} onChange={v => setFirma({ name: v })} span={2} />
            <TextField label="Inhaber / Geschäftsführer" value={f.inhaber} onChange={v => setFirma({ inhaber: v })} span={2} />
            <TextField label="Straße" value={f.strasse} onChange={v => setFirma({ strasse: v })} span={2} />
            <TextField label="PLZ" value={f.plz} onChange={v => setFirma({ plz: v })} />
            <TextField label="Ort" value={f.ort} onChange={v => setFirma({ ort: v })} />
            <TextField label="Telefon" value={f.telefon} onChange={v => setFirma({ telefon: v })} />
            <TextField label="E-Mail" value={f.email} onChange={v => setFirma({ email: v })} />
            <TextField label="Bank" value={f.bank} onChange={v => setFirma({ bank: v })} span={2} />
            <TextField label="IBAN" value={f.iban} onChange={v => setFirma({ iban: v })} />
            <TextField label="BIC" value={f.bic} onChange={v => setFirma({ bic: v })} />
            <TextField label="USt-IdNr." value={f.ustId} onChange={v => setFirma({ ustId: v })} />
            <TextField label="Steuer-Nr." value={f.steuerNr} onChange={v => setFirma({ steuerNr: v })} />
          </div>
        </Card>
        <Card title="Datensicherung">
          <p className="muted">Alle Daten liegen lokal in diesem Browser. Regelmäßig als JSON-Datei sichern.</p>
          <div className="row">
            <button className="btn" onClick={exportieren}>Sicherung exportieren</button>
            <button className="btn secondary" onClick={() => fileRef.current?.click()}>Sicherung importieren</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && importieren(e.target.files[0])} />
          </div>
        </Card>
      </div>
      <div>
        <Card title="Geräteliste (Stundensätze)" actions={<button className="btn sm" onClick={() => set(s => ({ ...s, geraete: [...s.geraete, { id: uid(), bezeichnung: 'Neues Gerät', stundensatz: 0 }] }))}>+ Gerät</button>}>
          <table className="tbl compact">
            <thead><tr><th>Bezeichnung</th><th className="num w-m">€/h bzw. Satz</th><th className="w-s"></th></tr></thead>
            <tbody>
              {stammdaten.geraete.map(g => (
                <tr key={g.id}>
                  <td><input value={g.bezeichnung} onChange={e => set(s => ({ ...s, geraete: s.geraete.map(x => x.id === g.id ? { ...x, bezeichnung: e.target.value } : x) }))} /></td>
                  <td><NumberInput value={g.stundensatz} onChange={v => set(s => ({ ...s, geraete: s.geraete.map(x => x.id === g.id ? { ...x, stundensatz: v } : x) }))} /></td>
                  <td><button className="btn ghost sm" onClick={() => confirmDelete(g.bezeichnung) && set(s => ({ ...s, geraete: s.geraete.filter(x => x.id !== g.id) }))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Materialpreisliste" actions={<button className="btn sm" onClick={() => set(s => ({ ...s, material: [...s.material, { id: uid(), bezeichnung: 'Neues Material', einheit: 'm³', preis: 0 }] }))}>+ Material</button>}>
          <table className="tbl compact">
            <thead><tr><th>Bezeichnung</th><th className="w-s">Einh.</th><th className="num w-m">Preis</th><th className="w-s"></th></tr></thead>
            <tbody>
              {stammdaten.material.map(m => (
                <tr key={m.id}>
                  <td><input value={m.bezeichnung} onChange={e => set(s => ({ ...s, material: s.material.map(x => x.id === m.id ? { ...x, bezeichnung: e.target.value } : x) }))} /></td>
                  <td><input value={m.einheit} onChange={e => set(s => ({ ...s, material: s.material.map(x => x.id === m.id ? { ...x, einheit: e.target.value } : x) }))} /></td>
                  <td><NumberInput value={m.preis} onChange={v => set(s => ({ ...s, material: s.material.map(x => x.id === m.id ? { ...x, preis: v } : x) }))} /></td>
                  <td><button className="btn ghost sm" onClick={() => confirmDelete(m.bezeichnung) && set(s => ({ ...s, material: s.material.filter(x => x.id !== m.id) }))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Kontenzuordnung für den FiBu-Import (Konto → Kostenart)" actions={
          <>
            <button className="btn secondary sm" onClick={() => regelnLaden('skr03')} title="Vorschlag nach SKR03, ohne Gewähr">SKR03-Vorschlag</button>
            <button className="btn secondary sm" onClick={() => regelnLaden('skr04')} title="Vorschlag nach SKR04, ohne Gewähr">SKR04-Vorschlag</button>
            <button className="btn sm" onClick={() => set(s => ({ ...s, kontenRegeln: [...(s.kontenRegeln ?? []), neueKontenRegel()] }))}>+ Regel</button>
          </>
        }>
          <p className="muted">Regeln werden von oben nach unten geprüft, die erste passende gewinnt. Kontobereich (von/bis) und/oder Textabgleich mit der Kostenart-Spalte des Exports. Nicht zugeordnete Konten landen unter „Sonstiges“. Die Vorschläge nach SKR03/SKR04 sind Richtwerte ohne Gewähr – maßgeblich ist der eigene Kontenplan.</p>
          {regeln.length === 0 && <div className="empty">Keine Regeln. Vorschlag laden oder Regel anlegen.</div>}
          {regeln.length > 0 && (
            <table className="tbl compact">
              <thead><tr><th className="w-s">von Konto</th><th className="w-s">bis Konto</th><th>Kostenart-Text enthält</th><th>Kostenart</th><th title="Gemeinkosten (BGK)">BGK</th><th>Bezeichnung</th><th></th></tr></thead>
              <tbody>
                {regeln.map((r, i) => (
                  <tr key={r.id}>
                    <td><input value={r.vonKonto} onChange={e => setRegel(r.id, { vonKonto: e.target.value })} /></td>
                    <td><input value={r.bisKonto} onChange={e => setRegel(r.id, { bisKonto: e.target.value })} /></td>
                    <td><input value={r.kostenartText} placeholder="optional" onChange={e => setRegel(r.id, { kostenartText: e.target.value })} /></td>
                    <td>
                      <select value={r.kostenart} onChange={e => setRegel(r.id, { kostenart: e.target.value as Kostenart })}>
                        {KOSTENART_LISTE.map(k => <option key={k} value={k}>{KOSTENARTEN[k]}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={r.gemeinkosten} onChange={e => setRegel(r.id, { gemeinkosten: e.target.checked })} /></td>
                    <td><input value={r.bezeichnung} onChange={e => setRegel(r.id, { bezeichnung: e.target.value })} /></td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                        <button className="btn ghost sm" onClick={() => regelVerschieben(i, -1)}>↑</button>
                        <button className="btn ghost sm" onClick={() => regelVerschieben(i, 1)}>↓</button>
                        <button className="btn ghost sm" onClick={() => set(s => ({ ...s, kontenRegeln: (s.kontenRegeln ?? []).filter(x => x.id !== r.id) }))}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Importprofile (Spaltenzuordnung Baulohn / FiBu)">
          <p className="muted">Profile werden im Modul Nachkalkulation → Import angelegt und gespeichert. Hier zur Übersicht und zum Löschen.</p>
          {profile.length === 0 ? <div className="empty">Noch kein Profil gespeichert.</div> : (
            <table className="tbl compact">
              <thead><tr><th>Name</th><th>Quelle</th><th>Zuordnung</th><th className="w-s"></th></tr></thead>
              <tbody>
                {profile.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{IMPORT_QUELLEN[p.quelle]}</td>
                    <td className="muted" style={{ fontSize: 11 }}>{felderFuer(p.quelle).filter(f => p.zuordnung[f.key]).map(f => `${f.label} ← ${p.zuordnung[f.key]}`).join(' · ')}</td>
                    <td><button className="btn ghost sm" onClick={() => confirmDelete(`Profil „${p.name}“`) && set(s => ({ ...s, importProfile: (s.importProfile ?? []).filter(x => x.id !== p.id) }))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

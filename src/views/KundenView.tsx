import { useState } from 'react';
import { useStore } from '../store';
import { Card, TextField, confirmDelete } from '../components/ui';
import { leererKunde, kundenAusProjekten, naechsteKundenNr } from '../lib/kunden';
import { PROJEKT_ARTEN, type Kunde } from '../types';
import { datumDe, eur } from '../lib/format';
import { kalkulation, lvSummen } from '../lib/calc';

export function KundenView() {
  const kunden = useStore(s => s.stammdaten.kunden);
  const projekte = useStore(s => s.projekte);
  const updateStammdaten = useStore(s => s.updateStammdaten);
  const updateKunde = useStore(s => s.updateKunde);
  const updateProjekt = useStore(s => s.updateProjekt);
  const addProjektFuerKunde = useStore(s => s.addProjektFuerKunde);
  const setAktiv = useStore(s => s.setAktiv);
  const setView = useStore(s => s.setView);
  const [sel, setSel] = useState<string | null>(kunden[0]?.id ?? null);
  const [suche, setSuche] = useState('');
  const [meldung, setMeldung] = useState('');

  const k = kunden.find(x => x.id === sel) ?? [...kunden].sort((a, b) => a.name.localeCompare(b.name, 'de'))[0] ?? null;
  const set = (patch: Partial<Kunde>) => k && updateKunde(k.id, x => ({ ...x, ...patch }));
  const q = suche.trim().toLowerCase();
  const gefiltert = kunden
    .filter(x => !q || [x.kundenNr, x.name, x.ort, x.plz, x.ansprechpartner, x.email].some(f => f.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const projekteVon = (id: string) => projekte.filter(p => p.kundeId === id);

  const neu = () => {
    const n = leererKunde(naechsteKundenNr(kunden));
    n.name = 'Neuer Kunde';
    updateStammdaten(s => ({ ...s, kunden: [...s.kunden, n] }));
    setSel(n.id);
    setSuche('');
  };
  const loeschen = () => {
    if (!k) return;
    const anz = projekteVon(k.id).length;
    const hinweis = anz ? `\n\n${anz} Projekt(e) bleiben erhalten, behalten ihre Adresse und verlieren nur die Zuordnung.` : '';
    if (!window.confirm(`Kunde „${k.name}“ wirklich löschen?${hinweis}`)) return;
    projekte.filter(p => p.kundeId === k.id).forEach(p => updateProjekt(p.id, x => ({ ...x, kundeId: null })));
    updateStammdaten(s => ({ ...s, kunden: s.kunden.filter(x => x.id !== k.id) }));
    setSel(null);
  };
  const ausProjekten = () => {
    const { neu: neue, zuordnung } = kundenAusProjekten(projekte, kunden);
    if (zuordnung.size === 0) { setMeldung('Keine Projekte ohne Kundenzuordnung gefunden.'); return; }
    updateStammdaten(s => ({ ...s, kunden: [...s.kunden, ...neue] }));
    zuordnung.forEach((kid, pid) => updateProjekt(pid, x => ({ ...x, kundeId: kid })));
    setMeldung(`${neue.length} neue(r) Kunde(n) angelegt, ${zuordnung.size} Projekt(e) zugeordnet.`);
  };
  const projektOeffnen = (id: string) => { setAktiv(id); setView('projekte'); };
  const neuesProjekt = () => { if (k) { addProjektFuerKunde(k.id); setView('projekte'); } };

  const vp = k ? projekteVon(k.id) : [];

  return (
    <div className="split">
      <Card title={`Adressen (${kunden.length})`} actions={<button className="btn sm" onClick={neu}>+ Neu</button>}>
        <div className="field" style={{ marginBottom: 8 }}>
          <input placeholder="Suchen: Name, Ort, Nummer …" value={suche} onChange={e => setSuche(e.target.value)} />
        </div>
        {gefiltert.length === 0 && <div className="empty">{kunden.length ? 'Keine Treffer.' : 'Noch keine Kunden angelegt.'}</div>}
        <div className="list scroll" style={{ maxHeight: 'calc(100vh - 360px)' }}>
          {gefiltert.map(x => (
            <div key={x.id} className={`list-item ${k?.id === x.id ? 'active' : ''}`} onClick={() => setSel(x.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{x.name || 'ohne Namen'}</div>
                <small>{x.kundenNr} · {[x.plz, x.ort].filter(Boolean).join(' ') || 'keine Adresse'}</small>
              </div>
              <span className="badge">{projekteVon(x.id).length}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn secondary sm" onClick={ausProjekten} title="Legt aus den Auftraggeber-Adressen bestehender Projekte Kunden an">Kunden aus Projekten übernehmen</button>
        </div>
        {meldung && <p className="muted" style={{ marginTop: 6 }}>{meldung}</p>}
      </Card>

      {k ? (
        <div>
          <Card title={`${k.kundenNr} · ${k.name}`} actions={<button className="btn danger sm" onClick={loeschen}>Löschen</button>}>
            <div className="grid grid-4">
              <TextField label="Kundennummer" value={k.kundenNr} onChange={v => set({ kundenNr: v })} />
              <TextField label="Name / Firma" value={k.name} onChange={v => set({ name: v })} span={3} />
              <TextField label="Zusatz / Abteilung" value={k.zusatz} onChange={v => set({ zusatz: v })} span={2} />
              <TextField label="Ansprechpartner" value={k.ansprechpartner} onChange={v => set({ ansprechpartner: v })} span={2} />
              <TextField label="Straße" value={k.strasse} onChange={v => set({ strasse: v })} span={2} />
              <TextField label="PLZ" value={k.plz} onChange={v => set({ plz: v })} />
              <TextField label="Ort" value={k.ort} onChange={v => set({ ort: v })} />
              <TextField label="Telefon" value={k.telefon} onChange={v => set({ telefon: v })} span={2} />
              <TextField label="E-Mail" value={k.email} onChange={v => set({ email: v })} span={2} />
              <TextField label="USt-IdNr." value={k.ustId} onChange={v => set({ ustId: v })} span={2} />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Notiz</label>
              <textarea value={k.notiz} onChange={e => set({ notiz: e.target.value })} />
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Änderungen an der Adresse wirken sich nicht automatisch auf bestehende Projekte und Rechnungen aus. Im Projekt kann die Adresse bei Bedarf übernommen werden.</p>
          </Card>

          <Card title={`Projekte dieses Kunden (${vp.length})`} actions={<button className="btn sm" onClick={neuesProjekt}>+ Neues Projekt</button>}>
            {vp.length === 0 ? <div className="empty">Diesem Kunden sind noch keine Projekte zugeordnet.</div> : (
              <table className="tbl compact">
                <thead><tr><th>Nr.</th><th>Projekt</th><th>Verwendung</th><th>Datum</th><th className="num">Angebots-/Auftragssumme netto</th><th className="num">Rechnungen</th><th></th></tr></thead>
                <tbody>
                  {vp.map(p => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => projektOeffnen(p.id)}>
                      <td>{p.nummer}</td>
                      <td>{p.bezeichnung}</td>
                      <td><span className="badge">{PROJEKT_ARTEN[p.art]}</span></td>
                      <td>{datumDe(p.datum)}</td>
                      <td className="num">{eur(lvSummen(p, kalkulation(p)).netto)}</td>
                      <td className="num">{p.rechnungen.length}</td>
                      <td><button className="btn ghost sm">Öffnen →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : <div className="empty">Kunde links auswählen oder neu anlegen.</div>}
    </div>
  );
}

import { useState } from 'react';
import { useStore, useProjekt } from '../store';
import { Card, TextField, NumField, SelectField, confirmDelete } from '../components/ui';
import { PROJEKT_ARTEN, type Projekt, type ProjektArt } from '../types';
import { datumDe, eur } from '../lib/format';
import { kalkulation, lvSummen } from '../lib/calc';
import { demoKunden, demoProjekt } from '../lib/demo';
import { kundeAdresse, leererKunde, naechsteKundenNr } from '../lib/kunden';

export function ProjekteView() {
  const projekte = useStore(s => s.projekte);
  const aktivId = useStore(s => s.aktivId);
  const setAktiv = useStore(s => s.setAktiv);
  const addProjekt = useStore(s => s.addProjekt);
  const deleteProjekt = useStore(s => s.deleteProjekt);
  const setView = useStore(s => s.setView);
  const kunden = useStore(s => s.stammdaten.kunden);
  const updateStammdaten = useStore(s => s.updateStammdaten);
  const { projekt, update } = useProjekt();
  const [filterKunde, setFilterKunde] = useState('');
  const kundeName = (id?: string | null) => kunden.find(k => k.id === id)?.name;
  const sichtbar = projekte.filter(p => !filterKunde || (filterKunde === '__keiner' ? !p.kundeId : p.kundeId === filterKunde));
  const kunde = kunden.find(k => k.id === projekt?.kundeId) ?? null;
  const kundeWaehlen = (id: string) => {
    const k = kunden.find(x => x.id === id);
    update(p => ({ ...p, kundeId: k ? k.id : null, auftraggeber: k ? kundeAdresse(k) : p.auftraggeber }));
  };
  const alsKundeSpeichern = () => {
    if (!projekt) return;
    const n = { ...leererKunde(naechsteKundenNr(kunden)), ...projekt.auftraggeber };
    updateStammdaten(s => ({ ...s, kunden: [...s.kunden, n] }));
    update(p => ({ ...p, kundeId: n.id }));
  };
  const demoLaden = () => {
    const fehlend = demoKunden().filter(d => !kunden.some(k => k.id === d.id));
    if (fehlend.length) updateStammdaten(s => ({ ...s, kunden: [...s.kunden, ...fehlend] }));
    addProjekt(demoProjekt());
  };

  const set = (patch: Partial<Projekt>) => update(p => ({ ...p, ...patch }));

  return (
    <div className="split">
      <div>
        <Card title="Projekte" actions={<button className="btn sm" onClick={() => { addProjekt(); }}>+ Neu</button>}>
          <div className="field" style={{ marginBottom: 8 }}>
            <select value={filterKunde} onChange={e => setFilterKunde(e.target.value)} aria-label="Nach Kunde filtern">
              <option value="">Alle Kunden</option>
              <option value="__keiner">Ohne Kundenzuordnung</option>
              {kunden.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div className="list">
            {sichtbar.length === 0 && <div className="empty">Keine Projekte.</div>}
            {sichtbar.map(p => {
              const s = lvSummen(p, kalkulation(p));
              return (
                <div key={p.id} className={`list-item ${p.id === aktivId ? 'active' : ''}`} onClick={() => setAktiv(p.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{p.nummer} · {p.bezeichnung}</div>
                    <small>{kundeName(p.kundeId) ?? p.auftraggeber.name ?? 'kein Kunde'} · {PROJEKT_ARTEN[p.art]} · {datumDe(p.datum)} · {eur(s.netto)} netto</small>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn secondary sm" onClick={demoLaden}>Beispielprojekt laden</button>
          </div>
        </Card>
      </div>
      <div>
        {projekt ? (
          <>
            <Card title="Projektdaten" actions={
              <>
                <button className="btn secondary sm" onClick={() => setView('lv')}>Zum LV →</button>
                <button className="btn danger sm" onClick={() => confirmDelete(`Projekt „${projekt.bezeichnung}“`) && deleteProjekt(projekt.id)}>Löschen</button>
              </>
            }>
              <div className="grid grid-4">
                <TextField label="Projekt-Nr." value={projekt.nummer} onChange={v => set({ nummer: v })} />
                <TextField label="Bezeichnung" value={projekt.bezeichnung} onChange={v => set({ bezeichnung: v })} span={2} />
                <SelectField<ProjektArt> label="Verwendung" value={projekt.art} onChange={v => set({ art: v })} options={Object.entries(PROJEKT_ARTEN).map(([value, label]) => ({ value: value as ProjektArt, label }))} />
                <TextField label="Bauvorhaben" value={projekt.bauvorhaben} onChange={v => set({ bauvorhaben: v })} span={2} />
                <TextField label="Bauort" value={projekt.bauort} onChange={v => set({ bauort: v })} />
                <TextField label="Datum" type="date" value={projekt.datum} onChange={v => set({ datum: v })} />
              </div>
            </Card>
            <Card title="Auftraggeber / Ausschreibende Stelle" actions={
              <>
                {kunde && <button className="btn secondary sm" title="Adresse im Projekt mit den aktuellen Daten aus dem Adressbuch überschreiben" onClick={() => kundeWaehlen(kunde.id)}>Adresse aus Adressbuch aktualisieren</button>}
                {!kunde && projekt.auftraggeber.name.trim() && <button className="btn secondary sm" onClick={alsKundeSpeichern}>Als Kunde speichern</button>}
                <button className="btn ghost sm" onClick={() => setView('kunden')}>Adressen verwalten →</button>
              </>
            }>
              <div className="field" style={{ marginBottom: 10, maxWidth: 420 }}>
                <label>Kunde aus Adressbuch</label>
                <select value={projekt.kundeId ?? ''} onChange={e => kundeWaehlen(e.target.value)}>
                  <option value="">– kein Kunde zugeordnet –</option>
                  {kunden.map(k => <option key={k.id} value={k.id}>{k.kundenNr} · {k.name}{k.ort ? `, ${k.ort}` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-4">
                <TextField label="Name" value={projekt.auftraggeber.name} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, name: v } })} span={2} />
                <TextField label="Zusatz / Abteilung" value={projekt.auftraggeber.zusatz} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, zusatz: v } })} span={2} />
                <TextField label="Straße" value={projekt.auftraggeber.strasse} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, strasse: v } })} span={2} />
                <TextField label="PLZ" value={projekt.auftraggeber.plz} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, plz: v } })} />
                <TextField label="Ort" value={projekt.auftraggeber.ort} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, ort: v } })} />
                <TextField label="Telefon" value={projekt.auftraggeber.telefon} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, telefon: v } })} span={2} />
                <TextField label="E-Mail" value={projekt.auftraggeber.email} onChange={v => set({ auftraggeber: { ...projekt.auftraggeber, email: v } })} span={2} />
              </div>
            </Card>
            <Card title="Kaufmännische Bedingungen">
              <div className="grid grid-4">
                <NumField label="MwSt." suffix="%" value={projekt.mwstProzent} onChange={v => set({ mwstProzent: v })} />
                <NumField label="Nachlass" suffix="%" value={projekt.nachlassProzent} onChange={v => set({ nachlassProzent: v })} />
                <NumField label="Skonto" suffix="%" value={projekt.skontoProzent} onChange={v => set({ skontoProzent: v })} />
                <NumField label="Skonto-Frist" suffix="Tage" value={projekt.skontoTage} onChange={v => set({ skontoTage: v })} decimals={0} />
                <NumField label="Sicherheitseinbehalt" suffix="%" value={projekt.sicherheitseinbehaltProzent} onChange={v => set({ sicherheitseinbehaltProzent: v })} />
                <NumField label="Zahlungsziel" suffix="Tage" value={projekt.zahlungszielTage} onChange={v => set({ zahlungszielTage: v })} decimals={0} />
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label>Vorbemerkungen (erscheinen auf LV / Angebot)</label>
                <textarea value={projekt.vorbemerkungen} onChange={e => set({ vorbemerkungen: e.target.value })} />
              </div>
            </Card>
          </>
        ) : <div className="empty">Kein Projekt ausgewählt.</div>}
      </div>
    </div>
  );
}

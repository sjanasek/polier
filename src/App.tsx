import { useStore, useProjekt, type View } from './store';
import { ProjekteView } from './views/ProjekteView';
import { LVView } from './views/LVView';
import { KalkulationView } from './views/KalkulationView';
import { AufmassView } from './views/AufmassView';
import { StationierungView } from './views/StationierungView';
import { RechnungenView } from './views/RechnungenView';
import { DruckView } from './views/DruckView';
import { StammdatenView } from './views/StammdatenView';
import { PROJEKT_ARTEN } from './types';

const NAV: { view: View; label: string; ico: string; needsProjekt?: boolean }[] = [
  { view: 'projekte', label: 'Projekte', ico: '▦' },
  { view: 'lv', label: 'Leistungsverzeichnis', ico: '≡', needsProjekt: true },
  { view: 'kalkulation', label: 'Kalkulation', ico: '∑', needsProjekt: true },
  { view: 'aufmass', label: 'Aufmaß', ico: '∠', needsProjekt: true },
  { view: 'stationierung', label: 'Stationierung', ico: '⟷', needsProjekt: true },
  { view: 'rechnungen', label: 'Rechnungen', ico: '€', needsProjekt: true },
  { view: 'druck', label: 'Drucken / Ausgabe', ico: '▤', needsProjekt: true },
];

const TITEL: Record<View, string> = {
  projekte: 'Projekte',
  lv: 'Leistungsverzeichnis',
  kalkulation: 'Baukalkulation',
  aufmass: 'Aufmaß nach VOB/C (REB-Formeln)',
  stationierung: 'Stationierungsaufmaß (Tiefbau)',
  rechnungen: 'Rechnungen – kumulative Abrechnung',
  druck: 'Drucken / Ausgabe',
  stammdaten: 'Stammdaten & Einstellungen',
};

export default function App() {
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const { projekt } = useProjekt();

  const renderBody = () => {
    if (view === 'projekte') return <ProjekteView />;
    if (view === 'stammdaten') return <StammdatenView />;
    if (!projekt) return <div className="empty">Bitte zuerst ein Projekt anlegen oder auswählen.</div>;
    switch (view) {
      case 'lv': return <LVView />;
      case 'kalkulation': return <KalkulationView />;
      case 'aufmass': return <AufmassView />;
      case 'stationierung': return <StationierungView />;
      case 'rechnungen': return <RechnungenView />;
      case 'druck': return <DruckView />;
    }
    return null;
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">P</div>
          <div>
            <div className="title">Polier</div>
            <div className="sub">Bauabrechnung &amp; Kalkulation</div>
          </div>
        </div>
        {NAV.map(n => (
          <button key={n.view} className={`nav-btn ${view === n.view ? 'active' : ''}`} disabled={n.needsProjekt && !projekt} onClick={() => setView(n.view)}>
            <span className="ico">{n.ico}</span>{n.label}
          </button>
        ))}
        <div className="nav-sep" />
        <button className={`nav-btn ${view === 'stammdaten' ? 'active' : ''}`} onClick={() => setView('stammdaten')}>
          <span className="ico">⚙</span>Stammdaten
        </button>
        <div className="projekt-chip">
          {projekt ? (
            <>
              <span className="muted">Aktives Projekt</span>
              <b>{projekt.nummer} · {projekt.bezeichnung}</b>
              <span className="badge">{PROJEKT_ARTEN[projekt.art]}</span>
            </>
          ) : <span className="muted">Kein Projekt gewählt</span>}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>{TITEL[view]}</h1>
          {projekt && <span className="muted">{projekt.bauvorhaben || projekt.bezeichnung}</span>}
        </div>
        <div className="content">
          {renderBody()}
        </div>
      </main>
    </div>
  );
}

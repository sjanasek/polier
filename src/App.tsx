import { useEffect, useState } from 'react';
import { useStore, useProjekt, type View } from './store';
import { applyTheme, loadTheme, saveTheme, type ThemeMode } from './lib/theme';
import { ProjekteView } from './views/ProjekteView';
import { KundenView } from './views/KundenView';
import { LVView } from './views/LVView';
import { KalkulationView } from './views/KalkulationView';
import { BauzeitView } from './views/BauzeitView';
import { AufmassView } from './views/AufmassView';
import { StationierungView } from './views/StationierungView';
import { RechnungenView } from './views/RechnungenView';
import { NachkalkView } from './views/NachkalkView';
import { DruckView } from './views/DruckView';
import { StammdatenView } from './views/StammdatenView';
import { PROJEKT_ARTEN } from './types';
import { OfflineMarke, UpdateHinweis } from './components/PwaBausteine';

const NAV: { view: View; label: string; ico: string; needsProjekt?: boolean }[] = [
  { view: 'projekte', label: 'Projekte', ico: '▦' },
  { view: 'kunden', label: 'Adressen / Kunden', ico: '☎' },
  { view: 'lv', label: 'Leistungsverzeichnis', ico: '≡', needsProjekt: true },
  { view: 'kalkulation', label: 'Kalkulation', ico: '∑', needsProjekt: true },
  { view: 'bauzeit', label: 'Bauzeitenplan', ico: '▬', needsProjekt: true },
  { view: 'aufmass', label: 'Aufmaß', ico: '∠', needsProjekt: true },
  { view: 'stationierung', label: 'Stationierung', ico: '⟷', needsProjekt: true },
  { view: 'rechnungen', label: 'Rechnungen', ico: '€', needsProjekt: true },
  { view: 'nachkalk', label: 'Nachkalkulation', ico: '⇄', needsProjekt: true },
  { view: 'druck', label: 'Drucken / Ausgabe', ico: '▤', needsProjekt: true },
];

const TITEL: Record<View, string> = {
  projekte: 'Projekte',
  kunden: 'Adressverwaltung',
  lv: 'Leistungsverzeichnis',
  kalkulation: 'Baukalkulation',
  bauzeit: 'Bauzeitenplan',
  aufmass: 'Aufmaß nach VOB/C (REB-Formeln)',
  stationierung: 'Stationierungsaufmaß (Tiefbau)',
  rechnungen: 'Rechnungen – kumulative Abrechnung',
  nachkalk: 'Nachkalkulation – Soll-Ist-Vergleich',
  druck: 'Drucken / Ausgabe',
  stammdaten: 'Stammdaten & Einstellungen',
};

export default function App() {
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const { projekt } = useProjekt();
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => applyTheme('auto');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme]);
  const wechsleTheme = (m: ThemeMode) => { setTheme(m); saveTheme(m); };

  // Seitenleiste einklappbar (Icon-Leiste), Zustand wird im Browser gemerkt
  const [eingeklappt, setEingeklappt] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('polier-sidebar');
      if (v === '1' || v === '0') return v === '1';
    } catch { /* Speicher nicht verfügbar */ }
    return typeof window !== 'undefined' && window.innerWidth < 900;
  });
  const toggleSidebar = () => setEingeklappt(e => {
    try { localStorage.setItem('polier-sidebar', e ? '0' : '1'); } catch { /* ignorieren */ }
    return !e;
  });
  const naechstesTheme = () => wechsleTheme(theme === 'hell' ? 'dunkel' : theme === 'dunkel' ? 'auto' : 'hell');

  const renderBody = () => {
    if (view === 'projekte') return <ProjekteView />;
    if (view === 'kunden') return <KundenView />;
    if (view === 'stammdaten') return <StammdatenView />;
    if (!projekt) return <div className="empty">Bitte zuerst ein Projekt anlegen oder auswählen.</div>;
    switch (view) {
      case 'lv': return <LVView />;
      case 'kalkulation': return <KalkulationView />;
      case 'bauzeit': return <BauzeitView />;
      case 'aufmass': return <AufmassView />;
      case 'stationierung': return <StationierungView />;
      case 'rechnungen': return <RechnungenView />;
      case 'nachkalk': return <NachkalkView />;
      case 'druck': return <DruckView />;
    }
    return null;
  };

  return (
    <div className={`app ${eingeklappt ? 'collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Navigation">
        <div className="brand">
          <div className="logo">P</div>
          <div className="brand-text">
            <div className="title">Polier</div>
            <div className="sub">Bauabrechnung &amp; Kalkulation</div>
          </div>
          <button className="collapse-btn" onClick={toggleSidebar} aria-expanded={!eingeklappt} aria-label={eingeklappt ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'} title={eingeklappt ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}>
            {eingeklappt ? '»' : '«'}
          </button>
        </div>
        {NAV.map(n => (
          <button key={n.view} className={`nav-btn ${view === n.view ? 'active' : ''}`} disabled={n.needsProjekt && !projekt} onClick={() => setView(n.view)} title={n.label} aria-label={n.label}>
            <span className="ico">{n.ico}</span><span className="lbl">{n.label}</span>
          </button>
        ))}
        <div className="nav-sep" />
        <button className={`nav-btn ${view === 'stammdaten' ? 'active' : ''}`} onClick={() => setView('stammdaten')} title="Stammdaten" aria-label="Stammdaten">
          <span className="ico">⚙</span><span className="lbl">Stammdaten</span>
        </button>
        <button className="theme-mini" style={{ marginTop: 'auto' }} onClick={naechstesTheme} title={`Darstellung: ${theme === 'hell' ? 'Hell' : theme === 'dunkel' ? 'Dunkel' : 'Auto'} (antippen zum Wechseln)`} aria-label="Darstellung wechseln">
          {theme === 'hell' ? '☀' : theme === 'dunkel' ? '☾' : 'A'}
        </button>
        <div className="theme-switch" role="group" aria-label="Darstellung">
          {(['hell', 'dunkel', 'auto'] as ThemeMode[]).map(m => (
            <button key={m} className={theme === m ? 'active' : ''} onClick={() => wechsleTheme(m)} title={m === 'auto' ? 'Systemeinstellung verwenden' : `${m === 'hell' ? 'Heller' : 'Dunkler'} Modus`}>
              {m === 'hell' ? '☀ Hell' : m === 'dunkel' ? '☾ Dunkel' : 'Auto'}
            </button>
          ))}
        </div>
        {projekt && <div className="projekt-mini" title={`${projekt.nummer} · ${projekt.bezeichnung}`}>{projekt.nummer}</div>}
        <div className="projekt-chip" style={{ marginTop: 6 }}>
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
          <OfflineMarke />
          {projekt && <span className="muted">{projekt.bauvorhaben || projekt.bezeichnung}</span>}
        </div>
        <div className="content">
          {renderBody()}
        </div>
      </main>
      <UpdateHinweis />
    </div>
  );
}

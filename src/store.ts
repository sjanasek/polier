import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Kunde, Projekt, Stammdaten } from './types';
import { neuesProjekt, standardStammdaten } from './lib/defaults';
import { demoKunden, demoProjekt } from './lib/demo';
import { kundeAdresse } from './lib/kunden';

export type View = 'projekte' | 'kunden' | 'lv' | 'kalkulation' | 'bauzeit' | 'aufmass' | 'stationierung' | 'rechnungen' | 'druck' | 'stammdaten';

export type DruckArt = 'lv' | 'angebot' | 'rechnung' | 'aufmass' | 'kalkulation' | 'bauzeit';

export interface DruckAuftrag { art: DruckArt; rechnungId?: string }

interface State {
  projekte: Projekt[];
  aktivId: string | null;
  stammdaten: Stammdaten;
  view: View;
  druck: DruckAuftrag | null;
  setView: (v: View) => void;
  setDruck: (d: DruckAuftrag | null) => void;
  setAktiv: (id: string | null) => void;
  addProjekt: (p?: Projekt) => string;
  addProjektFuerKunde: (kundeId: string) => string;
  updateKunde: (id: string, fn: (k: Kunde) => Kunde) => void;
  deleteProjekt: (id: string) => void;
  updateProjekt: (id: string, fn: (p: Projekt) => Projekt) => void;
  updateStammdaten: (fn: (s: Stammdaten) => Stammdaten) => void;
  importAll: (data: { projekte: Projekt[]; stammdaten: Stammdaten }) => void;
}

const demo = demoProjekt();
const startStamm = (): Stammdaten => ({ ...standardStammdaten(), kunden: demoKunden() });

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      projekte: [demo],
      aktivId: demo.id,
      stammdaten: startStamm(),
      view: 'projekte',
      druck: null,
      setView: view => set({ view }),
      setDruck: druck => set({ druck, view: druck ? 'druck' : get().view }),
      setAktiv: aktivId => set({ aktivId }),
      addProjekt: p => {
        const nr = `${new Date().getFullYear()}-${String(get().projekte.length + 1).padStart(3, '0')}`;
        const np = p ?? neuesProjekt(nr);
        set(s => ({ projekte: [...s.projekte, np], aktivId: np.id }));
        return np.id;
      },
      addProjektFuerKunde: kundeId => {
        const k = get().stammdaten.kunden.find(x => x.id === kundeId);
        const id = get().addProjekt();
        if (k) get().updateProjekt(id, p => ({ ...p, kundeId: k.id, auftraggeber: kundeAdresse(k), bezeichnung: `Neues Projekt ${k.name}`.trim() }));
        return id;
      },
      updateKunde: (id, fn) => set(s => ({ stammdaten: { ...s.stammdaten, kunden: s.stammdaten.kunden.map(k => (k.id === id ? fn(k) : k)) } })),
      deleteProjekt: id => set(s => {
        const projekte = s.projekte.filter(p => p.id !== id);
        return { projekte, aktivId: s.aktivId === id ? projekte[0]?.id ?? null : s.aktivId };
      }),
      updateProjekt: (id, fn) => set(s => ({ projekte: s.projekte.map(p => (p.id === id ? fn(p) : p)) })),
      updateStammdaten: fn => set(s => ({ stammdaten: fn(s.stammdaten) })),
      importAll: data => set({ projekte: data.projekte, stammdaten: { ...data.stammdaten, kunden: data.stammdaten.kunden ?? [] }, aktivId: data.projekte[0]?.id ?? null }),
    }),
    {
      name: 'polier-v1',
      partialize: s => ({ projekte: s.projekte, aktivId: s.aktivId, stammdaten: s.stammdaten }),
      // Ältere Speicherstände kennen noch kein Adressbuch: Feld ergänzen (leer), alles andere bleibt.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, stammdaten: { ...current.stammdaten, ...p.stammdaten, kunden: p.stammdaten?.kunden ?? (p.stammdaten ? [] : current.stammdaten.kunden) } };
      },
    },
  ),
);

/** Aktives Projekt + Updater */
export function useProjekt() {
  const projekt = useStore(s => s.projekte.find(p => p.id === s.aktivId) ?? null);
  const updateProjekt = useStore(s => s.updateProjekt);
  const update = (fn: (p: Projekt) => Projekt) => projekt && updateProjekt(projekt.id, fn);
  return { projekt, update };
}

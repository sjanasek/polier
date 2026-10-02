export type ThemeMode = 'auto' | 'hell' | 'dunkel';
const KEY = 'polier-theme';

export function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'auto' || v === 'hell' || v === 'dunkel') return v;
  } catch { /* Speicher nicht verfügbar */ }
  return 'hell';
}

/** Setzt data-theme am <html>-Element; "auto" folgt der Systemeinstellung. */
export function applyTheme(mode: ThemeMode): void {
  const dark = mode === 'dunkel' || (mode === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function saveTheme(mode: ThemeMode): void {
  try { localStorage.setItem(KEY, mode); } catch { /* ignorieren */ }
  applyTheme(mode);
}

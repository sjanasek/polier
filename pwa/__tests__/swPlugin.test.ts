import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import fs from 'node:fs';
import { erzeugeServiceWorker } from '../swPlugin';

const vorlage = fs.readFileSync(new URL('../sw.template.js', import.meta.url), 'utf8');
const d = (pfad: string, text: string) => ({ pfad, inhalt: new TextEncoder().encode(text) });

describe('Service-Worker-Erzeugung', () => {
  const dateien = [d('index.html', '<html>'), d('assets/index-abc.js', 'a'), d('icons/icon-192.png', 'png'), d('sw.js', 'alt'), d('.htaccess', 'x'), d('manifest.webmanifest', '{}')];

  it('ersetzt beide Platzhalter und ist gültiges JavaScript', () => {
    const js = erzeugeServiceWorker(vorlage, dateien);
    expect(js).not.toContain('__VERSION__');
    expect(js).not.toContain('__PRECACHE__');
    expect(() => new vm.Script(js)).not.toThrow();
  });
  it('legt alle App-Dateien, aber weder sw.js noch .htaccess in den Precache', () => {
    const js = erzeugeServiceWorker(vorlage, dateien);
    const liste = JSON.parse(js.match(/const PRECACHE = (\[.*\]);/)![1]) as string[];
    expect(liste).toEqual(['assets/index-abc.js', 'icons/icon-192.png', 'index.html', 'manifest.webmanifest']);
  });
  it('Version ändert sich mit dem Inhalt, auch bei gleichem Dateinamen, und ist reihenfolgeunabhängig', () => {
    const v = (x: ReturnType<typeof d>[]) => erzeugeServiceWorker(vorlage, x).match(/const VERSION = '([0-9a-f]+)'/)![1];
    const a = v(dateien);
    expect(a).toHaveLength(12);
    expect(v([...dateien].reverse())).toBe(a);
    expect(v(dateien.map(x => (x.pfad === 'icons/icon-192.png' ? d('icons/icon-192.png', 'neu') : x)))).not.toBe(a);
    expect(v([...dateien, d('assets/neu.css', 'b')])).not.toBe(a);
  });
  it('Windows-Pfade werden zu URL-Pfaden', () => {
    const js = erzeugeServiceWorker(vorlage, [d('assets\\x.js', 'a')]);
    expect(js).toContain('"assets/x.js"');
  });
});

import { describe, expect, it } from 'vitest';
import { csvErzeugen, dekodieren, erkenneTrennzeichen, parseCsv, parseDatum, parseZahl } from '../csv';

describe('CSV-Parser', () => {
  it('erkennt Semikolon, Komma und Tabulator', () => {
    expect(erkenneTrennzeichen('a;b;c\n1;2;3')).toBe(';');
    expect(erkenneTrennzeichen('a,b,c\n1,2,3')).toBe(',');
    expect(erkenneTrennzeichen('a\tb\tc\n1\t2\t3')).toBe('\t');
    // Komma in Zahlen innerhalb von Anführungszeichen stört nicht
    expect(erkenneTrennzeichen('Datum;Betrag\n01.08.2026;"1.234,56"\n02.08.2026;"7,00"')).toBe(';');
  });
  it('Anführungszeichen, doppelte Anführungszeichen, Zeilenumbruch im Feld, CRLF', () => {
    const t = parseCsv('Konto;Text;Betrag\r\n4810;"Miete ""Bagger"";\nzwei Zeilen";"1.234,56"\r\n4530;LKW;5,00\r\n');
    expect(t.trennzeichen).toBe(';');
    expect(t.kopf).toEqual(['Konto', 'Text', 'Betrag']);
    expect(t.zeilen).toHaveLength(2);
    expect(t.zeilen[0][1]).toBe('Miete "Bagger";\nzwei Zeilen');
    expect(t.zeilen[0][2]).toBe('1.234,56');
    expect(t.zeilen[1]).toEqual(['4530', 'LKW', '5,00']);
  });
  it('kurze Zeilen werden aufgefüllt, Leerzeilen entfernt', () => {
    const t = parseCsv('a;b;c\n1;2\n\n3;4;5\n');
    expect(t.zeilen).toEqual([['1', '2', ''], ['3', '4', '5']]);
  });
  it('BOM wird entfernt', () => {
    const t = parseCsv('﻿Datum;Stunden\n01.08.2026;8');
    expect(t.kopf[0]).toBe('Datum');
  });
  it('Kodierung: UTF-8 und Windows-1252 automatisch', () => {
    const utf8 = new TextEncoder().encode('Kostenstelle;Bezeichnung\n4711;Straße Süd');
    expect(dekodieren(utf8.buffer, 'auto')).toEqual({ text: 'Kostenstelle;Bezeichnung\n4711;Straße Süd', kodierung: 'utf-8' });
    const ansi = new Uint8Array([0x53, 0x74, 0x72, 0x61, 0xdf, 0x65, 0x20, 0x53, 0xfc, 0x64]); // "Straße Süd" in Windows-1252
    const r = dekodieren(ansi.buffer, 'auto');
    expect(r.kodierung).toBe('windows-1252');
    expect(r.text).toBe('Straße Süd');
    expect(dekodieren(ansi.buffer, 'windows-1252').text).toBe('Straße Süd');
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
    expect(dekodieren(bom.buffer).text).toBe('A');
  });
  it('deutsche und englische Zahlen, Vorzeichenvarianten', () => {
    expect(parseZahl('1.234,56')).toBe(1234.56);
    expect(parseZahl('1234,56')).toBe(1234.56);
    expect(parseZahl('1234.56')).toBe(1234.56);
    expect(parseZahl('1,234.56')).toBe(1234.56);
    expect(parseZahl('1.234.567')).toBe(1234567);
    expect(parseZahl('-12,5')).toBe(-12.5);
    expect(parseZahl('12,5-')).toBe(-12.5);
    expect(parseZahl('(12,50)')).toBe(-12.5);
    expect(parseZahl('1.234,56 €')).toBe(1234.56);
    expect(parseZahl('8')).toBe(8);
    expect(parseZahl('')).toBeNull();
    expect(parseZahl('abc')).toBeNull();
    expect(parseZahl(undefined)).toBeNull();
  });
  it('Datumsformate', () => {
    expect(parseDatum('03.08.2026')).toBe('2026-08-03');
    expect(parseDatum('3.8.26')).toBe('2026-08-03');
    expect(parseDatum('2026-08-03')).toBe('2026-08-03');
    expect(parseDatum('2026-08-03T10:00:00')).toBe('2026-08-03');
    expect(parseDatum('03/08/2026')).toBe('2026-08-03');
    expect(parseDatum('20260803')).toBe('2026-08-03');
    expect(parseDatum('31.02.2026')).toBeNull();
    expect(parseDatum('Datum')).toBeNull();
    expect(parseDatum('')).toBeNull();
  });
  it('CSV erzeugen mit Maskierung und Dezimalkomma', () => {
    const s = csvErzeugen(['A', 'B'], [['x;y', 1234.5], ['"q"', null]]);
    expect(s).toBe('A;B\r\n"x;y";1234,50\r\n"""q""";\r\n');
    const zurueck = parseCsv(s);
    expect(zurueck.zeilen[0]).toEqual(['x;y', '1234,50']);
    expect(zurueck.zeilen[1][0]).toBe('"q"');
  });
});

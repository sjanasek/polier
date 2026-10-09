import { describe, expect, it } from 'vitest';
import { erkenneIOS } from '../pwa';

describe('iOS-Erkennung', () => {
  it('iPhone und iPad', () => {
    expect(erkenneIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(erkenneIOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad', 5)).toBe(true);
  });
  it('iPadOS im Desktop-Modus meldet sich als Mac mit Touch', () => {
    expect(erkenneIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
  });
  it('echter Mac und Android sind kein iOS', () => {
    expect(erkenneIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(erkenneIOS('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5)).toBe(false);
  });
});

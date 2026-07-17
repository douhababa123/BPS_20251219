import { describe, expect, it } from 'vitest';
import { BRAND } from '../branding';

describe('BPS Compass brand copy', () => {
  it('exposes the approved user-visible copy', () => {
    expect(BRAND).toEqual({
      name: 'BPS Compass',
      slogan: 'Guide the Right people to the Right projects.',
      footer: '© 2026 Bosch BPS Compass',
    });
  });
});

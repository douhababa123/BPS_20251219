import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND } from '../branding';

const reactBrandSurfaces = [
  '../../components/Sidebar.tsx',
  '../../components/LoginScreen.tsx',
  '../../components/SimpleLoginScreen.tsx',
  '../../components/BindEmailScreen.tsx',
  '../../components/ProfileSetupScreen.tsx',
  '../../components/SignupScreen.tsx',
  '../../components/OTPLogin.tsx',
  '../../pages/auth/PasswordLoginPage.tsx',
  '../../pages/auth/RegisterPage.tsx',
];

const legacyPlatformNames = [
  'BPS 能力与排程平台',
  'BPS Capacity & Scheduling',
  'BPS 能力管理系统',
  'BPS 管理系统',
  'BPS 系统',
];

describe('BPS Compass brand copy', () => {
  it('exposes the approved user-visible copy', () => {
    expect(BRAND).toEqual({
      name: 'BPS Compass',
      slogan: 'Guide the Right people to the Right projects.',
      footer: '© 2026 Bosch BPS Compass',
    });
  });

  it('removes legacy platform names from React brand surfaces', () => {
    for (const path of reactBrandSurfaces) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      for (const legacyName of legacyPlatformNames) {
        expect(source, `${path} still contains ${legacyName}`).not.toContain(legacyName);
      }
    }
  });

  it('uses BPS Compass as the browser title', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('<title>BPS Compass</title>');
    expect(html).not.toContain('BPS Capacity Scheduling Platform');
  });
});

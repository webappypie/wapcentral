import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION, resolveEnvironment, formatReleaseVersion } from '@wapcentral/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');
const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');

describe('Dashboard Release Metadata & Environment Safety', () => {
  it('must not have hardcoded v0.2.0 in Sidebar.tsx', () => {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    expect(sidebarContent).not.toContain('v0.2.0');
    expect(sidebarContent).not.toContain('0.2.0');
  });

  it('must not have hardcoded fallback "dev" in Sidebar.tsx', () => {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    expect(sidebarContent).not.toContain("|| 'dev'");
    expect(sidebarContent).not.toContain('|| "dev"');
  });

  it('must source APP_VERSION from centralized @wapcentral/config', () => {
    const versionJsonPath = path.join(rootDir, 'version.json');
    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    expect(APP_VERSION).toBe(versionData.version);
    expect(formatReleaseVersion(APP_VERSION)).toBe(`v${versionData.version}`);
  });

  it('must resolve to Production on Firebase Hosting live domains', () => {
    const prodHosts = [
      'wapcentral-prod.web.app',
      'wapcentral-prod.firebaseapp.com',
      'central.webappypie.com',
    ];

    for (const host of prodHosts) {
      const res = resolveEnvironment(host);
      expect(res.environment).toBe('production');
      expect(res.environmentLabel).toBe('Production');
    }
  });

  it('must resolve to Development on localhost and never display "dev"', () => {
    const res = resolveEnvironment('localhost');
    expect(res.environment).toBe('development');
    expect(res.environmentLabel).toBe('Development');
    expect(res.environmentLabel).not.toBe('dev');
  });

  it('must resolve to Staging on staging domains and never display "dev"', () => {
    const res = resolveEnvironment('staging.webappypie.com');
    expect(res.environment).toBe('staging');
    expect(res.environmentLabel).toBe('Staging');
    expect(res.environmentLabel).not.toBe('dev');
  });
});

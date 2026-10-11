import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_VERSION,
  resolveEnvironment,
  formatReleaseVersion,
} from '../version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');

describe('Release Version & Environment Resolution (@wapcentral/config)', () => {
  it('should have a valid semver APP_VERSION', () => {
    const semverRegex = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/;
    expect(APP_VERSION).toMatch(semverRegex);
  });

  it('should match the version declared in root version.json', () => {
    const versionJsonPath = path.join(rootDir, 'version.json');
    expect(fs.existsSync(versionJsonPath)).toBe(true);
    const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    expect(APP_VERSION).toBe(versionData.version);
  });

  describe('resolveEnvironment()', () => {
    it('should resolve production Firebase Hosting domains to Production', () => {
      const prodDomains = [
        'wapcentral-prod.web.app',
        'wapcentral-prod.firebaseapp.com',
        'central.webappypie.com',
        'myapp.web.app',
      ];

      for (const domain of prodDomains) {
        const result = resolveEnvironment(domain);
        expect(result.environment).toBe('production');
        expect(result.environmentLabel).toBe('Production');
      }
    });

    it('should resolve staging domains to Staging', () => {
      const stagingDomains = [
        'staging.webappypie.com',
        'wapcentral-stage.web.app',
      ];

      for (const domain of stagingDomains) {
        const result = resolveEnvironment(domain);
        expect(result.environment).toBe('staging');
        expect(result.environmentLabel).toBe('Staging');
      }
    });

    it('should resolve local development to Development', () => {
      const devDomains = ['localhost', '127.0.0.1'];

      for (const domain of devDomains) {
        const result = resolveEnvironment(domain, 'development');
        expect(result.environment).toBe('development');
        expect(result.environmentLabel).toBe('Development');
      }
    });

    it('should resolve via environment variable when hostname is omitted', () => {
      expect(resolveEnvironment(undefined, 'production')).toEqual({
        environment: 'production',
        environmentLabel: 'Production',
      });

      expect(resolveEnvironment(undefined, 'staging')).toEqual({
        environment: 'staging',
        environmentLabel: 'Staging',
      });

      expect(resolveEnvironment(undefined, 'development')).toEqual({
        environment: 'development',
        environmentLabel: 'Development',
      });
    });

    it('should NEVER return "dev" as environment label', () => {
      const testCases = [
        ['', ''],
        ['localhost', 'dev'],
        ['127.0.0.1', 'development'],
        ['wapcentral-prod.web.app', 'dev'], // Hostname overrides false dev env var
      ];

      for (const [host, env] of testCases) {
        const result = resolveEnvironment(host, env);
        expect(result.environmentLabel).not.toBe('dev');
        expect(['Production', 'Staging', 'Development']).toContain(result.environmentLabel);
      }
    });
  });

  describe('formatReleaseVersion()', () => {
    it('should prefix with "v" if not present', () => {
      expect(formatReleaseVersion('0.2.1')).toBe('v0.2.1');
      expect(formatReleaseVersion('v0.2.1')).toBe('v0.2.1');
    });

    it('should default to APP_VERSION', () => {
      expect(formatReleaseVersion()).toBe(`v${APP_VERSION}`);
    });
  });
});

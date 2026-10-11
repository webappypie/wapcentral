/**
 * WAPCentral Release Version & Metadata
 *
 * Central source of truth for application version and release metadata.
 * Auto-bumped via scripts/bump-version.mjs.
 * DO NOT manually edit version here; use `pnpm version:patch`, `pnpm version:minor`, or `pnpm version:major`.
 */

import { APP_VERSION } from './generated-version.js';

export { APP_VERSION };

export type Environment = 'development' | 'staging' | 'production';
export type EnvironmentLabel = 'Development' | 'Staging' | 'Production';

export interface ReleaseMetadata {
  version: string;
  environment: Environment;
  environmentLabel: EnvironmentLabel;
  commitSha?: string;
  buildTime?: string;
  releaseId?: string;
}

/**
 * Safely extracts hostname in browser or edge environments without DOM type dependencies.
 */
function getRuntimeHostname(): string {
  try {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as {
        window?: { location?: { hostname?: string } };
        location?: { hostname?: string };
      };
      if (g.window?.location?.hostname) return g.window.location.hostname;
      if (g.location?.hostname) return g.location.hostname;
    }
  } catch {
    // Non-browser or sandbox environment
  }
  return '';
}

/**
 * Resolves current environment name and human-readable label.
 * Prioritizes actual production hostname checks in client browsers
 * to prevent production environments from ever displaying "dev" or "development".
 */
export function resolveEnvironment(
  hostname?: string,
  envVar?: string,
): { environment: Environment; environmentLabel: EnvironmentLabel } {
  const normalizedEnv = (envVar || '').toLowerCase().trim();

  // 1. Hostname detection (browser runtime safety)
  const host = (hostname || getRuntimeHostname()).toLowerCase().trim();

  if (host) {
    if (host.includes('staging') || host.includes('stage')) {
      return { environment: 'staging', environmentLabel: 'Staging' };
    }

    if (
      host.includes('wapcentral-prod') ||
      host.includes('central.webappypie.com') ||
      (host.endsWith('.web.app') && !host.includes('dev') && !host.includes('stage')) ||
      (host.endsWith('.firebaseapp.com') && !host.includes('dev') && !host.includes('stage'))
    ) {
      return { environment: 'production', environmentLabel: 'Production' };
    }
  }

  // 2. Environment variable detection
  if (normalizedEnv === 'production' || normalizedEnv === 'prod') {
    return { environment: 'production', environmentLabel: 'Production' };
  }

  if (normalizedEnv === 'staging' || normalizedEnv === 'stage') {
    return { environment: 'staging', environmentLabel: 'Staging' };
  }

  // 3. Fallback to development for local / emulator
  return { environment: 'development', environmentLabel: 'Development' };
}

/**
 * Formats release version string for UI display.
 * e.g., '0.2.1' -> 'v0.2.1'
 */
export function formatReleaseVersion(version: string = APP_VERSION): string {
  return version.startsWith('v') ? version : `v${version}`;
}

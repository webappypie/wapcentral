#!/usr/bin/env node
/**
 * scripts/sync-version.mjs
 *
 * Synchronizes application version from root version.json into generated-version.ts
 * and workspace package manifests.
 *
 * version.json is the ONLY manually maintained source of truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const versionJsonPath = path.join(rootDir, 'version.json');
const generatedVersionTsPath = path.join(
  rootDir,
  'packages',
  'config',
  'src',
  'generated-version.ts',
);

// All package manifests kept in sync with version.json
const packageJsonPaths = [
  path.join(rootDir, 'package.json'),
  path.join(rootDir, 'apps', 'dashboard', 'package.json'),
  path.join(rootDir, 'packages', 'config', 'package.json'),
  path.join(rootDir, 'packages', 'types', 'package.json'),
  path.join(rootDir, 'packages', 'ui', 'package.json'),
  path.join(rootDir, 'packages', 'validation', 'package.json'),
  path.join(rootDir, 'packages', 'provider-sdk', 'package.json'),
  path.join(rootDir, 'services', 'admin-api', 'package.json'),
  path.join(rootDir, 'services', 'ai-gateway', 'package.json'),
  path.join(rootDir, 'services', 'promotion-api', 'package.json'),
  path.join(rootDir, 'services', 'workers', 'package.json'),
];

export function syncVersion() {
  if (!fs.existsSync(versionJsonPath)) {
    throw new Error(`Single Source of Truth not found: ${versionJsonPath}`);
  }

  const raw = fs.readFileSync(versionJsonPath, 'utf-8');
  const data = JSON.parse(raw);
  const version = data.version;

  const semverRegex = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/;
  if (!version || !semverRegex.test(version)) {
    throw new Error(`Invalid version '${version}' in version.json. Must be valid semver.`);
  }

  // 1. Generate packages/config/src/generated-version.ts
  const generatedContent = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
 * Derived from root version.json via scripts/sync-version.mjs.
 */

export const APP_VERSION = '${version}';
`;

  fs.writeFileSync(generatedVersionTsPath, generatedContent, 'utf-8');

  // 2. Synchronize all package.json manifests
  for (const pkgPath of packageJsonPaths) {
    if (fs.existsSync(pkgPath)) {
      const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      if (pkg.version !== version) {
        pkg.version = version;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    }
  }

  return version;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const v = syncVersion();
  console.log(`[sync-version] Synchronized version ${v} from version.json to generated files.`);
}

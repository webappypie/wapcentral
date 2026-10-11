#!/usr/bin/env node
/**
 * scripts/bump-version.mjs
 *
 * Centralized Semantic Version Bumper for WAPCentral.
 *
 * Updates ONLY version.json as the Single Source of Truth,
 * then calls sync-version.mjs to synchronize generated artifacts.
 *
 * Usage:
 *   node scripts/bump-version.mjs [patch|minor|major|<specific-version>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { syncVersion } from './sync-version.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const versionJsonPath = path.join(rootDir, 'version.json');

function readCurrentVersion() {
  if (fs.existsSync(versionJsonPath)) {
    const raw = fs.readFileSync(versionJsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.version) return data.version;
  }
  return '0.2.1';
}

function calculateNextVersion(currentVersion, bumpType) {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?$/;
  const match = currentVersion.match(semverRegex);
  if (!match) {
    throw new Error(`Current version '${currentVersion}' is not valid semantic versioning.`);
  }

  let major = parseInt(match[1], 10);
  let minor = parseInt(match[2], 10);
  let patch = parseInt(match[3], 10);

  const type = (bumpType || 'patch').toLowerCase().trim();

  if (type === 'patch') {
    patch += 1;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (semverRegex.test(type)) {
    return type;
  } else {
    throw new Error(
      `Invalid bump type '${bumpType}'. Must be 'patch', 'minor', 'major', or a valid semver string (e.g. 0.2.1).`,
    );
  }

  return `${major}.${minor}.${patch}`;
}

function updateVersionJson(newVersion) {
  const data = {
    name: 'WAPCentral',
    version: newVersion,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(versionJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function main() {
  const bumpArg = process.argv[2] || 'patch';
  const currentVersion = readCurrentVersion();
  const nextVersion = calculateNextVersion(currentVersion, bumpArg);

  console.log(`[WAPCentral Release] Bumping version: ${currentVersion} -> ${nextVersion} (${bumpArg})`);

  // Step 1: Update ONLY version.json as the Single Source of Truth
  updateVersionJson(nextVersion);

  // Step 2: Automatically synchronize generated artifacts and package manifests
  syncVersion();

  // Step 3: Rebuild @wapcentral/config so downstream packages consume the updated dist
  console.log(`[WAPCentral Release] Rebuilding @wapcentral/config...`);
  try {
    execSync('pnpm --filter @wapcentral/config build', { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.warn(`[WAPCentral Release] Warning: Failed to rebuild @wapcentral/config:`, err.message);
  }

  console.log(`[WAPCentral Release] ✅ Successfully bumped version to ${nextVersion}!`);
}

main();

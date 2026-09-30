#!/usr/bin/env node
/**
 * WAPCentral — Production Firestore Backup Management Utility
 * Phase 13 — Production Release
 *
 * Provides cross-platform invocation and verification of Firestore backups.
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const options = {
  projectId: process.env.PROJECT_ID || 'wapcentral-prod',
  bucketName: process.env.BUCKET_NAME || 'wapcentral-firestore-backups-prod',
  collections: null,
  list: false,
  help: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--project' && args[i + 1]) {
    options.projectId = args[++i];
  } else if (arg === '--bucket' && args[i + 1]) {
    options.bucketName = args[++i];
  } else if (arg === '--collections' && args[i + 1]) {
    options.collections = args[++i];
  } else if (arg === '--list') {
    options.list = true;
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  }
}

if (options.help) {
  console.log(`
Usage: node scripts/backup-firestore.js [options]

Options:
  --project <id>       Google Cloud Project ID (default: wapcentral-prod)
  --bucket <name>      Target Cloud Storage Bucket (default: wapcentral-firestore-backups-prod)
  --collections <ids>  Comma-separated collection IDs to export (default: all)
  --list               List existing backup exports in the bucket
  --help               Display this help message
`);
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputUri = `gs://${options.bucketName}/exports/${timestamp}`;

console.log('============================================================');
console.log(' WAPCentral Firestore Backup Tool (Node.js)');
console.log(` Project:  ${options.projectId}`);
console.log(` Bucket:   gs://${options.bucketName}`);
console.log(` Time:     ${timestamp}`);
console.log('============================================================');

if (options.list) {
  console.log(`Listing backups in gs://${options.bucketName}/exports/...`);
  try {
    const listOutput = execSync(`gsutil ls -l "gs://${options.bucketName}/exports/"`, {
      encoding: 'utf-8',
    });
    console.log(listOutput);
  } catch {
    console.log('No backups found or gsutil unavailable.');
  }
  process.exit(0);
}

let command = `gcloud firestore export ${outputUri} --project=${options.projectId}`;
if (options.collections) {
  command += ` --collection-ids=${options.collections}`;
  console.log(`Targeting collections: ${options.collections}`);
} else {
  console.log('Targeting ALL database collections.');
}

console.log(`Executing: ${command}`);
try {
  execSync(command, { stdio: 'inherit' });
  console.log('============================================================');
  console.log('✅ Firestore export initiated successfully.');
  console.log(`Destination: ${outputUri}`);
  console.log('============================================================');
} catch (error) {
  console.error('❌ Failed to execute Firestore export via gcloud CLI:', error.message);
  process.exit(1);
}

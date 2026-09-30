/**
 * @wapcentral/workers
 *
 * Background Workers for WAPCentral.
 * - usageWorker: aggregates Firestore usageEvents into DailyUsage records and applies data retention.
 * - healthWorker: scheduled monitoring for AI providers and services (Phase 11).
 */

export * from './usageWorker.js';
export * from './healthWorker.js';

export const WORKERS_VERSION = '0.6.0';

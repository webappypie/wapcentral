import type { AuditLog, AuditAction } from '@wapcentral/types';

export interface AuditLogEntry {
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

const inMemoryAuditLogs: AuditLog[] = [];

export async function logAdminAction(entry: AuditLogEntry): Promise<AuditLog> {
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action: entry.action,
    actorUid: entry.actorUid,
    actorEmail: entry.actorEmail,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    ...(entry.changes ? { changes: entry.changes } : {}),
    ...(entry.metadata ? { metadata: entry.metadata } : {}),
    timestamp: new Date().toISOString(),
    ipAddress: entry.ipAddress || '127.0.0.1',
  };

  inMemoryAuditLogs.unshift(log);

  // Keep latest 1000 logs in memory buffer
  if (inMemoryAuditLogs.length > 1000) {
    inMemoryAuditLogs.pop();
  }

  return log;
}

export function getAuditLogs(limitCount = 50): AuditLog[] {
  return inMemoryAuditLogs.slice(0, limitCount);
}

export function clearAuditLogsForTest(): void {
  inMemoryAuditLogs.length = 0;
}

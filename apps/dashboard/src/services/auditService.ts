import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, isOfflineMode } from '../lib/firestore.js';
import { COLLECTIONS } from '@wapcentral/config';
import type { AuditLog, AuditAction } from '@wapcentral/types';

export interface RecordAuditParams {
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}

// In-memory test store (used exclusively in offline unit test environment)
let testLogs: AuditLog[] = [];

export function resetTestLogs(initial: AuditLog[] = []): void {
  testLogs = [...initial];
}

export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  const newLog: AuditLog = {
    id: `log_${Date.now()}`,
    action: params.action,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    ...(params.changes ? { changes: params.changes } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
    timestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1',
  };

  if (isOfflineMode) {
    testLogs.unshift(newLog);
  } else {
    try {
      const colRef = collection(db, COLLECTIONS.AUDIT_LOGS);
      await addDoc(colRef, {
        ...params,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } catch {
      // In production, direct client writes to auditLogs are blocked by Firestore security rules
      // (immutable audit logs are recorded by admin-api backend service with Admin SDK authority).
    }
  }
}

export function subscribeAuditLogs(
  onData: (logs: AuditLog[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData([...testLogs]);
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.AUDIT_LOGS);
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));

    return onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLog[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const log: AuditLog = {
            id: docSnap.id,
            action: data['action'],
            actorUid: data['actorUid'],
            actorEmail: data['actorEmail'],
            resourceType: data['resourceType'],
            resourceId: data['resourceId'],
            ...(data['changes'] ? { changes: data['changes'] } : {}),
            ...(data['metadata'] ? { metadata: data['metadata'] } : {}),
            timestamp:
              data['timestamp']?.toDate?.()?.toISOString() ||
              (typeof data['timestamp'] === 'string' ? data['timestamp'] : new Date().toISOString()),
            ipAddress: data['ipAddress'] || '127.0.0.1',
          };
          return log;
        });

        // Load strictly from Firestore
        onData(logs);
      },
      (err) => {
        if (onError) onError(err);
      },
    );
  } catch (err) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

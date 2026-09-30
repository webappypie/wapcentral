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

// In-memory fallback for development or offline mode
const memoryLogs: AuditLog[] = [
  {
    id: 'log_01',
    action: 'campaign.publish',
    actorUid: 'usr_admin',
    actorEmail: 'admin@webappypie.com',
    resourceType: 'campaign',
    resourceId: 'camp_01',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    ipAddress: '127.0.0.1',
  },
  {
    id: 'log_02',
    action: 'flag.update',
    actorUid: 'usr_editor',
    actorEmail: 'editor@webappypie.com',
    resourceType: 'featureFlag',
    resourceId: 'promotion_enabled',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    ipAddress: '127.0.0.1',
  },
];

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

  memoryLogs.unshift(newLog);

  if (!isOfflineMode) {
    try {
      const colRef = collection(db, COLLECTIONS.AUDIT_LOGS);
      await addDoc(colRef, {
        ...params,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } catch {
      // Graceful offline fallback: log recorded in memory
    }
  }
}

export function subscribeAuditLogs(
  onData: (logs: AuditLog[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData(memoryLogs);
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.AUDIT_LOGS);
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty && memoryLogs.length > 0) {
          onData(memoryLogs);
          return;
        }
        const logs: AuditLog[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const log: AuditLog = {
            id: docSnap.id,
            action: data.action,
            actorUid: data.actorUid,
            actorEmail: data.actorEmail,
            resourceType: data.resourceType,
            resourceId: data.resourceId,
            ...(data.changes ? { changes: data.changes } : {}),
            ...(data.metadata ? { metadata: data.metadata } : {}),
            timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
            ipAddress: data.ipAddress,
          };
          return log;
        });
        onData(logs.length > 0 ? logs : memoryLogs);
      },
      (err) => {
        // Fallback to in-memory logs on permission error or offline
        onData(memoryLogs);
        if (onError) onError(err);
      },
    );
  } catch (err) {
    onData(memoryLogs);
    return () => {};
  }
}

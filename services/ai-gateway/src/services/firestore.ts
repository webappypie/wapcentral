import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { config } from '../config.js';

export interface DocumentSnapshotLike {
  id: string;
  exists: boolean;
  data: () => Record<string, any> | undefined;
}

export interface QuerySnapshotLike {
  empty: boolean;
  size: number;
  docs: DocumentSnapshotLike[];
}

export interface DocumentReferenceLike {
  id: string;
  get: () => Promise<DocumentSnapshotLike>;
  set: (data: Record<string, any>, options?: { merge?: boolean }) => Promise<void>;
  delete: () => Promise<void>;
}

export interface CollectionReferenceLike {
  id: string;
  doc: (id?: string) => DocumentReferenceLike;
  get: () => Promise<QuerySnapshotLike>;
  where?: (field: string, op: string, val: any) => { get: () => Promise<QuerySnapshotLike> };
  orderBy?: (field: string, dir?: 'asc' | 'desc') => { get: () => Promise<QuerySnapshotLike> };
}

export interface FirestoreDatabaseLike {
  collection: (name: string) => CollectionReferenceLike;
}

// In-Memory store for fast, isolated unit testing without cloud side-effects
class InMemoryFirestoreStore implements FirestoreDatabaseLike {
  private readonly data = new Map<string, Map<string, Record<string, any>>>();

  private getCollectionMap(name: string): Map<string, Record<string, any>> {
    let col = this.data.get(name);
    if (!col) {
      col = new Map();
      this.data.set(name, col);
    }
    return col;
  }

  clear(): void {
    this.data.clear();
  }

  collection(name: string): CollectionReferenceLike {
    const colMap = this.getCollectionMap(name);

    return {
      id: name,
      doc: (docId?: string) => {
        const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          id,
          get: async (): Promise<DocumentSnapshotLike> => {
            const doc = colMap.get(id);
            return {
              id,
              exists: !!doc,
              data: () => (doc ? { ...doc } : undefined),
            };
          },
          set: async (newData: Record<string, any>, options?: { merge?: boolean }): Promise<void> => {
            const current = colMap.get(id);
            if (options?.merge && current) {
              colMap.set(id, { ...current, ...newData });
            } else {
              colMap.set(id, { ...newData });
            }
          },
          delete: async (): Promise<void> => {
            colMap.delete(id);
          },
        };
      },
      get: async (): Promise<QuerySnapshotLike> => {
        const docs: DocumentSnapshotLike[] = Array.from(colMap.entries()).map(([id, doc]) => ({
          id,
          exists: true,
          data: () => ({ ...doc }),
        }));
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        };
      },
    };
  }
}

const inMemoryStore = new InMemoryFirestoreStore();
let liveFirestore: Firestore | null = null;
let testOverrideDb: FirestoreDatabaseLike | null = null;

export function getFirestoreDb(): FirestoreDatabaseLike {
  if (testOverrideDb) {
    return testOverrideDb;
  }

  // During automated unit tests, use isolated in-memory Firestore by default unless real Firestore is explicitly requested
  if (config.isTest && process.env['USE_REAL_FIRESTORE'] !== 'true') {
    return inMemoryStore;
  }

  if (!liveFirestore) {
    if (getApps().length === 0) {
      if (process.env['FIRESTORE_EMULATOR_HOST']) {
        initializeApp({ projectId: config.firebaseProjectId });
      } else if (process.env['FIREBASE_SERVICE_ACCOUNT_KEY']) {
        try {
          const serviceAccount = JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT_KEY']);
          initializeApp({
            credential: cert(serviceAccount),
            projectId: config.firebaseProjectId,
          });
        } catch {
          initializeApp({ projectId: config.firebaseProjectId });
        }
      } else {
        try {
          initializeApp({
            credential: applicationDefault(),
            projectId: config.firebaseProjectId,
          });
        } catch {
          initializeApp({ projectId: config.firebaseProjectId });
        }
      }
    }
    liveFirestore = getFirestore();
  }

  return liveFirestore as unknown as FirestoreDatabaseLike;
}

export function clearInMemoryFirestoreForTest(): void {
  inMemoryStore.clear();
}

export function setFirestoreDbForTest(override: FirestoreDatabaseLike | null): void {
  testOverrideDb = override;
}

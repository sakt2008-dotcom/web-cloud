import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import {
  doc,
  Firestore,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { isPersonalDemoMode } from './lib/demoMode';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firestoreDatabaseId
  );
} catch {
  dbInstance = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
}

let storageInstance: FirebaseStorage | null = null;
try {
  if ((firebaseConfig as { storageBucket?: string }).storageBucket) {
    storageInstance = getStorage(app);
  }
} catch {
  storageInstance = null;
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = storageInstance;
export { app, firebaseConfig };

export async function testFirestoreConnection(): Promise<boolean> {
  if (isPersonalDemoMode()) return true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (Firestore client is offline).');
      return false;
    }
    // Any server response (e.g. permission-denied before login) proves online connectivity
    return true;
  }
}

if (!isPersonalDemoMode()) {
  void testFirestoreConnection();
}

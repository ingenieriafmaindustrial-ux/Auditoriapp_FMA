import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Caché local persistente: permite trabajar en planta con mala señal
// (las escrituras quedan en cola y se sincronizan al volver la conexión).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/**
 * Instancia secundaria para crear cuentas sin cerrar la sesión del auditor líder
 * (no usamos Cloud Functions / Admin SDK).
 */
export async function withSecondaryApp<T>(fn: (secondary: FirebaseApp) => Promise<T>): Promise<T> {
  const name = `secondary-${Date.now()}`;
  const secondary = initializeApp(firebaseConfig, name);
  try {
    return await fn(secondary);
  } finally {
    if (getApps().some((a) => a.name === name)) await deleteApp(secondary);
  }
}

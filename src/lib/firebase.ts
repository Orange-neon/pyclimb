import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type { Database } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

interface FirebaseContext {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
  user: User;
  db: typeof import("firebase/database");
}

let contextPromise: Promise<FirebaseContext> | null = null;

export function getFirebaseContext(): Promise<FirebaseContext> {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error("Firebase environment variables are not configured."));
  }

  if (!contextPromise) {
    contextPromise = (async () => {
      const [appApi, authApi, db] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/database"),
      ]);
      const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(firebaseConfig);
      const auth = authApi.getAuth(app);
      await authApi.setPersistence(auth, authApi.browserLocalPersistence);
      const user = auth.currentUser ?? (await authApi.signInAnonymously(auth)).user;
      return { app, auth, database: db.getDatabase(app), user, db };
    })();
  }

  return contextPromise;
}

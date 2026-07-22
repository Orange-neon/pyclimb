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

export interface GoogleUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
  authApi: typeof import("firebase/auth");
  db: typeof import("firebase/database");
}

interface FirebaseContext extends FirebaseServices {
  user: User;
}

let servicesPromise: Promise<FirebaseServices> | null = null;

export function getFirebaseErrorMessage(reason: unknown): string {
  const code = typeof reason === "object" && reason !== null && "code" in reason
    ? String((reason as { code?: unknown }).code)
    : "";

  if (code === "auth/operation-not-allowed") {
    return [
      "A Firebase sign-in provider is not enabled for this project.",
      "Enable Anonymous for timed rooms and Google for unlimited rooms in Firebase Console → Authentication → Sign-in method.",
    ].join(" ");
  }
  if (code === "auth/admin-restricted-operation") {
    return "Anonymous sign-in is not enabled for timed rooms. Enable it in Firebase Console → Authentication → Sign-in method.";
  }
  if (code === "auth/unauthorized-domain") {
    return [
      "This website domain is not authorized for Firebase sign-in.",
      "Open Firebase Console → Authentication → Settings → Authorized domains and add this site's hostname.",
    ].join(" ");
  }
  if (code === "auth/popup-blocked") {
    return "The Google sign-in popup was blocked. Allow popups for this site, then try again.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "The Google sign-in popup was closed before sign-in finished.";
  }
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

function isGoogleUser(user: User | null): user is User {
  return Boolean(user?.providerData.some((provider) => provider.providerId === "google.com"));
}

function profile(user: User): GoogleUserProfile {
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || user.email?.split("@")[0] || "Google user",
    email: user.email ?? "",
    photoURL: user.photoURL,
  };
}

async function getFirebaseServices(): Promise<FirebaseServices> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase environment variables are not configured.");
  }
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [appApi, authApi, db] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/database"),
      ]);
      const app = appApi.getApps().length ? appApi.getApp() : appApi.initializeApp(firebaseConfig);
      const auth = authApi.getAuth(app);
      await authApi.setPersistence(auth, authApi.browserLocalPersistence);
      return { app, auth, database: db.getDatabase(app), authApi, db };
    })();
  }
  return servicesPromise;
}

async function getCurrentOrAnonymousUser({ auth, authApi }: FirebaseServices): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  return (await authApi.signInAnonymously(auth)).user;
}

export async function getFirebaseContext(
  options: { requireGoogle?: boolean } = {},
): Promise<FirebaseContext> {
  const services = await getFirebaseServices();
  const user = await getCurrentOrAnonymousUser(services);
  if (options.requireGoogle && !isGoogleUser(user)) {
    throw new Error("Sign in with Google to use unlimited rooms.");
  }
  return { ...services, user };
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string> {
  const { user } = await getFirebaseContext();
  return user.getIdToken(forceRefresh);
}

export async function signInWithGoogle(): Promise<GoogleUserProfile> {
  const { auth, authApi } = await getFirebaseServices();
  await auth.authStateReady();
  const provider = new authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  let result;
  if (auth.currentUser?.isAnonymous) {
    try {
      result = await authApi.linkWithPopup(auth.currentUser, provider);
    } catch (reason) {
      const code = (reason as { code?: string }).code;
      if (code !== "auth/credential-already-in-use" && code !== "auth/email-already-in-use") {
        throw reason;
      }
      const credential = authApi.GoogleAuthProvider.credentialFromError(
        reason as Parameters<typeof authApi.GoogleAuthProvider.credentialFromError>[0],
      );
      if (!credential) throw reason;
      result = await authApi.signInWithCredential(auth, credential);
    }
  } else {
    result = await authApi.signInWithPopup(auth, provider);
  }
  if (!isGoogleUser(result.user)) throw new Error("Google sign-in did not complete.");
  return profile(result.user);
}

export async function signOutFirebase(): Promise<void> {
  const { auth, authApi } = await getFirebaseServices();
  await authApi.signOut(auth);
}

export async function observeGoogleUser(
  listener: (user: GoogleUserProfile | null) => void,
): Promise<() => void> {
  const { auth, authApi } = await getFirebaseServices();
  return authApi.onAuthStateChanged(auth, (user) => listener(isGoogleUser(user) ? profile(user) : null));
}

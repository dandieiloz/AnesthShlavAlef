import "server-only";
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

let cached: App | null = null;

function getApp(): App {
  if (cached) return cached;
  const existing = getApps()[0];
  if (existing) return (cached = existing);

  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error("FIREBASE_STORAGE_BUCKET is not set");

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const creds = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    return (cached = initializeApp({
      credential: cert({
        projectId: creds.project_id,
        clientEmail: creds.client_email,
        privateKey: creds.private_key.replace(/\\n/g, "\n"),
      }),
      storageBucket: bucket,
    }));
  }

  return (cached = initializeApp({
    credential: applicationDefault(),
    storageBucket: bucket,
  }));
}

export function getAdminBucket() {
  return getStorage(getApp()).bucket();
}

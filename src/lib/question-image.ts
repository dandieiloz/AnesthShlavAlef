import "server-only";
import { nanoid } from "nanoid";
import { randomUUID } from "node:crypto";
import { getAdminBucket } from "./firebase-admin";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class ImageValidationError extends Error {}

export async function uploadQuestionImage(file: File, folder = "questions"): Promise<{ url: string; path: string }> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new ImageValidationError(`סוג קובץ לא נתמך: ${file.type || "לא ידוע"}`);
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError(`קובץ גדול מדי (מקסימום ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`);
  }

  const ext = EXT_BY_MIME[file.type];
  const path = `${folder}/${nanoid()}.${ext}`;
  const bucket = getAdminBucket();
  const buf = Buffer.from(await file.arrayBuffer());

  const obj = bucket.file(path);
  const token = randomUUID();
  await obj.save(buf, {
    contentType: file.type,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  // Tokenized Firebase URL works with locked-down rules and without public ACLs.
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { url, path };
}

export async function deleteQuestionImage(path: string): Promise<void> {
  if (!path) return;
  try {
    await getAdminBucket().file(path).delete({ ignoreNotFound: true });
  } catch {
    // best-effort delete; missing object should not block the action
  }
}

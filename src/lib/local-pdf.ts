"use client";

const DB_NAME = "anesth-local-pdf";
const STORE = "handles";
const KEY = "textbook";

type FsaFileHandle = FileSystemFileHandle & {
  queryPermission?: (opts: { mode: "read" }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: "read" }) => Promise<PermissionState>;
};

export type LocalPdfState =
  | { kind: "none" }
  | { kind: "fsa"; name: string }
  | { kind: "session"; name: string };

let sessionFile: File | null = null;

export function isFsaSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoredState(): Promise<LocalPdfState> {
  if (isFsaSupported()) {
    try {
      const handle = await idbGet<FsaFileHandle>();
      if (handle) return { kind: "fsa", name: handle.name };
    } catch {
      /* ignore */
    }
  }
  if (sessionFile) return { kind: "session", name: sessionFile.name };
  return { kind: "none" };
}

export async function pickPdf(): Promise<LocalPdfState> {
  if (isFsaSupported()) {
    const w = window as unknown as {
      showOpenFilePicker: (opts: {
        types: { description?: string; accept: Record<string, string[]> }[];
        multiple?: boolean;
      }) => Promise<FsaFileHandle[]>;
    };
    const [handle] = await w.showOpenFilePicker({
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      multiple: false,
    });
    await idbSet(handle);
    return { kind: "fsa", name: handle.name };
  }
  // Fallback: prompt with hidden input
  const file = await pickViaInput();
  sessionFile = file;
  return { kind: "session", name: file.name };
}

function pickViaInput(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) resolve(f);
      else reject(new Error("no-file"));
    };
    input.oncancel = () => reject(new Error("cancelled"));
    input.click();
  });
}

export async function clearPdf(): Promise<void> {
  sessionFile = null;
  if (isFsaSupported()) {
    try {
      await idbDelete();
    } catch {
      /* ignore */
    }
  }
}

export type GetFileError =
  | "no-handle"
  | "permission-denied"
  | "not-found"
  | "unknown";

export class LocalPdfError extends Error {
  constructor(public code: GetFileError, message?: string) {
    super(message ?? code);
  }
}

export async function getPdfFile(): Promise<File> {
  if (isFsaSupported()) {
    let handle: FsaFileHandle | undefined;
    try {
      handle = await idbGet<FsaFileHandle>();
    } catch {
      /* ignore */
    }
    if (handle) {
      try {
        if (handle.queryPermission) {
          let state = await handle.queryPermission({ mode: "read" });
          if (state !== "granted" && handle.requestPermission) {
            state = await handle.requestPermission({ mode: "read" });
          }
          if (state !== "granted") {
            throw new LocalPdfError("permission-denied");
          }
        }
        return await handle.getFile();
      } catch (err) {
        if (err instanceof LocalPdfError) throw err;
        const name = (err as { name?: string })?.name;
        if (name === "NotFoundError") throw new LocalPdfError("not-found");
        if (name === "NotAllowedError") throw new LocalPdfError("permission-denied");
        throw new LocalPdfError("unknown", (err as Error).message);
      }
    }
  }
  if (sessionFile) return sessionFile;
  // Fallback browsers: prompt now
  if (!isFsaSupported()) {
    try {
      const file = await pickViaInput();
      sessionFile = file;
      return file;
    } catch {
      throw new LocalPdfError("no-handle");
    }
  }
  throw new LocalPdfError("no-handle");
}

let lastUrl: string | null = null;

const OFFSET_KEY = "anesth-local-pdf:page-offset";

export function getPageOffset(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(OFFSET_KEY);
  const n = raw == null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function setPageOffset(offset: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFSET_KEY, String(Math.trunc(offset)));
}

type PageMap = {
  version: number;
  pdfPageCount: number;
  breakpoints: { fromPrinted: number; offset: number }[];
};

let pageMapCache: PageMap | null | undefined; // undefined = unfetched

async function loadPageMap(): Promise<PageMap | null> {
  if (pageMapCache !== undefined) return pageMapCache;
  try {
    const res = await fetch("/textbook-pagemap.json", { cache: "force-cache" });
    if (!res.ok) {
      pageMapCache = null;
      return null;
    }
    const json = (await res.json()) as PageMap;
    if (!json || !Array.isArray(json.breakpoints) || json.breakpoints.length === 0) {
      pageMapCache = null;
      return null;
    }
    // Ensure sorted ascending by fromPrinted.
    json.breakpoints.sort((a, b) => a.fromPrinted - b.fromPrinted);
    pageMapCache = json;
    return json;
  } catch {
    pageMapCache = null;
    return null;
  }
}

function resolveFromMap(map: PageMap, printed: number): number | null {
  let chosen: { fromPrinted: number; offset: number } | null = null;
  for (const bp of map.breakpoints) {
    if (bp.fromPrinted <= printed) chosen = bp;
    else break;
  }
  if (!chosen) return null;
  const pdfPage = printed + chosen.offset;
  if (pdfPage < 1 || pdfPage > map.pdfPageCount) return null;
  return pdfPage;
}

export async function resolvePdfPage(printed: number): Promise<number> {
  const map = await loadPageMap();
  if (map) {
    const fromMap = resolveFromMap(map, printed);
    if (fromMap != null) return fromMap;
  }
  return Math.max(1, printed + getPageOffset());
}

export async function openPdfAtPage(printedPage: number): Promise<void> {
  const file = await getPdfFile();
  if (lastUrl) {
    URL.revokeObjectURL(lastUrl);
    lastUrl = null;
  }
  const url = URL.createObjectURL(file);
  lastUrl = url;
  const target = await resolvePdfPage(printedPage);
  window.open(`${url}#page=${target}`, "_blank", "noopener");
  // Revoke after a delay so the new tab has time to load.
  setTimeout(() => {
    if (lastUrl === url) {
      URL.revokeObjectURL(url);
      lastUrl = null;
    }
  }, 60_000);
}

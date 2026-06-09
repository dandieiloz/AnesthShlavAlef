"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface PwaContextValue {
  /** True when the browser has offered an install prompt we can replay. */
  canInstall: boolean;
  /** True when the app is already running as an installed PWA. */
  isStandalone: boolean;
  /** Replay the captured install prompt. Resolves to the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaContext = createContext<PwaContextValue>({
  canInstall: false,
  isStandalone: false,
  promptInstall: async () => "unavailable",
});

export function usePwaInstall() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Register the service worker once the page has loaded.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // best-effort: the app still works without the SW
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Detect standalone display mode (already installed).
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setIsStandalone(
        mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Capture the install prompt (fires once) and clear it after install.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return (
    <PwaContext.Provider value={{ canInstall: deferred !== null, isStandalone, promptInstall }}>
      {children}
    </PwaContext.Provider>
  );
}

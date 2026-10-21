"use client";
import { useSyncExternalStore } from "react";

// A per-browser preference shared by every re-test card on the page: when on,
// answers and explanations stay covered until the user picks an option.
const KEY = "perl:hideAnswers";
const EVENT = "perl:hide-answers-change";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useHideAnswers(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setHideAnswers(value: boolean) {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

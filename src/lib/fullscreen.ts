import { useCallback, useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

const STORAGE_KEY = "filament.fullscreen";
const FullView = registerPlugin<{ set(options: { enabled: boolean }): Promise<void> }>("FullView");
const isNative = () => Capacitor.isNativePlatform();

function readPreference(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? true : value === "1";
  } catch {
    return true;
  }
}

function savePreference(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // storage unavailable - the choice just won't persist
  }
}

/** Full view: hides the status + navigation bars in the Android app (browser fullscreen on web). */
export function useFullscreen() {
  const [on, setOn] = useState<boolean>(() => (isNative() ? readPreference() : false));

  useEffect(() => {
    if (isNative()) {
      FullView.set({ enabled: readPreference() }).catch(() => {});
      return;
    }
    const onChange = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (isNative()) {
      const next = !on;
      setOn(next);
      savePreference(next);
      FullView.set({ enabled: next }).catch(() => {});
    } else if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, [on]);

  return { on, toggle };
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "wn_theme";

type ThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

const listeners = new Set<() => void>();
let current: Theme = "dark";

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Theme {
  return current;
}

function getServerSnapshot(): Theme {
  return "dark";
}

function emit() {
  for (const l of listeners) l();
}

function writeTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") applyTheme(theme);
  emit();
}

// Sync from storage once on client module load
if (typeof window !== "undefined") {
  current = readTheme();
  applyTheme(current);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((t: Theme) => {
    writeTheme(t);
  }, []);

  const toggle = useCallback(() => {
    writeTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function ThemeToggle({ locale }: { locale: Locale }) {
  const { theme, toggle } = useTheme();
  const d = t(locale);
  const label = theme === "dark" ? d.themeLight : d.themeDark;

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex min-h-10 items-center text-[11px] uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

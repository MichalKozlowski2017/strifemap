import Link from "next/link";
import { Suspense } from "react";
import { DateStepper } from "@/components/date/date-stepper";
import { LangSwitch } from "@/components/i18n/lang-switch";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { theaterName } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { Theater } from "@/lib/types";

export function SiteHeader({
  theaters,
  locale,
  date,
  activeTheater,
  activeNav,
}: {
  theaters: Theater[];
  locale: Locale;
  date: string;
  activeTheater?: string;
  activeNav?: "map" | "news";
}) {
  const d = t(locale);
  const onMap = activeNav !== "news" && !activeTheater;
  const onNews = activeNav === "news";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/?date=${date}`} className="group min-w-0">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-[var(--foreground)] md:text-3xl">
              {d.brand}
            </p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">
              {d.tagline}
            </p>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle locale={locale} />
            <LangSwitch locale={locale} />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
            <Link
              href={`/?date=${date}`}
              className={`inline-flex min-h-10 items-center ${
                onMap ? "text-[var(--accent)]" : "hover:text-[var(--accent)]"
              }`}
            >
              {locale === "pl" ? "Mapa" : "Map"}
            </Link>
            <Link
              href={`/news?date=${date}`}
              className={`inline-flex min-h-10 items-center ${
                onNews ? "text-[var(--accent)]" : "hover:text-[var(--accent)]"
              }`}
            >
              {d.news}
            </Link>
            {theaters.map((theater) => (
              <Link
                key={theater.slug}
                href={`/t/${theater.slug}?date=${date}`}
                className={`inline-flex min-h-10 items-center hover:text-[var(--accent)] ${
                  activeTheater === theater.slug
                    ? "text-[var(--accent)]"
                    : theater.slug === "europe-hybrid"
                      ? "text-[var(--accent)] opacity-90"
                      : ""
                }`}
              >
                {theaterName(theater, locale)}
              </Link>
            ))}
          </nav>
          <Suspense fallback={<div className="h-7 w-48" />}>
            <DateStepper date={date} locale={locale} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

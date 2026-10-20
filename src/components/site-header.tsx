import Link from "next/link";
import { Suspense } from "react";
import { DateStepper } from "@/components/date/date-stepper";
import { LangSwitch } from "@/components/i18n/lang-switch";
import { theaterName } from "@/lib/i18n/content";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { Theater } from "@/lib/types";

export function SiteHeader({
  theaters,
  locale,
  date,
  activeTheater,
}: {
  theaters: Theater[];
  locale: Locale;
  date: string;
  activeTheater?: string;
}) {
  const d = t(locale);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c1117]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/?date=${date}`} className="group min-w-0">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-[#f3efe6] md:text-3xl">
              WAR NEWS
            </p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#c4a35a]">
              {d.tagline}
            </p>
          </Link>
          <div className="flex items-center gap-4">
            <LangSwitch locale={locale} />
            <Link
              href="/panel"
              className="text-[10px] uppercase tracking-widest text-stone-600 hover:text-stone-300"
            >
              {d.panel}
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-stone-400">
            <Link
              href={`/?date=${date}`}
              className={
                !activeTheater
                  ? "text-[#c4a35a]"
                  : "hover:text-[#c4a35a]"
              }
            >
              {locale === "pl" ? "Mapa" : "Map"}
            </Link>
            {theaters.map((theater) => (
              <Link
                key={theater.slug}
                href={`/t/${theater.slug}?date=${date}`}
                className={`hover:text-[#c4a35a] ${
                  activeTheater === theater.slug
                    ? "text-[#c4a35a]"
                    : theater.slug === "europe-hybrid"
                      ? "text-amber-500/90"
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

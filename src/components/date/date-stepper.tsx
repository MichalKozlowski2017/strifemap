"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatDisplayDate, shiftDateISO, todayISO } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

export function DateStepper({
  date,
  locale,
}: {
  date: string;
  locale: Locale;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const d = t(locale);
  const today = todayISO();
  const prev = shiftDateISO(date, -1);
  const next = shiftDateISO(date, 1);
  const nextDisabled = next > today;

  function hrefFor(iso: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", iso);
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
      <Link
        href={hrefFor(prev)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center border border-[var(--border)] px-2 hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
        aria-label={d.prevDay}
      >
        ‹
      </Link>
      <span className="min-w-[10.5rem] text-center text-sm font-medium tracking-wide text-[var(--foreground)]">
        {formatDisplayDate(date, locale)}
      </span>
      {nextDisabled ? (
        <span
          className="inline-flex min-h-11 min-w-11 items-center justify-center border border-[var(--border)] px-2 text-[var(--muted-2)]"
          aria-disabled
        >
          ›
        </span>
      ) : (
        <Link
          href={hrefFor(next)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center border border-[var(--border)] px-2 hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
          aria-label={d.nextDay}
        >
          ›
        </Link>
      )}
      {date !== today && (
        <Link
          href={hrefFor(today)}
          className="ml-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-widest text-[var(--accent)] hover:underline"
        >
          {d.today}
        </Link>
      )}
    </div>
  );
}

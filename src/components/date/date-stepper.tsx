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
    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
      <Link
        href={hrefFor(prev)}
        className="border border-white/15 px-2 py-1 hover:border-[#c4a35a]/50 hover:text-[#c4a35a]"
        aria-label={d.prevDay}
      >
        ‹
      </Link>
      <span className="min-w-[10.5rem] text-center font-medium tracking-wide text-[#f3efe6]">
        {formatDisplayDate(date, locale)}
      </span>
      {nextDisabled ? (
        <span
          className="border border-white/10 px-2 py-1 text-stone-600"
          aria-disabled
        >
          ›
        </span>
      ) : (
        <Link
          href={hrefFor(next)}
          className="border border-white/15 px-2 py-1 hover:border-[#c4a35a]/50 hover:text-[#c4a35a]"
          aria-label={d.nextDay}
        >
          ›
        </Link>
      )}
      {date !== today && (
        <Link
          href={hrefFor(today)}
          className="ml-1 text-[11px] uppercase tracking-widest text-[#c4a35a] hover:underline"
        >
          {d.today}
        </Link>
      )}
    </div>
  );
}

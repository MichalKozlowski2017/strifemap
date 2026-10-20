import Link from "next/link";
import type { Theater } from "@/lib/types";

export function SiteHeader({
  theaters,
  compact = false,
}: {
  theaters: Theater[];
  compact?: boolean;
}) {
  return (
    <header
      className={`absolute inset-x-0 top-0 z-20 ${
        compact ? "bg-[#0c1117]/90 backdrop-blur-md" : "pointer-events-none"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-4 md:px-6">
        <Link
          href="/"
          className={`pointer-events-auto group ${compact ? "" : ""}`}
        >
          <p className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em] text-[#f3efe6] md:text-5xl">
            WAR NEWS
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.28em] text-[#c4a35a]">
            Conflict intelligence
          </p>
        </Link>
        <nav className="pointer-events-auto flex max-w-[55%] flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-stone-300 md:text-xs">
          {theaters.map((t) => (
            <Link
              key={t.slug}
              href={`/t/${t.slug}`}
              className={`hover:text-[#c4a35a] ${
                t.slug === "europe-hybrid" ? "text-amber-400" : ""
              }`}
            >
              {t.name_pl}
            </Link>
          ))}
          <Link href="/panel" className="text-stone-500 hover:text-stone-200">
            Panel
          </Link>
        </nav>
      </div>
    </header>
  );
}

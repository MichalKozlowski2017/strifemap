"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n/dictionary";

export function LangSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setLocale(next: Locale) {
    if (next === locale) return;
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider ${
        pending ? "opacity-60" : ""
      }`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale("pl")}
        className={
          locale === "pl"
            ? "text-[#c4a35a]"
            : "text-stone-500 hover:text-stone-200"
        }
      >
        PL
      </button>
      <span className="text-stone-600">|</span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={
          locale === "en"
            ? "text-[#c4a35a]"
            : "text-stone-500 hover:text-stone-200"
        }
      >
        EN
      </button>
    </div>
  );
}

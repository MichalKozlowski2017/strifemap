import Link from "next/link";
import { redirect } from "next/navigation";
import { isPanelAuthenticated } from "@/lib/auth/panel";
import { isPanelPasswordConfigured } from "@/lib/auth/panel-edge";
import { todayISO } from "@/lib/dates";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function PanelLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const locale = await getLocale();
  const d = t(locale);
  const params = await searchParams;
  const date = todayISO();

  if (await isPanelAuthenticated()) {
    redirect(safeNext(params.next));
  }

  const configured = isPanelPasswordConfigured();
  const errored = params.error === "1";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm border border-white/10 bg-black/30 p-6">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.08em] text-[#f3efe6]">
          WAR NEWS
        </p>
        <h1 className="mt-4 text-lg font-medium text-[#c4a35a]">{d.panelLogin}</h1>
        <p className="mt-1 text-sm text-stone-400">{d.panelLoginHint}</p>

        {!configured ? (
          <p className="mt-6 text-sm text-amber-200/90">{d.panelNotConfigured}</p>
        ) : (
          <form
            method="post"
            action="/api/panel/login"
            className="mt-6 space-y-4"
          >
            <input type="hidden" name="next" value={safeNext(params.next)} />
            <label className="block text-xs uppercase tracking-widest text-stone-500">
              {d.password}
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full border border-white/15 bg-[#0c1117] px-3 py-2 text-sm text-stone-100 outline-none focus:border-[#c4a35a]/60"
              />
            </label>
            {errored && (
              <p className="text-sm text-red-400">{d.panelWrongPassword}</p>
            )}
            <button
              type="submit"
              className="w-full bg-[#c4a35a]/90 px-3 py-2 text-xs uppercase tracking-widest text-[#0c1117] hover:bg-[#c4a35a]"
            >
              {d.panelSignIn}
            </button>
          </form>
        )}

        <Link
          href={`/?date=${date}`}
          className="mt-6 inline-block text-xs uppercase tracking-widest text-stone-500 hover:text-[#c4a35a]"
        >
          {d.backToMap}
        </Link>
      </div>
    </main>
  );
}

function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/panel";
  if (raw.startsWith("/panel/login")) return "/panel";
  return raw;
}

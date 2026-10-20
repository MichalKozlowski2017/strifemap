"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SourceRow = {
  id: string;
  name: string;
  url: string;
  enabled: number;
  theater_slug: string | null;
  trust_weight: number;
};

type RawRow = {
  id: string;
  title: string;
  url: string;
  status: string;
  fetched_at: string;
  source_name: string;
};

type IncidentRow = {
  id: string;
  title: string;
  summary: string;
  status: string;
  confidence: string;
  type: string;
  map_eligible: number;
  theater_slug: string;
  name_pl: string;
  lat: number | null;
  lng: number | null;
  source_count: number;
};

export function PanelClient({
  sources,
  raw,
  incidents,
}: {
  sources: SourceRow[];
  raw: RawRow[];
  incidents: IncidentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setMsg(null);
    const res = await fetch("/api/panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMsg("Błąd zapisu");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-10">
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      {pending && (
        <p className="text-xs uppercase tracking-widest text-stone-500">
          Odświeżanie…
        </p>
      )}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
          Źródła RSS
        </h2>
        <ul className="divide-y divide-white/10 border border-white/10">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-stone-100">{s.name}</p>
                <p className="text-xs text-stone-500">
                  {s.theater_slug ?? "global"} · trust {s.trust_weight}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  post({
                    action: "toggle_source",
                    id: s.id,
                    enabled: !s.enabled,
                  })
                }
                className={`rounded px-3 py-1 text-xs uppercase tracking-wider ${
                  s.enabled
                    ? "bg-emerald-900/60 text-emerald-200"
                    : "bg-stone-800 text-stone-400"
                }`}
              >
                {s.enabled ? "ON" : "OFF"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
          Incydenty — review
        </h2>
        <ul className="space-y-3">
          {incidents.map((i) => (
            <li
              key={i.id}
              className="border border-white/10 bg-black/20 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-stone-500">
                    {i.name_pl} · {i.type} · {i.confidence} · src{" "}
                    {i.source_count} · map{" "}
                    {i.map_eligible ? "eligible" : "no"}
                  </p>
                  <p className="mt-1 font-medium text-stone-100">{i.title}</p>
                  <p className="mt-1 text-stone-400">{i.summary}</p>
                  <p className="mt-1 text-xs text-stone-600">
                    {i.lat != null && i.lng != null
                      ? `${i.lat.toFixed(2)}, ${i.lng.toFixed(2)}`
                      : "brak współrzędnych"}{" "}
                    · status: {i.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded bg-emerald-800/70 px-2 py-1 text-xs uppercase tracking-wider text-emerald-100"
                    onClick={() =>
                      post({
                        action: "set_incident_status",
                        id: i.id,
                        status: "approved",
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded bg-amber-800/70 px-2 py-1 text-xs uppercase tracking-wider text-amber-100"
                    onClick={() =>
                      post({
                        action: "set_incident_status",
                        id: i.id,
                        status: "published",
                      })
                    }
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    className="rounded bg-red-900/60 px-2 py-1 text-xs uppercase tracking-wider text-red-100"
                    onClick={() =>
                      post({
                        action: "set_incident_status",
                        id: i.id,
                        status: "rejected",
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[#c4a35a]">
          Kolejka raw
        </h2>
        <ul className="max-h-96 overflow-auto divide-y divide-white/5 border border-white/10 text-xs">
          {raw.map((r) => (
            <li key={r.id} className="px-3 py-2">
              <span className="text-stone-500">{r.status}</span> ·{" "}
              <span className="text-stone-400">{r.source_name}</span> —{" "}
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-stone-200 hover:text-[#c4a35a]"
              >
                {r.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

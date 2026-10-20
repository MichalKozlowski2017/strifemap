/** Calendar-day helpers using the server/local timezone. */

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

export function parseDateISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** Local-day bounds as ISO timestamps for SQL filtering. */
export function dayBoundsISO(dateISO: string): {
  start: string;
  end: string;
} | null {
  const d = parseDateISO(dateISO);
  if (!d) return null;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function shiftDateISO(dateISO: string, deltaDays: number): string {
  const d = parseDateISO(dateISO) ?? new Date();
  d.setDate(d.getDate() + deltaDays);
  return formatDateISO(d);
}

export function formatDisplayDate(
  dateISO: string,
  locale: "pl" | "en",
): string {
  const d = parseDateISO(dateISO);
  if (!d) return dateISO;
  return d.toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(
  iso: string,
  locale: "pl" | "en",
): string {
  return new Date(iso).toLocaleTimeString(locale === "pl" ? "pl-PL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

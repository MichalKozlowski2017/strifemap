import { createHash } from "node:crypto";

export function contentHash(...parts: string[]): string {
  const normalized = parts
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

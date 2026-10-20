import type { NextRequest } from "next/server";

export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Local/dev: allow when secret unset
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const urlSecret = request.nextUrl.searchParams.get("secret");
  return urlSecret === secret;
}

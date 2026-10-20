import { NextRequest, NextResponse } from "next/server";
import {
  setIncidentStatus,
  setSourceEnabled,
} from "@/lib/db/queries";


export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action?: string;
    id?: string;
    enabled?: boolean;
    status?: "approved" | "rejected" | "published" | "pending";
  };

  if (body.action === "toggle_source" && body.id && typeof body.enabled === "boolean") {
    await setSourceEnabled(body.id, body.enabled);
    return NextResponse.json({ ok: true });
  }

  if (
    body.action === "set_incident_status" &&
    body.id &&
    body.status &&
    ["approved", "rejected", "published", "pending"].includes(body.status)
  ) {
    await setIncidentStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}

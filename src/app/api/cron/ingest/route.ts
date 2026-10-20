import { NextRequest, NextResponse } from "next/server";
import { finishJob, startJob } from "@/lib/cron/jobs";
import { ingestAllSources } from "@/lib/sources/ingest";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await startJob("ingest");
  try {
    const result = await ingestAllSources();
    await finishJob(job.id, "completed", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishJob(job.id, "failed", undefined, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

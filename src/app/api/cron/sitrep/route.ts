import { NextRequest, NextResponse } from "next/server";
import { generateDailySitreps } from "@/lib/ai/sitrep";
import { finishJob, startJob } from "@/lib/cron/jobs";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await startJob("sitrep");
  try {
    const result = await generateDailySitreps();
    await finishJob(job.id, "completed", result);
    if (result.skippedNoKey) {
      return NextResponse.json({
        ok: true,
        ...result,
        note: "OPENAI_API_KEY missing — sitrep skipped gracefully",
      });
    }
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

import { NextRequest, NextResponse } from "next/server";
import { finishJob, startJob } from "@/lib/cron/jobs";
import { runQaPipeline } from "@/lib/qa/pipeline";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await startJob("qa");
  try {
    const report = await runQaPipeline();
    await finishJob(job.id, report.ok ? "completed" : "failed", report);
    return NextResponse.json(report, {
      status: report.ok ? 200 : 503,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishJob(job.id, "failed", undefined, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

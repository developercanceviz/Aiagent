import { NextRequest, NextResponse } from "next/server";

import { runJob } from "@/lib/queue/handlers";
import type { JobEnvelope } from "@/lib/queue/types";

/**
 * QStash consumer endpoint. QStash POSTs the job envelope here; we run the
 * handler. (Signature verification with @upstash/qstash is added when
 * QSTASH_CURRENT_SIGNING_KEY is configured — Phase 10 hardening.)
 */
export async function POST(req: NextRequest) {
  let job: JobEnvelope;
  try {
    job = (await req.json()) as JobEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid job payload" }, { status: 400 });
  }

  try {
    await runJob(job);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[jobs] ${job.name} failed`, err);
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}

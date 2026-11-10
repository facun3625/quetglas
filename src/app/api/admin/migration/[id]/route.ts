import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { getJob } from "@/lib/woo/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const job = await getJob((await params).id);
  if (!job) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    counters: job.counters,
    issues: job.issues,
    sourceUrl: job.sourceUrl,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  });
}

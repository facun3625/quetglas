import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cancelImport, getImportJob } from "@/lib/productImport/jobs";

async function authorized() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

// Estado de una importación (el panel lo consulta cada segundo mientras corre)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const job = await getImportJob((await params).id);
  if (!job) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({
    id: job.id,
    fileName: job.fileName,
    status: job.status,
    progress: job.progress,
    counters: job.counters,
    issues: job.issues,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  });
}

// Cancelar: el proceso se detiene en el próximo producto (lo ya importado queda)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await cancelImport((await params).id);
  return NextResponse.json({ ok: true });
}

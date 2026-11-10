"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { sendResetEmail } from "@/lib/passwordReset";
import { WooError, type WooCredentials } from "@/lib/woo/client";
import { hasRunningJob, previewWoo, requestCancel, startMigration, type WooPreview } from "@/lib/woo/jobs";

function credsFrom(formData: FormData): WooCredentials | null {
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const consumerKey = String(formData.get("consumerKey") ?? "").trim();
  const consumerSecret = String(formData.get("consumerSecret") ?? "").trim();
  return baseUrl && consumerKey && consumerSecret ? { baseUrl, consumerKey, consumerSecret } : null;
}

const message = (err: unknown) => (err instanceof WooError ? err.message : "No se pudo conectar con la tienda");

export type PreviewResult = { ok: true; preview: WooPreview } | { ok: false; error: string };

export async function previewWooAction(formData: FormData): Promise<PreviewResult> {
  await requireSuperAdmin();
  const creds = credsFrom(formData);
  if (!creds) return { ok: false, error: "Completá la URL y las dos claves" };
  try {
    return { ok: true, preview: await previewWoo(creds) };
  } catch (err) {
    if (!(err instanceof WooError)) console.error("previewWoo failed", err);
    return { ok: false, error: message(err) };
  }
}

export type StartResult = { ok: true; jobId: string } | { ok: false; error: string };

export async function startWooMigrationAction(formData: FormData): Promise<StartResult> {
  await requireSuperAdmin();
  const creds = credsFrom(formData);
  if (!creds) return { ok: false, error: "Completá la URL y las dos claves" };
  try {
    const jobId = await startMigration(creds, { customers: formData.get("customers") === "on" });
    await logAdminAction("migration.start", { targetType: "migration", targetId: jobId, detail: creds.baseUrl });
    return { ok: true, jobId };
  } catch (err) {
    if (!(err instanceof WooError)) console.error("startMigration failed", err);
    return { ok: false, error: message(err) };
  }
}

export async function cancelWooMigration(jobId: string) {
  await requireSuperAdmin();
  await requestCancel(jobId);
}

// ---- Mail de activación para clientes migrados (sin contraseña) ----

const BATCH = 50;

async function pendingActivationWhere() {
  const now = new Date();
  return {
    wooId: { not: null },
    passwordHash: null,
    // No se reenvía a quien ya tiene un enlace vigente sin usar
    passwordResetTokens: { none: { usedAt: null, expiresAt: { gt: now } } },
  };
}

export async function countPendingActivation(): Promise<number> {
  await requireSuperAdmin();
  return prisma.user.count({ where: await pendingActivationWhere() });
}

export type ActivationResult = { ok: true; sent: number; failed: number; remaining: number } | { ok: false; error: string };

export async function sendActivationEmailsAction(): Promise<ActivationResult> {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({ where: await pendingActivationWhere(), orderBy: { createdAt: "asc" }, take: BATCH, select: { id: true, email: true, name: true } });
  let sent = 0;
  let failed = 0;
  for (const user of users) {
    const ok = await sendResetEmail(user, "activation").catch(() => false);
    if (ok) sent++;
    else {
      failed++;
      if (sent === 0 && failed >= 3) return { ok: false, error: "No se pudieron enviar mails. Revisá el proveedor de correo en /integraciones." };
    }
    await new Promise((r) => setTimeout(r, 150)); // no saturar el proveedor de correo
  }
  await logAdminAction("migration.activation_emails", { targetType: "migration", detail: `${sent} enviados, ${failed} fallidos` });
  revalidatePath("/admin/migracion");
  return { ok: true, sent, failed, remaining: await prisma.user.count({ where: await pendingActivationWhere() }) };
}

// ---- Deshacer la migración (solo superadministrador) ----

export async function previewUndoMigrationAction() {
  await requireSuperAdmin();
  const { previewUndo } = await import("@/lib/woo/undo");
  return previewUndo();
}

export async function undoMigrationAction(input: { confirm: string; customers: boolean }): Promise<{ ok: true; result: import("@/lib/woo/undo").UndoResult } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  if (input.confirm.trim().toUpperCase() !== "BORRAR MIGRACION") return { ok: false, error: "Escribí BORRAR MIGRACION para confirmar." };
  if (hasRunningJob()) return { ok: false, error: "Hay una migración en curso: cancelala o esperá a que termine." };
  try {
    const { undoMigration } = await import("@/lib/woo/undo");
    const result = await undoMigration({ customers: input.customers });
    await logAdminAction("migration.undo", { targetType: "migration", detail: `${result.products} productos, ${result.categories} categorías, ${result.filesDeleted} archivos`, adminEmail: session.user?.email ?? undefined });
    revalidatePath("/admin/migracion");
    revalidatePath("/admin/productos");
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (err) {
    console.error("undoMigration failed", err);
    return { ok: false, error: "No se pudo completar el borrado. Probá de nuevo." };
  }
}

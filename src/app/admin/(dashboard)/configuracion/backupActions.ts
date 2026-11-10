"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { createBackup, deleteBackup, isValidBackupName } from "@/lib/backup";

export async function createBackupNow(): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  try {
    const r = await createBackup("manual");
    await logAdminAction("backup.create", { targetType: "backup", targetId: r.name, detail: r.where === "r2" ? "Guardada en R2" : "Guardada en el disco del servidor" });
    revalidatePath("/admin/configuracion");
    return { ok: true, message: `Copia creada (${(r.size / 1024 / 1024).toFixed(1)} MB, guardada en ${r.where === "r2" ? "R2" : "el disco del servidor"}).` };
  } catch (err) {
    console.error("backup manual falló", err);
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo crear la copia" };
  }
}

export async function deleteBackupAction(name: string): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  if (!isValidBackupName(name)) return { ok: false, message: "Nombre de copia inválido" };
  try {
    await deleteBackup(name);
    await logAdminAction("backup.delete", { targetType: "backup", targetId: name });
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Copia eliminada." };
  } catch {
    return { ok: false, message: "No se pudo eliminar la copia" };
  }
}

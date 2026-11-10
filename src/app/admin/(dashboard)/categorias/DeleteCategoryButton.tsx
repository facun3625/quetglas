"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/lib/useConfirm";
import { deleteCategoryAction } from "./actions";

export function DeleteCategoryButton({ id, name, products, subcategories, redirectTo }: { id: string; name: string; products: number; subcategories: number; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const notes = [
    products > 0 ? `${products} producto${products === 1 ? "" : "s"} quedan sin esta categoría (no se borran)` : "",
    subcategories > 0 ? `${subcategories} subcategoría${subcategories === 1 ? "" : "s"} suben al nivel superior` : "",
  ].filter(Boolean);
  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({ title: `¿Eliminar la categoría “${name}”?`, message: notes.length ? `${notes.join(" y ")}.` : "No se puede deshacer.", danger: true });
          if (!ok) return;
          start(async () => {
            await deleteCategoryAction(id);
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          });
        }}
        className="cursor-pointer text-red-600 hover:underline disabled:opacity-50"
      >
        Eliminar
      </button>
    </>
  );
}

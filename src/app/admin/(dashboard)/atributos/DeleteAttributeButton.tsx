"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/lib/useConfirm";
import { deleteAttributeAction } from "./actions";

export function DeleteAttributeButton({ id, name, products, redirectTo }: { id: string; name: string; products: number; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: `¿Eliminar el atributo “${name}”?`,
            message: products > 0 ? `Lo usan ${products} producto${products === 1 ? "" : "s"}: se eliminan también sus variantes. No se puede deshacer.` : "Se eliminan también todos sus valores. No se puede deshacer.",
            danger: true,
          });
          if (!ok) return;
          start(async () => {
            await deleteAttributeAction(id);
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

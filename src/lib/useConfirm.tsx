"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Options = { title: string; message?: string; confirmLabel?: string; danger?: boolean };

// Reemplazo de window.confirm con el diálogo de la app:
//   const [confirm, dialog] = useConfirm();
//   if (!(await confirm({ title: "¿Eliminar?", danger: true }))) return;
//   ... y renderizar {dialog} en el componente.
export function useConfirm(): [(options: Options) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<Options | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: Options) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ""}
      message={options?.message}
      confirmLabel={options?.confirmLabel ?? (options?.danger ? "Eliminar" : "Aceptar")}
      danger={options?.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
  return [confirm, dialog];
}

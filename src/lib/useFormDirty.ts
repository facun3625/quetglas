import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function snapshot(form: HTMLFormElement): string {
  return Array.from(new FormData(form).entries())
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : value.name}`)
    .join("&");
}

// Detecta si el <form> más cercano a este elemento cambió respecto al
// último guardado — se usa para que el botón de "Guardar" de un item ya
// guardado (cupón, medio de envío, recompensa...) recién se destaque cuando
// hay algo nuevo para guardar. También expone `pending` y `justSaved` (unos
// segundos true apenas termina un submit) para poder confirmarle al usuario
// que el guardado realmente pasó, en vez de dejarlo adivinando.
export function useFormDirty<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const baseline = useRef<string | null>(null);
  const { pending } = useFormStatus();
  const isPending = Boolean(pending);
  const wasPending = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    // Ojo: nada de "if baseline ya está seteado, salir" acá. En desarrollo,
    // Strict Mode corre este efecto dos veces (monta → limpia → vuelve a
    // montar) — la limpieza SACA los listeners, y si este segundo montaje
    // se saltea por un guard de "ya tengo baseline", el form se queda sin
    // listeners para siempre y el botón de Guardar nunca se entera de nada.
    // Recalcular baseline en cada (re)montaje es seguro: entre limpiar y
    // volver a montar no pasó ninguna interacción real, así que da el mismo
    // valor de antes.
    baseline.current = snapshot(form);

    const handler = () => setDirty(snapshot(form) !== baseline.current);
    form.addEventListener("input", handler);
    form.addEventListener("change", handler);
    return () => {
      form.removeEventListener("input", handler);
      form.removeEventListener("change", handler);
    };
  }, []);

  // pending pasa de true a false cuando el server action termina — ahí
  // recién sabemos que el submit se resolvió, así que ahí re-fijamos la
  // base de comparación (el form ya no está "sucio") y mostramos la
  // confirmación un rato. El timer vive en un ref (no en el cleanup del
  // efecto) a propósito: después de un submit, `pending` puede volver a
  // dispararse con un valor falsy distinto (undefined) durante el refresh
  // de la página — si el timer dependiera del cleanup del efecto, ese
  // segundo disparo lo cancelaba antes de tiempo y el cartel de "Guardado"
  // quedaba pegado para siempre.
  useEffect(() => {
    if (wasPending.current && !isPending) {
      const form = ref.current?.closest("form");
      if (form) baseline.current = snapshot(form);
      setDirty(false);
      setJustSaved(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setJustSaved(false), 2200);
    }
    wasPending.current = isPending;
  }, [isPending]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return { ref, dirty, pending: isPending, justSaved };
}

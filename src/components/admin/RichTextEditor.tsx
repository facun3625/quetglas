"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BoldIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon, LinkIcon, ImageIcon } from "@/components/icons";

// Editor mínimo con document.execCommand — no es lo más moderno (está
// "deprecado" hace años sin que el browser haya sacado nada que lo
// reemplace del todo para un caso simple como este), pero para negrita,
// alineación, tamaño, link e imagen alcanza de sobra sin sumar una
// librería de edición completa. Compartido entre Mailing y el pop-up del
// sitio — cada caller pasa su propia `uploadImage` (guardan en carpetas
// distintas) en vez de que este componente sepa a qué feature pertenece.
const SIZES: Record<string, string> = {
  normal: "3",
  grande: "5",
  titulo: "6",
};

export type RichTextUploadResult = { ok: true; url: string } | { ok: false; error: string };

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // mousedown + preventDefault: si fuera onClick, el editor pierde el
      // foco/la selección de texto ANTES de que corra execCommand, y el
      // comando se aplica sobre nada.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-black/5 hover:text-brand-ink"
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  name,
  initialValue,
  onChange,
  placeholder,
  uploadImage,
  compact = false,
}: {
  name: string;
  // compact: editor más bajo (para textos cortos, como la descripción corta)
  compact?: boolean;
  initialValue?: string;
  // Opcional: cuando este editor se usa desde un Server Component (como el
  // panel del pop-up), no hay forma de pasarle una función — no se puede
  // serializar a través del límite server/client. Ahí simplemente no se
  // pasa, y el editor sigue funcionando igual (el <input hidden> es lo que
  // en verdad importa para el submit del form).
  onChange?: (html: string) => void;
  placeholder?: string;
  uploadImage: (formData: FormData) => Promise<RichTextUploadResult>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(!initialValue);

  // Sincroniza el <input hidden> con un addEventListener nativo (no el
  // onInput sintético de React) puesto DIRECTO en el contentEditable, y
  // escribe el .value a mano — no vía el prop `value` de React. Esto
  // importa por el orden de despacho del evento: el listener nativo de acá
  // corre ANTES de que el evento llegue al <form> (que está más arriba en
  // el árbol), así que cuando useFormDirty (otro listener nativo, puesto en
  // el form) lee el FormData para ver si "cambió algo", el hidden input ya
  // tiene el HTML nuevo. Si sincronizara el valor por estado de React
  // (value={html}), el re-render llega recién en el próximo tick — después
  // de que useFormDirty ya sacó la foto — y el primer tipeo no se detecta.
  useEffect(() => {
    const el = editorRef.current;
    const hidden = hiddenInputRef.current;
    if (!el || !hidden) return;

    if (initialValue) el.innerHTML = initialValue;

    function sync() {
      const next = el!.innerHTML;
      hidden!.value = next;
      setEmpty(el!.textContent?.trim() === "" && !el!.querySelector("img"));
      onChangeRef.current?.(next);
    }

    el.addEventListener("input", sync);
    return () => el.removeEventListener("input", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, value?: string) {
    const el = editorRef.current;
    el?.focus();
    document.execCommand(command, false, value);
    // execCommand no siempre dispara "input" solo (varía por browser/comando
    // como insertImage) — se dispara a mano para no depender de eso.
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Diálogo propio para el enlace (en vez del prompt del navegador). Al abrirlo se guarda la selección del texto,
  // porque escribir en el campo la pierde.
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  function handleLink() {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl("https://");
    setLinkOpen(true);
  }

  function applyLink() {
    const url = linkUrl.trim();
    setLinkOpen(false);
    if (!url || url === "https://") return;
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    exec("createLink", url);
  }

  // Bloque (párrafo / título / subtítulo)
  function handleBlock(e: ChangeEvent<HTMLSelectElement>) {
    const tag = e.target.value;
    if (tag) exec("formatBlock", tag);
    e.target.value = "";
  }

  function handleSize(e: ChangeEvent<HTMLSelectElement>) {
    const size = SIZES[e.target.value];
    if (size) exec("fontSize", size);
    e.target.value = "";
  }

  async function handleImageFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.set("image", file);
      const result = await uploadImage(formData);
      if (result.ok) {
        exec("insertImage", result.url);
      } else {
        setUploadError(result.error);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 focus-within:border-brand-pink">
      {linkOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setLinkOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-base font-bold text-brand-ink">Agregar enlace</h3>
            <p className="mt-1 text-sm text-brand-muted">Se aplica al texto que tenías seleccionado.</p>
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") setLinkOpen(false);
              }}
              placeholder="https://..."
              className="mt-4 w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setLinkOpen(false)} className="cursor-pointer rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft">Cancelar</button>
              <button type="button" onClick={applyLink} className="cursor-pointer rounded-full bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark">Agregar</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-black/5 bg-brand-soft/40 px-2 py-1.5">
        <ToolbarButton label="Deshacer" onClick={() => exec("undo")}><span className="text-sm">↶</span></ToolbarButton>
        <ToolbarButton label="Rehacer" onClick={() => exec("redo")}><span className="text-sm">↷</span></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={handleBlock}
          defaultValue=""
          aria-label="Formato del párrafo"
          className="h-8 cursor-pointer rounded-md border-0 bg-transparent px-1.5 text-xs text-brand-muted hover:bg-black/5 focus:outline-none"
        >
          <option value="" disabled>
            Formato
          </option>
          <option value="p">Párrafo</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
          <option value="blockquote">Cita</option>
        </select>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Negrita" onClick={() => exec("bold")}>
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Cursiva" onClick={() => exec("italic")}><span className="text-sm font-serif italic">I</span></ToolbarButton>
        <ToolbarButton label="Subrayado" onClick={() => exec("underline")}><span className="text-sm underline">U</span></ToolbarButton>
        <ToolbarButton label="Tachado" onClick={() => exec("strikeThrough")}><span className="text-sm line-through">S</span></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Lista con viñetas" onClick={() => exec("insertUnorderedList")}><span className="text-sm">• ≡</span></ToolbarButton>
        <ToolbarButton label="Lista numerada" onClick={() => exec("insertOrderedList")}><span className="text-xs font-semibold">1.</span></ToolbarButton>
        <ToolbarButton label="Línea separadora" onClick={() => exec("insertHorizontalRule")}><span className="text-sm">―</span></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        {[
          ["Texto negro", "#1f2937"],
          ["Texto rojo", "#e52327"],
          ["Texto verde", "#15803d"],
          ["Texto azul", "#1d4ed8"],
          ["Texto gris", "#6b7280"],
        ].map(([label, color]) => (
          <ToolbarButton key={color} label={label} onClick={() => exec("foreColor", color)}>
            <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
          </ToolbarButton>
        ))}
        <ToolbarButton label="Quitar formato" onClick={() => { exec("removeFormat"); exec("formatBlock", "p"); }}><span className="text-xs">Tx</span></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Alinear a la izquierda" onClick={() => exec("justifyLeft")}>
          <AlignLeftIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Centrar" onClick={() => exec("justifyCenter")}>
          <AlignCenterIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Alinear a la derecha" onClick={() => exec("justifyRight")}>
          <AlignRightIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={handleSize}
          defaultValue=""
          aria-label="Tamaño de texto"
          className="h-8 cursor-pointer rounded-md border-0 bg-transparent px-1.5 text-xs text-brand-muted hover:bg-black/5 focus:outline-none"
        >
          <option value="" disabled>
            Tamaño
          </option>
          <option value="normal">Normal</option>
          <option value="grande">Grande</option>
          <option value="titulo">Título</option>
        </select>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <ToolbarButton label="Insertar link" onClick={handleLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Insertar imagen" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        {uploading && <span className="ml-1 text-xs text-brand-muted">Subiendo...</span>}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
      </div>

      <div className="relative">
        {empty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-3 text-sm text-brand-ink/40">{placeholder}</p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={`rich-content ${compact ? "min-h-[90px]" : "min-h-[180px]"} px-3 py-2.5 text-sm text-brand-ink focus:outline-none`}
        />
      </div>

      {uploadError && <p className="border-t border-black/5 px-3 py-2 text-xs text-red-600">{uploadError}</p>}

      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialValue ?? ""} />
    </div>
  );
}

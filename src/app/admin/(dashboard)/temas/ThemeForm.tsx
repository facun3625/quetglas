"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isoToLocalInput, localInputToIso } from "@/lib/datetimeLocal";
import { checkVideoUrl } from "@/lib/video";
import { FONT_CHOICES, MAX_BANNERS, MAX_SLIDES, type ButtonStyle, type FontKey, type ThemeConfig, type ThemeSlide } from "@/lib/themes";
import type { CategoryItem } from "@/types/catalog";
import { probeVideo, saveTheme, type ThemeInput } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";
const card = "rounded-xl border border-black/10 bg-white p-5";

const COLOR_FIELDS: { key: keyof ThemeConfig["colors"]; label: string; hint: string }[] = [
  { key: "primary", label: "Color principal", hint: "botones y acentos" },
  { key: "primaryDark", label: "Principal oscuro", hint: "precios, enlaces, hover" },
  { key: "ink", label: "Texto", hint: "títulos y texto principal" },
  { key: "muted", label: "Texto suave", hint: "descripciones" },
  { key: "soft", label: "Fondo suave", hint: "secciones y tarjetas" },
  { key: "background", label: "Fondo general", hint: "color de fondo de la tienda" },
];

const EMPTY_SLIDE: ThemeSlide = { image: "", videoUrl: "", eyebrow: "", title: "", subtitle: "", promoText: "", buttons: [] };

async function uploadImage(file: File): Promise<string | null> {
  const body = new FormData();
  body.set("file", file);
  const res = await fetch("/api/admin/images", { method: "POST", body });
  return res.ok ? ((await res.json()) as { url: string }).url : null;
}

function ImageField({ value, onChange, label: text }: { value: string; onChange: (url: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className={label}>{text}</label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-24 rounded-lg border border-black/10 object-cover" />
        ) : (
          <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-black/20 text-[10px] text-brand-muted">sin imagen</div>
        )}
        <label className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft">
          {busy ? "Subiendo…" : value ? "Cambiar" : "Subir imagen"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              const url = await uploadImage(file);
              setBusy(false);
              if (url) onChange(url);
            }}
          />
        </label>
        {value && <button type="button" onClick={() => onChange("")} className="cursor-pointer text-xs text-red-600 hover:underline">Quitar</button>}
      </div>
    </div>
  );
}

// Video del slide: un enlace a un archivo (.mp4/.webm, Google Drive, Dropbox...) o un archivo subido a la tienda (hasta 50 MB)
function VideoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draft, setDraft] = useState(value);
  const check = draft.trim() ? checkVideoUrl(draft) : null;
  // Verificación real del enlace (qué hay detrás: ¿es un video?). El video solo se toma como válido cuando la prueba sale bien.
  const [probe, setProbe] = useState<{ state: "idle" | "checking" | "ok" | "bad"; message: string }>({ state: value ? "ok" : "idle", message: value ? "Video cargado." : "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function commit(next: string, fromUpload = false) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    const r = next.trim() ? checkVideoUrl(next) : null;
    if (!r) {
      onChange("");
      setProbe({ state: "idle", message: "" });
      return;
    }
    if ("error" in r) {
      onChange("");
      setProbe({ state: "bad", message: r.error });
      return;
    }
    if (fromUpload || r.source === "propio") {
      onChange(r.url);
      setProbe({ state: "ok", message: "Video subido a la tienda." });
      return;
    }
    onChange("");
    setProbe({ state: "checking", message: "Verificando el enlace…" });
    timer.current = setTimeout(async () => {
      const res = await probeVideo(next).catch(() => ({ ok: false, message: "No se pudo comprobar el enlace." }));
      if (res.ok) onChange(r.url);
      setProbe({ state: res.ok ? "ok" : "bad", message: res.message });
    }, 700);
  }

  async function upload(file: File) {
    setBusy(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/videos", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo subir el video");
      commit(data.url, true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el video");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={label}>Video (opcional) — enlace a un archivo de video</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${field} min-w-[240px] flex-1`}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          placeholder="https://… .mp4, enlace de Google Drive o Dropbox"
        />
        <label className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-soft">
          {busy ? "Subiendo…" : "Subir video (hasta 50 MB)"}
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {draft && (
          <button type="button" onClick={() => commit("")} className="cursor-pointer text-xs text-red-600 hover:underline">
            Quitar video
          </button>
        )}
      </div>
      {probe.state === "checking" && <p className="mt-1 text-xs text-brand-muted">{probe.message}</p>}
      {probe.state === "bad" && <p className="mt-1 text-xs font-medium text-red-600">✕ {probe.message}</p>}
      {probe.state === "ok" && (
        <p className="mt-1 text-xs font-medium text-green-700">
          ✓ {probe.message} Se reproduce de fondo, en silencio y en bucle.
        </p>
      )}
      {check && "url" in check && check.warning && probe.state !== "bad" && <p className="mt-1 text-xs text-amber-700">{check.warning}</p>}
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
      <p className="mt-1 text-xs text-brand-muted">En el celular se muestra la imagen del slide en lugar del video (ahorra datos); si no cargás imagen, también se reproduce el video.</p>
    </div>
  );
}

// Menú lateral del editor: botones que llevan a cada sección (en el celular, una barra de botones arriba) y resalta la que se está viendo
function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        // La sección activa es la visible que está más arriba
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      { rootMargin: "-10% 0px -60% 0px" }
    );
    for (const sec of sections) {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  function go(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* Escritorio: columna a la izquierda que acompaña el scroll */}
      <nav aria-label="Secciones del tema" className="sticky top-2 hidden w-52 shrink-0 lg:block">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-brand-muted">Secciones</p>
        <ul className="flex flex-col gap-1">
          {sections.map((sec) => (
            <li key={sec.id}>
              <button
                type="button"
                onClick={() => go(sec.id)}
                className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active === sec.id ? "bg-brand-pink/10 font-semibold text-brand-pink-dark" : "text-brand-muted hover:bg-brand-soft hover:text-brand-ink"
                }`}
              >
                {sec.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Celular: barra de botones fija arriba, que se desliza hacia el costado */}
      <nav aria-label="Secciones del tema" className="sticky top-0 z-20 -mx-4 -mt-5 flex gap-2 overflow-x-auto border-b border-black/10 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        {sections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => go(sec.id)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
              active === sec.id ? "border-brand-pink bg-brand-pink text-white" : "border-black/10 text-brand-ink"
            }`}
          >
            {sec.label}
          </button>
        ))}
      </nav>
    </>
  );
}

// Vista rápida del estilo elegido (colores, tipografía, botones y barra de anuncio)
function StylePreview({ c, font }: { c: ThemeConfig; font: { family: string | null } }) {
  return (
    <div className="rounded-xl border border-black/10 p-4" style={{ backgroundColor: c.colors.background }}>
      {c.announcement.enabled && c.announcement.text && (
        <div className="mb-3 rounded px-3 py-1.5 text-center text-xs font-semibold" style={{ backgroundColor: c.announcement.bg, color: c.announcement.color }}>{c.announcement.text}</div>
      )}
      <p className="text-2xl font-bold" style={{ color: c.colors.ink, fontFamily: font.family ?? undefined }}>Así se ven los títulos</p>
      <p className="mt-1 text-sm" style={{ color: c.colors.muted }}>Texto de ejemplo con el color suave de la tienda.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white" style={{ backgroundColor: c.colors.primary, borderRadius: c.buttonStyle === "pill" ? 9999 : c.buttonStyle === "rounded" ? 8 : 0 }}>Comprar</span>
        <span className="text-lg font-bold" style={{ color: c.colors.primaryDark }}>$ 12.500,00</span>
        <span className="rounded px-3 py-1 text-xs" style={{ backgroundColor: c.colors.soft, color: c.colors.ink }}>Fondo suave</span>
      </div>
    </div>
  );
}

export function ThemeForm({ initial, isBase = false, categories = [] }: { initial: ThemeInput; isBase?: boolean; categories?: CategoryItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState<ThemeInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const c = form.config;

  const setConfig = (patch: Partial<ThemeConfig>) => setForm((f) => ({ ...f, config: { ...f.config, ...patch } }));
  const setColor = (key: keyof ThemeConfig["colors"], value: string) => setConfig({ colors: { ...c.colors, [key]: value } });
  const setSlide = (i: number, patch: Partial<ThemeSlide>) => setConfig({ hero: c.hero.map((s, n) => (n === i ? { ...s, ...patch } : s)) });
  const setCategoryImage = (categoryId: string, url: string) => {
    const next = { ...c.categoryImages };
    if (url) next[categoryId] = url;
    else delete next[categoryId];
    setConfig({ categoryImages: next });
  };
  const font = FONT_CHOICES[c.headingFont];
  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  // Secciones del editor (menú lateral): el aspecto base no tiene nombre, programación ni portadas de categoría
  // (esas se cargan en Categorías; acá solo las campañas pueden reemplazarlas)
  const sections = useMemo(() => [
    ...(isBase ? [] : [{ id: "sec-titulo", label: "Título" }, { id: "sec-programacion", label: "Programación" }]),
    { id: "sec-colores", label: "Colores" },
    { id: "sec-tipografia", label: "Tipografía, botones y fondo" },
    { id: "sec-vista", label: "Así se ven los títulos" },
    { id: "sec-anuncio", label: "Barra de anuncio" },
    { id: "sec-slider", label: isBase ? "Slider de la portada" : "Slider de la campaña" },
    { id: "sec-tarjetas", label: "Tarjetas destacadas" },
    ...(isBase ? [] : [{ id: "sec-portadas", label: "Portadas de categorías" }]),
  ], [isBase]);

  function submit(activate = false) {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await saveTheme(form, activate);
      if (!result.ok) return setError(result.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 6000);
      if (activate) return router.push("/admin/temas");
      if (!form.id) router.replace(`/admin/temas/${result.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-28 lg:flex-row lg:items-start lg:gap-8">
      <SectionNav sections={sections} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
      {!isBase && <div id="sec-titulo" className={`${card} scroll-mt-4`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre del tema</label>
            <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej.: Navidad 2026" />
          </div>
          <div>
            <label className={label}>Descripción (solo para vos)</label>
            <input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </div>}

      {!isBase && <div id="sec-programacion" className={`${card} scroll-mt-4`}>
        <p className="text-sm font-semibold text-brand-ink">Programación</p>
        <p className="mb-3 text-xs text-brand-muted">
          Sin fechas, <b>Guardar y activar</b> lo muestra en la tienda desde ahora, hasta que lo desactives. Con fechas, <b>Guardar y programar</b> lo deja
          armado: entra y sale solo, y cuando termina la tienda vuelve a su aspecto de siempre. <b>Solo guardar</b> lo deja apagado.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Empieza</label>
            <input type="datetime-local" className={field} value={isoToLocalInput(form.startsAt)} onChange={(e) => setForm({ ...form, startsAt: localInputToIso(e.target.value) })} />
          </div>
          <div>
            <label className={label}>Termina</label>
            <input type="datetime-local" className={field} value={isoToLocalInput(form.endsAt)} onChange={(e) => setForm({ ...form, endsAt: localInputToIso(e.target.value) })} />
          </div>
        </div>
      </div>}

      <div id="sec-colores" className={`${card} scroll-mt-4`}>
        <p className="mb-3 text-sm font-semibold text-brand-ink">Colores</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={label}>{f.label} <span className="font-normal">· {f.hint}</span></label>
              <div className="flex items-center gap-2">
                <input type="color" value={c.colors[f.key]} onChange={(e) => setColor(f.key, e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-black/10 bg-white p-0.5" />
                <input className={`${field} font-mono`} value={c.colors[f.key]} maxLength={7} onChange={(e) => setColor(f.key, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="sec-tipografia" className={`${card} scroll-mt-4`}>
        <p className="mb-3 text-sm font-semibold text-brand-ink">Tipografía, botones y fondo</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Tipografía de los títulos</label>
            <select className={`${field} bg-white`} value={c.headingFont} onChange={(e) => setConfig({ headingFont: e.target.value as FontKey })}>
              {Object.entries(FONT_CHOICES).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Estilo de los botones</label>
            <select className={`${field} bg-white`} value={c.buttonStyle} onChange={(e) => setConfig({ buttonStyle: e.target.value as ButtonStyle })}>
              <option value="pill">Redondeados (píldora)</option>
              <option value="rounded">Bordes suaves</option>
              <option value="square">Rectos</option>
            </select>
          </div>
          <ImageField label="Imagen de fondo (opcional)" value={c.backgroundImageUrl} onChange={(url) => setConfig({ backgroundImageUrl: url })} />
        </div>
      </div>

      <div id="sec-vista" className={`${card} scroll-mt-4`}>
        <p className="mb-1 text-sm font-semibold text-brand-ink">Así se ven los títulos</p>
        <p className="mb-3 text-xs text-brand-muted">Vista rápida con los colores, la tipografía, los botones y la barra de anuncio elegidos.</p>
        <StylePreview c={c} font={font} />
      </div>

      <div id="sec-anuncio" className={`${card} scroll-mt-4`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-ink">Barra de anuncio</p>
          <label className="flex items-center gap-2 text-sm text-brand-ink">
            <input type="checkbox" checked={c.announcement.enabled} onChange={(e) => setConfig({ announcement: { ...c.announcement, enabled: e.target.checked } })} />
            Mostrar
          </label>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Texto</label>
            <input className={field} maxLength={160} value={c.announcement.text} onChange={(e) => setConfig({ announcement: { ...c.announcement, text: e.target.value } })} placeholder="Ej.: 🎄 Envíos gratis en compras desde $50.000" />
          </div>
          <div>
            <label className={label}>Enlace (opcional)</label>
            <input className={field} value={c.announcement.href} onChange={(e) => setConfig({ announcement: { ...c.announcement, href: e.target.value } })} placeholder="/tienda?ofertas=1" />
          </div>
          <div className="flex gap-4">
            <div>
              <label className={label}>Fondo</label>
              <input type="color" value={c.announcement.bg} onChange={(e) => setConfig({ announcement: { ...c.announcement, bg: e.target.value } })} className="h-9 w-14 cursor-pointer rounded border border-black/10 bg-white p-0.5" />
            </div>
            <div>
              <label className={label}>Texto</label>
              <input type="color" value={c.announcement.color} onChange={(e) => setConfig({ announcement: { ...c.announcement, color: e.target.value } })} className="h-9 w-14 cursor-pointer rounded border border-black/10 bg-white p-0.5" />
            </div>
          </div>
        </div>
      </div>

      <div id="sec-slider" className={`${card} scroll-mt-4`}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-ink">{isBase ? "Slider de la portada" : "Slider de la campaña"}</p>
            <p className="mt-1 text-xs text-brand-muted">{isBase ? "Es el slider de siempre de la tienda: se ve cuando no hay una campaña con slider propio." : "Si cargás slides, reemplazan al slider del aspecto base mientras este tema esté vigente. Si no cargás ninguno, se ve el del aspecto base."} Hasta {MAX_SLIDES} slides; cada uno necesita un título y una imagen o un video.</p>
          </div>
          {c.hero.length < MAX_SLIDES && (
            <button type="button" onClick={() => setConfig({ hero: [...c.hero, { ...EMPTY_SLIDE }] })} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark">+ Agregar slide</button>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {c.hero.map((s, i) => (
            <div key={i} className="rounded-lg border border-black/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-brand-muted">Slide {i + 1}</p>
                <button type="button" onClick={() => setConfig({ hero: c.hero.filter((_, n) => n !== i) })} className="cursor-pointer text-xs text-red-600 hover:underline">Quitar</button>
              </div>
              <ImageField label={s.videoUrl ? "Imagen de portada del video (opcional)" : "Imagen"} value={s.image} onChange={(url) => setSlide(i, { image: url })} />
              <div className="mt-3"><VideoField value={s.videoUrl} onChange={(url) => setSlide(i, { videoUrl: url })} /></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className={label}>Texto superior</label><input className={field} value={s.eyebrow} maxLength={60} onChange={(e) => setSlide(i, { eyebrow: e.target.value })} /></div>
                <div><label className={label}>Título (para 2 líneas, separalas con “/”)</label><input className={field} value={s.title.replace(/\n/g, " / ")} maxLength={80} onChange={(e) => setSlide(i, { title: e.target.value.replace(/\s*\/\s*/g, "\n") })} /></div>
                <div className="sm:col-span-2"><label className={label}>Subtítulo</label><input className={field} value={s.subtitle} maxLength={200} onChange={(e) => setSlide(i, { subtitle: e.target.value })} /></div>
                <div><label className={label}>Texto del círculo promocional</label><input className={field} value={s.promoText.replace(/\n/g, " / ")} maxLength={60} onChange={(e) => setSlide(i, { promoText: e.target.value.replace(/\s*\/\s*/g, "\n") })} placeholder="Ej.: 30% / OFF" /></div>
              </div>
              <p className={`${label} mt-3`}>Botones (hasta 3)</p>
              {[0, 1, 2].map((n) => (
                <div key={n} className="mb-2 grid gap-2 sm:grid-cols-2">
                  <input className={field} placeholder={`Botón ${n + 1}: texto`} value={s.buttons[n]?.label ?? ""} onChange={(e) => { const b = [...s.buttons]; b[n] = { label: e.target.value, href: b[n]?.href ?? "" }; setSlide(i, { buttons: b }); }} />
                  <input className={field} placeholder="Enlace (/tienda, https://…)" value={s.buttons[n]?.href ?? ""} onChange={(e) => { const b = [...s.buttons]; b[n] = { label: b[n]?.label ?? "", href: e.target.value }; setSlide(i, { buttons: b }); }} />
                </div>
              ))}
            </div>
          ))}
          {c.hero.length === 0 && <p className="text-sm text-brand-muted">{isBase ? "Todavía no cargaste slides: se muestra un slide de ejemplo." : "Sin slider propio: se usa el del aspecto base."}</p>}
        </div>
      </div>

      <div id="sec-tarjetas" className={`${card} scroll-mt-4`}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-ink">Tarjetas destacadas</p>
            <p className="mt-1 text-xs text-brand-muted">
          Tarjetas chicas con imagen, título y enlace. Se muestran en el inicio, justo arriba de “Explorá por categoría”, con un título de sección
          opcional. Hasta {MAX_BANNERS}; se reparten el ancho (máximo 4 por fila).
        </p>
          </div>
          {c.banners.length < MAX_BANNERS && (
            <button type="button" onClick={() => setConfig({ banners: [...c.banners, { image: "", title: "", href: "", alt: "" }] })} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark">+ Agregar tarjeta</button>
          )}
        </div>
        <div className="mb-4 max-w-md">
          <label className={label}>Título de la sección (opcional)</label>
          <input className={field} value={c.bannersTitle} maxLength={80} onChange={(e) => setConfig({ bannersTitle: e.target.value })} placeholder="Ej.: Lo más buscado de Halloween" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {c.banners.map((b, i) => {
            const set = (patch: Partial<(typeof c.banners)[number]>) => setConfig({ banners: c.banners.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-black/10 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-brand-muted">Tarjeta {i + 1}</p>
                  <button type="button" onClick={() => setConfig({ banners: c.banners.filter((_, n) => n !== i) })} className="cursor-pointer text-xs text-red-600 hover:underline">Quitar</button>
                </div>
                <ImageField label="Imagen" value={b.image} onChange={(url) => set({ image: url })} />
                <div><label className={label}>Título (se ve debajo de la imagen)</label><input className={field} value={b.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} placeholder="Ej.: Disfraces" />{!b.title.trim() && b.image && <p className="mt-1 text-xs text-amber-700">Sin título: la tarjeta se muestra solo con la imagen.</p>}</div>
                <div><label className={label}>Enlace</label><input className={field} value={b.href} onChange={(e) => set({ href: e.target.value })} placeholder="/tienda?ofertas=1" /></div>
              </div>
            );
          })}
          {c.banners.length === 0 && <p className="text-sm text-brand-muted sm:col-span-2 lg:col-span-3">Todavía no cargaste tarjetas. No se muestra ninguna sección.</p>}
        </div>
        {c.banners.some((b) => !b.image) && <p className="mt-3 text-xs text-amber-700">Las tarjetas sin imagen no se muestran.</p>}
      </div>

      {!isBase && (
        <div id="sec-portadas" className={`${card} scroll-mt-4`}>
          <p className="text-sm font-semibold text-brand-ink">Portadas de categorías</p>
          <p className="mt-1 text-xs text-brand-muted">
            Opcional: reemplazá la portada de una categoría solo mientras esta campaña esté activa. Si no cargás nada, se sigue viendo la del aspecto base (la que está en Categorías).
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {categories.map((cat) => {
              const parentName = cat.parentId ? categoryById.get(cat.parentId)?.name : null;
              return (
                <div key={cat.id} className="flex flex-wrap items-start gap-4 rounded-lg border border-black/10 p-3">
                  <div className="min-w-[10rem]">
                    <p className="text-sm font-medium text-brand-ink">{parentName ? `${parentName} › ${cat.name}` : cat.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-brand-muted">
                      <span>Aspecto base:</span>
                      {cat.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.imageUrl} alt="" className="h-8 w-14 rounded border border-black/10 object-cover" />
                      ) : (
                        <span>sin portada</span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-[14rem] flex-1">
                    <ImageField label="Portada para esta campaña" value={c.categoryImages[cat.id] ?? ""} onChange={(url) => setCategoryImage(cat.id, url)} />
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && <p className="text-sm text-brand-muted">No hay categorías todavía.</p>}
          </div>
        </div>
      )}

      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-black/10 bg-white px-4 py-3 md:left-56">
        {isBase ? (
          <button disabled={pending} onClick={() => submit(false)} className="cursor-pointer rounded-lg bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar aspecto base"}
          </button>
        ) : (<>
        <button disabled={pending} onClick={() => submit(true)} title={form.startsAt || form.endsAt ? "Lo guarda y queda programado con las fechas de arriba" : "Lo guarda y la tienda lo muestra desde ahora"} className="cursor-pointer rounded-lg bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
          {pending ? "Guardando…" : form.startsAt || form.endsAt ? "Guardar y programar" : "Guardar y activar"}
        </button>
        <button disabled={pending} onClick={() => submit(false)} className="cursor-pointer rounded-lg border border-black/10 px-5 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-60">
          Solo guardar
        </button>
        </>)}
        {form.id && <a href={`/api/admin/themes/preview?id=${form.id}`} className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-soft">Vista previa en la tienda</a>}
        <button onClick={() => router.push("/admin/temas")} className="cursor-pointer rounded-lg px-4 py-2.5 text-sm text-brand-muted hover:bg-black/5">Volver</button>
        {saved && <span className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">✓ Guardado correctamente</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

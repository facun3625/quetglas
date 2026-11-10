"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChatIcon, SearchIcon, PackageIcon, SalesIcon, UsersIcon, StoreIcon, UserIcon, CardIcon, TruckIcon, TagIcon, MailIcon, CartIcon, StarIcon, GearIcon, BellIcon, BellRingIcon, SendIcon, HomeIcon, ClipboardIcon, TrendUpIcon, EyeIcon, BookIcon } from "@/components/icons";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

const LINKS = [
  { href: "/admin/inicio", keywords: "panel resumen tablero alertas", label: "Inicio", icon: HomeIcon },
  { href: "/admin/productos", keywords: "articulos stock precios variantes importar exportar catalogo", label: "Productos", icon: PackageIcon },
  { href: "/admin/categorias", keywords: "rubros arbol", label: "Categorías", icon: TagIcon },
  { href: "/admin/atributos", keywords: "talles colores variantes", label: "Atributos", icon: ClipboardIcon },
  { href: "/admin/etiquetas", keywords: "marcas nuevo oferta regalo cartelitos", label: "Etiquetas", icon: TagIcon },
  { href: "/admin/migracion", keywords: "woocommerce woo importar traer", label: "Migración Woo", icon: SendIcon },
  { href: "/admin/ventas", keywords: "pedidos ordenes compras ventas rotulo oca seguimiento", label: "Ventas", icon: SalesIcon },
  { href: "/admin/estadisticas", keywords: "reportes informes ingresos metricas", label: "Estadísticas", icon: TrendUpIcon },
  { href: "/admin/visitas", keywords: "trafico analytics", label: "Visitas", icon: EyeIcon },
  { href: "/admin/carritos-abandonados", keywords: "carrito recuperar", label: "Carritos abandonados", icon: CartIcon },
  { href: "/admin/lista-espera", keywords: "avisame stock espera", label: "Lista de espera", icon: BellIcon },
  { href: "/admin/mailing", keywords: "campanas email correos masivos", label: "Mailing", icon: SendIcon },
  { href: "/admin/notificaciones", keywords: "push avisos", label: "Notificaciones", icon: BellRingIcon },
  { href: "/admin/pagos", keywords: "mercado pago transferencia tarjeta payway efectivo descuento medios", label: "Pagos", icon: CardIcon },
  { href: "/admin/envios", keywords: "oca correo envio gratis zonas codigo postal acordar retiro domicilio", label: "Envíos", icon: TruckIcon },
  { href: "/admin/cupones", keywords: "descuentos codigos promociones", label: "Cupones", icon: TagIcon },
  { href: "/admin/temas", keywords: "campanas slider banner portada colores navidad tipografia anuncio aspecto tarjetas", label: "Temas y campañas", icon: StarIcon },
  { href: "/admin/paginas", keywords: "legales terminos politicas quienes somos", label: "Páginas", icon: ClipboardIcon },
  { href: "/admin/conversaciones", keywords: "vendedora ia chat consultas telefono contacto conversaciones inteligencia artificial", label: "Conversaciones IA", icon: ChatIcon },
  { href: "/admin/mensajes", keywords: "consultas contacto formulario", label: "Mensajes", icon: MailIcon },
  { href: "/admin/contacto", keywords: "sucursales datos telefono whatsapp instagram direccion tarjetas mapa", label: "Contacto", icon: MailIcon },
  { href: "/admin/puntos", keywords: "recompensas fidelizacion", label: "Puntos", icon: StarIcon },
  { href: "/admin/usuarios?role=clientes", keywords: "cuentas compradores usuarios", label: "Clientes", icon: UsersIcon },
  { href: "/admin/usuarios?role=administradores", keywords: "admins equipo staff usuarios acceso panel contraseña", label: "Administradores", icon: UsersIcon },
  { href: "/admin/segmentos", keywords: "grupos clientes", label: "Segmentos", icon: TagIcon },
  { href: "/admin/suscriptores", keywords: "newsletter email", label: "Suscriptores", icon: MailIcon },
  { href: "/admin/logs", keywords: "historial auditoria actividad", label: "Registro", icon: ClipboardIcon },
  { href: "/admin/configuracion", keywords: "logo favicon correo smtp resend ia vendedora telegram moneda mantenimiento popup pie", label: "Configuración", icon: GearIcon },
];

type NavLink = (typeof LINKS)[number];
type NavEntry = { kind: "link"; href: string } | { kind: "group"; id: string; label: string; icon: NavLink["icon"]; items: { href: string; label?: string }[] };

// Cómo se agrupa el menú. Los ítems sueltos van directo; los grupos se despliegan y se recuerda cuáles quedaron abiertos.
const TREE: NavEntry[] = [
  { kind: "link", href: "/admin/inicio" },
  { kind: "group", id: "catalogo", label: "Catálogo", icon: PackageIcon, items: [{ href: "/admin/productos" }, { href: "/admin/categorias" }, { href: "/admin/atributos" }, { href: "/admin/etiquetas" }, { href: "/admin/migracion" }] },
  { kind: "link", href: "/admin/ventas" },
  { kind: "group", id: "estadisticas", label: "Estadísticas", icon: TrendUpIcon, items: [{ href: "/admin/estadisticas", label: "De ventas" }, { href: "/admin/visitas" }] },
  { kind: "group", id: "clientes", label: "Clientes y usuarios", icon: UsersIcon, items: [{ href: "/admin/usuarios?role=clientes" }, { href: "/admin/usuarios?role=administradores" }, { href: "/admin/segmentos" }, { href: "/admin/suscriptores" }, { href: "/admin/puntos" }] },
  { kind: "group", id: "tienda", label: "Tienda", icon: StoreIcon, items: [{ href: "/admin/pagos" }, { href: "/admin/envios" }, { href: "/admin/cupones" }, { href: "/admin/temas" }, { href: "/admin/paginas" }, { href: "/admin/contacto" }] },
  { kind: "group", id: "recuperar", label: "Recuperar clientes", icon: CartIcon, items: [{ href: "/admin/carritos-abandonados" }, { href: "/admin/lista-espera" }] },
  { kind: "link", href: "/admin/mailing" },
  { kind: "link", href: "/admin/notificaciones" },
  { kind: "link", href: "/admin/conversaciones" },
  { kind: "link", href: "/admin/mensajes" },
  { kind: "group", id: "sistema", label: "Sistema", icon: ClipboardIcon, items: [{ href: "/admin/logs" }] },
  { kind: "link", href: "/admin/configuracion" },
];
const OPEN_KEY = "admin_nav_group";

// Sin tildes ni mayúsculas, para que "configuracion" encuentre "Configuración"
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function AdminSidebar({ userLabel, logoUrl = "/logo2.png", counts, isSuper = false }: { userLabel: string; logoUrl?: string; isSuper?: boolean; counts?: { newOrders: number; unreadMessages: number; pendingConversations?: number; showMessages?: boolean } }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Un ítem puede traer filtro en la dirección (?role=…): está activo si coincide la ruta y ese filtro. En /admin/usuarios sin filtro
  // (o dentro de la ficha de un cliente) se considera "Clientes".
  const isActiveHref = (href: string) => {
    const [path, query] = href.split("?");
    if (!pathname.startsWith(path)) return false;
    if (!query) return true;
    const want = new URLSearchParams(query).get("role");
    const have = searchParams.get("role");
    return want === "clientes" ? have !== "administradores" : have === want;
  };
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  // Un solo grupo abierto a la vez: al abrir uno, el anterior se cierra (no se amontonan)
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Las transiciones arrancan después de la primera carga: al entrar, los grupos recordados aparecen ya abiertos, sin animarse
  const [animate, setAnimate] = useState(false);

  // Mensajes solo aparece si existe un formulario de contacto o ya hay mensajes (ver lib/adminCounts.ts)
  const showMessages = counts?.showMessages !== false;
  const visibleLinks = useMemo(() => LINKS.filter((l) => (l.href !== "/admin/mensajes" || showMessages) && (l.href !== "/admin/migracion" || isSuper)), [showMessages, isSuper]);

  // Buscador predictivo del menú: filtra por el nombre de la sección y por palabras relacionadas (ej. "pedidos" → Ventas)
  const matches = useMemo(() => {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return visibleLinks.filter((l) => {
      const hay = norm(`${l.label} ${l.keywords}`);
      return terms.every((t) => hay.includes(t));
    }).sort((a, b) => Number(norm(b.label).startsWith(norm(query))) - Number(norm(a.label).startsWith(norm(query))));
  }, [query, visibleLinks]);

  // Ctrl/Cmd + K enfoca el buscador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Grupo abierto: el de la pantalla actual, o el que quedó recordado en este navegador
  const activeGroupId = useMemo(() => {
    for (const e of TREE) if (e.kind === "group" && e.items.some((i) => isActiveHref(i.href))) return e.id;
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(OPEN_KEY); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroup(saved || null);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeGroupId) setOpenGroup(activeGroupId);
  }, [activeGroupId]);
  function toggleGroup(id: string) {
    const next = openGroup === id ? null : id;
    setOpenGroup(next);
    try { localStorage.setItem(OPEN_KEY, next ?? ""); } catch {}
  }

  function go(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href);
  }

  const searching = query.trim().length > 0;
  const linkByHref = (href: string) => visibleLinks.find((l) => l.href === href);

  // Un ítem del menú (suelto, dentro de un grupo o resultado de la búsqueda)
  function linkNode(link: NavLink, opts: { index?: number; nested?: boolean; label?: string } = {}) {
    const active = isActiveHref(link.href);
    const picked = searching && opts.index === highlight;
    const Icon = link.icon;
    // Números a la derecha: pedidos nuevos (sin ver) en Ventas, mensajes sin leer y conversaciones de IA con contacto por revisar
    const n = link.href === "/admin/ventas" ? counts?.newOrders : link.href === "/admin/mensajes" ? counts?.unreadMessages : link.href === "/admin/conversaciones" ? counts?.pendingConversations : 0;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => {
          setQuery("");
          setOpen(false);
        }}
        className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:min-h-0 md:px-2 md:py-1.5 md:text-[12px] ${opts.nested ? "md:py-1" : ""} ${
          picked
            ? "bg-brand-pink/10 text-brand-pink-dark ring-1 ring-brand-pink"
            : active
            ? "bg-brand-pink/10 text-brand-pink-dark md:bg-brand-pink md:text-white"
            : "text-brand-ink/80 hover:bg-black/[0.04] hover:text-brand-ink"
        }`}
      >
        {!opts.nested && <Icon className="h-4 w-4 shrink-0 md:h-3 md:w-3" />}
        <span className="min-w-0 flex-1 truncate">{opts.label ?? link.label}</span>
        {n ? (
          <span className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-white text-brand-pink-dark" : "bg-brand-pink text-white"}`}>{n > 99 ? "99+" : n}</span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside className="relative z-50 flex w-full shrink-0 flex-col border-b border-black/5 bg-white px-3 py-2 md:h-full md:w-56 md:border-0 md:border-r md:border-black/10 md:bg-white md:py-3">
      <div className="flex min-h-11 shrink-0 items-center justify-between px-1 md:mb-2.5 md:justify-center md:px-3 md:py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo de la tienda" className="h-9 w-auto md:h-8" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Cerrar menú del panel" : "Abrir menú del panel"}
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-soft md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-full max-h-[calc(100dvh-3.75rem)] flex-col border-b border-black/10 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl md:static md:flex md:min-h-0 md:flex-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <div className="relative shrink-0 py-2 md:pb-2 md:pt-0">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted md:top-[calc(50%-0.25rem)]" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && matches[highlight]) {
                e.preventDefault();
                go(matches[highlight].href);
              } else if (e.key === "Escape") {
                setQuery("");
              }
            }}
            placeholder="Buscar en el panel…  (Ctrl K)"
            aria-label="Buscar una sección del panel"
            className="w-full rounded-lg border border-black/10 bg-white py-2 pl-8 pr-2 text-xs text-brand-ink placeholder:text-brand-muted focus:border-brand-pink focus:outline-none md:bg-black/[0.03] md:py-1.5"
          />
        </div>

        <nav className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pb-2 md:pb-0">
        {searching && matches.length === 0 && <p className="px-3 py-2 text-xs text-brand-muted md:px-2">Sin resultados para “{query}”.</p>}
        {searching
          ? matches.map((link, index) => linkNode(link, { index }))
          : TREE.map((entry) => {
              if (entry.kind === "link") {
                const link = linkByHref(entry.href);
                return link ? linkNode(link) : null;
              }
              const items = entry.items.map((i) => ({ link: linkByHref(i.href), label: i.label })).filter((i): i is { link: NavLink; label: string | undefined } => Boolean(i.link));
              if (items.length === 0) return null;
              const isOpen = openGroup === entry.id;
              const holdsActive = entry.id === activeGroupId;
              const GroupIcon = entry.icon;
              return (
                <div key={entry.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.id)}
                    aria-expanded={isOpen}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors md:min-h-0 md:px-2 md:py-1.5 md:text-[12px] ${
                      holdsActive && !isOpen ? "text-brand-pink-dark" : "text-brand-ink/80 hover:bg-black/[0.04] hover:text-brand-ink"
                    }`}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0 md:h-3 md:w-3" />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-brand-muted ${animate ? "transition-transform duration-300 ease-out motion-reduce:transition-none" : ""} ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {/* El alto se anima con grid-rows (0fr → 1fr): se despliega suave sin medir nada, y cerrado no se puede tabular */}
                  <div
                    inert={!isOpen}
                    className={`grid ${animate ? "transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none" : ""} ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      <div className={`ml-4 flex flex-col gap-px border-l border-black/10 pl-1.5 md:ml-3.5 ${animate ? "transition-transform duration-300 ease-out motion-reduce:transition-none" : ""} ${isOpen ? "translate-y-0" : "-translate-y-1.5"}`}>
                        {items.map(({ link, label }) => linkNode(link, { nested: true, label }))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </nav>

        <div className="mt-1.5 flex shrink-0 flex-col gap-px border-t border-black/5 pt-1.5">
        <p className="flex items-center gap-2 px-2 py-1 text-xs text-brand-ink/80">
          <UserIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{userLabel}</span>
        </p>
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-brand-ink/80 transition-colors hover:bg-black/[0.04] hover:text-brand-ink"
        >
          <StoreIcon className="h-3.5 w-3.5 shrink-0" />
          Volver al sitio
        </Link>
        {/* El manual se abre aparte para no perder el lugar en el panel */}
        <a
          href="/manual"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-brand-ink/80 transition-colors hover:bg-black/[0.04] hover:text-brand-ink"
        >
          <BookIcon className="h-3.5 w-3.5 shrink-0" />
          Manual de uso
        </a>
        <AdminLogoutButton />
        </div>
      </div>
    </aside>
  );
}

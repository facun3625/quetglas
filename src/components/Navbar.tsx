"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { UserIcon, CartIcon, SearchIcon, StoreIcon, DashboardIcon, StarIcon, LogoutIcon, PackageIcon, HeartIcon, MapPinIcon, MailIcon, WhatsAppIcon, InstagramIcon } from "@/components/icons";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useAuthModal } from "@/lib/authModal";
import { useProductSuggestions } from "@/lib/useProductSuggestions";
import { SearchSuggestions } from "@/components/SearchSuggestions";
import { TopContactBar } from "@/components/TopContactBar";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import type { SiteSettings } from "@/lib/settings";

const BASE_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#donde-estamos", label: "Dónde estamos" },
  { href: "/#contacto", label: "Contacto" },
  { href: "/tienda", label: "Tienda" },
];

// Menú: los links fijos + las páginas publicadas que se tildaron "Mostrar en el menú" (antes de "Tienda", que va como botón).
// Si una página se llama igual que un link fijo (por ejemplo "Contacto") no se repite.
// En pantallas grandes entra 1 página en la barra; si hay más, van juntas bajo "Más" para que el menú no se desborde.
const MAX_INLINE_PAGES = 1;
function buildLinks(pages: { slug: string; title: string }[]) {
  const taken = new Set(BASE_LINKS.map((l) => l.label.toLowerCase()));
  const extra = pages.filter((p) => !taken.has(p.title.trim().toLowerCase())).map((p) => ({ href: `/pagina/${p.slug}`, label: p.title }));
  const tienda = BASE_LINKS[BASE_LINKS.length - 1];
  const fixed = BASE_LINKS.slice(0, -1);
  return {
    all: [...fixed, ...extra, tienda],
    desktop: [...fixed, ...extra.slice(0, MAX_INLINE_PAGES), tienda],
    more: extra.slice(MAX_INLINE_PAGES),
  };
}

function NavbarSearch({ className }: { className: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { suggestions, loading, active } = useProductSuggestions(query);

  function go(q: string) {
    const trimmed = q.trim();
    if (trimmed) router.push(`/tienda?q=${encodeURIComponent(trimmed)}`);
    setFocused(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(query);
      }}
      className={`relative ${className}`}
    >
      <label className="flex items-center gap-2 rounded-full border border-transparent bg-brand-soft px-3.5 py-2 text-brand-ink/70 focus-within:border-brand-pink focus-within:bg-white">
        <SearchIcon className="h-4 w-4 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Buscar productos..."
          className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-ink/40 focus:outline-none"
        />
      </label>
      {focused && active && (
        <SearchSuggestions suggestions={suggestions} loading={loading} onSelect={go} />
      )}
    </form>
  );
}

export function Navbar({ settings }: { settings: SiteSettings }) {
  const { all: LINKS, desktop: DESKTOP_LINKS, more: MORE_LINKS } = buildLinks(settings.menuPages);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"inicio" | "donde-estamos" | "contacto">("inicio");
  const pathname = usePathname();
  const { data: session } = useSession();
  const { count, openCart } = useCart();
  const { ids: favoriteIds } = useFavorites();
  const { openLogin } = useAuthModal();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;

    function onScroll() {
      const donde = document.getElementById("donde-estamos");
      const contacto = document.getElementById("contacto");
      const scrollPos = window.scrollY + 150;
      // getBoundingClientRect() + scrollY, no offsetTop: offsetTop es
      // relativo al ancestro posicionado más cercano (puede no ser el body
      // si hay algún `relative` en el medio), y daba resultados incorrectos.
      let next: "inicio" | "donde-estamos" | "contacto" = "inicio";
      if (donde && scrollPos >= donde.getBoundingClientRect().top + window.scrollY) next = "donde-estamos";
      if (contacto && scrollPos >= contacto.getBoundingClientRect().top + window.scrollY) next = "contacto";
      setActiveSection(next);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Mismo horario que la vendedora IA (ver /admin/configuracion) — el
  // WhatsApp del menú mobile no tiene sentido ofrecerlo fuera de horario.
  const whatsappAvailable = settings.assistant.humanSeller.available && Boolean(settings.assistant.humanSeller.whatsappUrl);

  function isActive(href: string) {
    if (pathname !== "/") return false;
    if (href === "/") return activeSection === "inicio";
    if (href === "/#donde-estamos") return activeSection === "donde-estamos";
    if (href === "/#contacto") return activeSection === "contacto";
    return false;
  }

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (pathname !== "/") return;
    if (href === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (href.startsWith("/#")) {
      e.preventDefault();
      document.getElementById(href.slice(2))?.scrollIntoView({ behavior: "smooth" });
    }
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50">
      <TopContactBar settings={settings} />

      {/* Barra principal */}
      <div className="border-b border-black/5 bg-white px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-4">
          <button
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center text-brand-ink lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>

          <Link href="/" className="min-w-0 shrink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logos.header} alt={settings.franchiseName} className="h-10 w-auto max-w-[100px] object-contain sm:h-16 sm:max-w-none lg:h-12 xl:h-16" />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-4 lg:flex xl:gap-6 2xl:gap-8">
            {DESKTOP_LINKS.map((link) => {
              const active = isActive(link.href);
              const isTienda = link.href === "/tienda";
              return (
                <Fragment key={link.href}>
                {isTienda && MORE_LINKS.length > 0 && (
                  <div className="group relative">
                    <button type="button" className="flex cursor-pointer items-center gap-1 whitespace-nowrap py-2 text-[11px] font-medium uppercase tracking-wider text-brand-ink/70 transition-colors hover:text-brand-pink-dark group-focus-within:text-brand-pink-dark xl:text-xs xl:tracking-widest" aria-haspopup="menu">
                      Más
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
                    </button>
                    <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      <div className="rounded-xl border border-black/10 bg-white p-1.5 shadow-lg">
                        {MORE_LINKS.map((m) => (
                          <Link key={m.href} href={m.href} className="block rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wide text-brand-ink hover:bg-brand-soft">
                            {m.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <Link
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={
                    isTienda
                      ? "flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-pink px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-pink-dark"
                      : `relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap py-2 text-[11px] font-medium uppercase tracking-wider transition-colors xl:text-xs xl:tracking-widest ${
                          active ? "text-brand-pink-dark" : "text-brand-ink/70 hover:text-brand-pink-dark"
                        }`
                  }
                >
                  {isTienda && <StoreIcon className="h-3.5 w-3.5 shrink-0" />}
                  {link.label}
                  {active && !isTienda && (
                    <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-brand-pink-dark" />
                  )}
                </Link>
                </Fragment>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-3 lg:flex-none">
            {/* En /tienda ya está el buscador de ShopControls, sincronizado
                con el filtro actual — repetirlo acá era espacio duplicado. */}
            {pathname !== "/tienda" && <NavbarSearch className="hidden max-w-[220px] flex-1 sm:block lg:max-w-[130px] xl:max-w-[170px] 2xl:max-w-[220px]" />}

            {/* Solo en mobile/tablet — en desktop ya está la versión pill en
                el footer, no hace falta duplicarla acá al lado del buscador. */}
            <div className="lg:hidden">
              <InstallPwaButton variant="icon" />
            </div>

            {(session?.user?.role === "admin" || session?.user?.role === "superadmin") && (
              <Link
                href="/admin/inicio"
                title="Panel de administración"
                className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark min-[400px]:flex sm:h-9 sm:w-9"
              >
                <DashboardIcon className="h-4.5 w-4.5" />
              </Link>
            )}

            {session ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  title="Mi cuenta"
                  aria-expanded={profileOpen}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark sm:h-9 sm:w-9"
                >
                  <UserIcon className="h-4.5 w-4.5" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-2xl border border-black/10 bg-white p-2 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-brand-ink">
                        {session.user?.name || "Mi cuenta"}
                      </p>
                      <p className="truncate text-xs text-brand-muted">{session.user?.email}</p>
                    </div>
                    <div className="my-1 border-t border-black/5" />
                    <Link
                      href="/mi-cuenta/pedidos"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft"
                    >
                      <PackageIcon className="h-4 w-4 shrink-0" />
                      Mis pedidos
                    </Link>
                    <Link
                      href="/mi-cuenta/puntos"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft"
                    >
                      <StarIcon className="h-4 w-4 shrink-0" />
                      Mis puntos
                    </Link>
                    <Link
                      href="/mi-cuenta/favoritos"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft"
                    >
                      <HeartIcon className="h-4 w-4 shrink-0" />
                      Mis favoritos
                    </Link>
                    <Link
                      href="/mi-cuenta/direcciones"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft"
                    >
                      <PackageIcon className="h-4 w-4 shrink-0" />
                      Mis direcciones
                    </Link>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogoutIcon className="h-4 w-4 shrink-0" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openLogin}
                title="Iniciar sesión"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark sm:h-9 sm:w-9"
              >
                <UserIcon className="h-4.5 w-4.5" />
              </button>
            )}

            {session ? (
              <Link
                href="/mi-cuenta/favoritos"
                title="Mis favoritos"
                className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark sm:h-9 sm:w-9"
              >
                <HeartIcon className="h-4.5 w-4.5" />
                {favoriteIds.size > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-pink-dark text-[10px] font-semibold text-white">
                    {favoriteIds.size}
                  </span>
                )}
              </Link>
            ) : (
              <button
                onClick={openLogin}
                title="Mis favoritos"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark sm:h-9 sm:w-9"
              >
                <HeartIcon className="h-4.5 w-4.5" />
              </button>
            )}

            <button
              onClick={openCart}
              title="Carrito"
              className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark sm:h-9 sm:w-9"
            >
              <CartIcon className="h-4.5 w-4.5" />
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-pink-dark text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {pathname !== "/tienda" && <NavbarSearch className="mx-auto mt-3 max-w-6xl sm:hidden" />}
      </div>

      {/* Drawer del menú mobile — mismo patrón que el carrito (overlay +
          panel que desliza), pero desde la izquierda; antes era una lista
          plana que empujaba el contenido de abajo, se veía muy pobre. */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="menu-overlay"
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              key="menu-panel"
              className="fixed left-0 top-0 z-[70] flex h-[100dvh] w-full max-w-[320px] flex-col bg-white shadow-xl lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logos.header} alt={settings.franchiseName} className="h-8 w-auto" />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar menú"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-ink hover:bg-brand-soft"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
                {(session?.user?.role === "admin" || session?.user?.role === "superadmin") && (
                  <Link
                    href="/admin/inicio"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium uppercase tracking-wide text-brand-ink hover:bg-brand-soft min-[400px]:hidden"
                  >
                    <DashboardIcon className="h-4 w-4 shrink-0" />
                    Panel de administración
                  </Link>
                )}
                {LINKS.map((link) => {
                  const isTienda = link.href === "/tienda";
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium uppercase tracking-wide ${
                        isTienda ? "text-brand-pink-dark hover:bg-brand-pink/5" : "text-brand-ink hover:bg-brand-soft"
                      }`}
                    >
                      {isTienda && <StoreIcon className="h-4 w-4 shrink-0" />}
                      {link.label}
                    </Link>
                  );
                })}

                <div className="mt-4 border-t border-black/10 pt-4">
                  <p className="px-3 text-xs font-semibold uppercase tracking-widest text-brand-muted">Contacto</p>
                  <div className="mt-3 flex flex-col gap-3 px-3 text-sm text-brand-ink">
                    {settings.address && (
                      <div className="flex items-center gap-2.5">
                        <MapPinIcon className="h-4 w-4 shrink-0 text-brand-muted" />
                        <span>{settings.address}</span>
                      </div>
                    )}
                    {/* Mismo horario configurado para la vendedora IA (ver
                        /admin/configuracion → horario de WhatsApp) — fuera de
                        esas horas no tiene sentido invitar a escribir. */}
                    {!settings.whatsappNumber ? null : whatsappAvailable ? (
                      <a
                        href={settings.assistant.humanSeller.whatsappUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 hover:text-brand-pink-dark"
                      >
                        <WhatsAppIcon className="h-4 w-4 shrink-0 text-brand-muted" />
                        {settings.whatsappNumber}
                      </a>
                    ) : (
                      <div title={`Fuera de horario — ${settings.assistant.humanSeller.scheduleText}`} className="flex items-center gap-2.5 text-brand-ink/40">
                        <WhatsAppIcon className="h-4 w-4 shrink-0" />
                        {settings.whatsappNumber} (fuera de horario)
                      </div>
                    )}
                    {settings.contactEmail && (
                      <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2.5 hover:text-brand-pink-dark">
                        <MailIcon className="h-4 w-4 shrink-0 text-brand-muted" />
                        {settings.contactEmail}
                      </a>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 px-3">
                    {!settings.whatsappNumber ? null : whatsappAvailable ? (
                      <a
                        href={settings.assistant.humanSeller.whatsappUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-brand-ink hover:border-brand-pink hover:text-brand-pink-dark"
                      >
                        <WhatsAppIcon className="h-4.5 w-4.5" />
                      </a>
                    ) : (
                      <div
                        title={`Fuera de horario — ${settings.assistant.humanSeller.scheduleText}`}
                        className="flex h-10 w-10 shrink-0 cursor-default items-center justify-center rounded-full border border-black/10 text-brand-ink/30"
                      >
                        <WhatsAppIcon className="h-4.5 w-4.5" />
                      </div>
                    )}
                    {settings.instagramHandle && (
                      <a
                        href={`https://instagram.com/${settings.instagramHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-brand-ink hover:border-brand-pink hover:text-brand-pink-dark"
                      >
                        <InstagramIcon className="h-4.5 w-4.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

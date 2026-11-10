"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getCartSessionId } from "@/lib/cartSession";

export type CartItem = {
  productId: string;
  // null para productos simples; id de la variante para los variables.
  variantId: string | null;
  name: string;
  // Descripción de la variante elegida ("Rojo / M"), solo para mostrar.
  variantLabel?: string;
  price: number;
  image: string | null;
  quantity: number;
  maxStock: number;
  // Se usa para las recomendaciones "También te puede gustar" del carrito.
  categoryId?: string;
};

// Una línea del carrito es producto + variante.
export function cartKey(item: { productId: string; variantId: string | null }): string {
  return `${item.productId}:${item.variantId ?? ""}`;
}

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  count: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  // El cliente tocó algo dentro del carrito: no se cierra solo
  keepCartOpen: () => void;
  recoveryPhone: string;
  recoveryPromptOpen: boolean;
  saveRecoveryPhone: (phone: string) => void;
  dismissRecoveryPrompt: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "shop_cart_v2";
const RECOVERY_PHONE_KEY = "cortopassi_cart_recovery_phone";
const RECOVERY_PROMPT_KEY = "cortopassi_cart_recovery_prompt";

export function CartProvider({ children, autoCloseSeconds = 2 }: { children: React.ReactNode; autoCloseSeconds?: number }) {
  const { data: session, status: sessionStatus } = useSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryPromptOpen, setRecoveryPromptOpen] = useState(false);
  const [recoveryPromptHandled, setRecoveryPromptHandled] = useState(false);
  const hadCartItems = useRef(false);
  // Al agregar un producto el carrito se muestra un momento para confirmar y se cierra solo, así se puede seguir comprando
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAutoClose() {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = null;
  }

  useEffect(() => clearAutoClose, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CartItem[] = JSON.parse(raw);
        setItems(
          parsed
            .filter((i) => typeof i.productId === "string")
            .map((i) => ({ ...i, variantId: i.variantId ?? null, maxStock: i.maxStock ?? Infinity }))
        );
      }
      setRecoveryPhone(localStorage.getItem(RECOVERY_PHONE_KEY) ?? "");
      setRecoveryPromptHandled(localStorage.getItem(RECOVERY_PROMPT_KEY) === "handled");
    } catch {
      // localStorage no disponible o dato corrupto: arrancamos con carrito vacío
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // El dato se conserva solamente durante la vida de este carrito. Al
  // vaciarlo (a mano o después de comprar) también se olvida la decisión del
  // pop-up, para que un carrito futuro pueda volver a ofrecer la ayuda.
  useEffect(() => {
    if (!hydrated) return;
    if (items.length > 0) {
      hadCartItems.current = true;
      return;
    }
    if (!hadCartItems.current) return;
    hadCartItems.current = false;
    setRecoveryPhone("");
    setRecoveryPromptHandled(false);
    setRecoveryPromptOpen(false);
    localStorage.removeItem(RECOVERY_PHONE_KEY);
    localStorage.removeItem(RECOVERY_PROMPT_KEY);
  }, [items.length, hydrated]);

  // Link de recuperación (?recuperar=<id>, el que se manda por WhatsApp): vuelve a cargar
  // los productos del carrito abandonado en este navegador, sumándolos a los que ya hubiera.
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("recuperar");
    if (!id) return;
    url.searchParams.delete("recuperar");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    fetch(`/api/cart/recover?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data: { items?: CartItem[] }) => {
        const recovered = data.items ?? [];
        if (recovered.length === 0) return;
        setItems((prev) => [...prev, ...recovered.filter((r) => !prev.some((p) => cartKey(p) === cartKey(r)))]);
      })
      .catch(() => {});
  }, [hydrated]);

  // Se sincroniza solo, en silencio, con cada cambio del carrito — no hay
  // "detector de abandono": es solo una foto del último estado conocido. El
  // endpoint borra el registro si el carrito quedó vacío (por eso comprar y
  // vaciar el carrito no deja un "abandonado" fantasma).
  useEffect(() => {
    if (!hydrated) return;
    const handle = setTimeout(() => {
      const sessionId = getCartSessionId();
      if (!sessionId) return;
      const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: session?.user?.id,
          email: session?.user?.email,
          name: session?.user?.name,
          phone: recoveryPhone || undefined,
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, price: i.price, quantity: i.quantity })),
          total,
        }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
  }, [items, hydrated, recoveryPhone, session?.user?.id, session?.user?.email, session?.user?.name]);

  function addItem(item: Omit<CartItem, "quantity">, quantity = 1) {
    setItems((prev) => {
      if (prev.length === 0 && sessionStatus === "unauthenticated" && !recoveryPromptHandled && !recoveryPhone) setRecoveryPromptOpen(true);
      const key = cartKey(item);
      const existing = prev.find((i) => cartKey(i) === key);
      if (existing) {
        return prev.map((i) =>
          cartKey(i) === key ? { ...i, quantity: Math.min(i.quantity + quantity, i.maxStock) } : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(quantity, item.maxStock) }];
    });
    setIsOpen(true);
    clearAutoClose();
    if (autoCloseSeconds > 0) autoCloseTimer.current = setTimeout(() => setIsOpen(false), autoCloseSeconds * 1000);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => cartKey(i) !== key));
  }

  function setQuantity(key: string, quantity: number) {
    if (quantity <= 0) return removeItem(key);
    setItems((prev) =>
      prev.map((i) => (cartKey(i) === key ? { ...i, quantity: Math.min(quantity, i.maxStock) } : i))
    );
  }

  function clear() {
    setItems([]);
  }

  function saveRecoveryPhone(phone: string) {
    const clean = phone.trim();
    setRecoveryPhone(clean);
    setRecoveryPromptHandled(true);
    setRecoveryPromptOpen(false);
    localStorage.setItem(RECOVERY_PHONE_KEY, clean);
    localStorage.setItem(RECOVERY_PROMPT_KEY, "handled");
  }

  function dismissRecoveryPrompt() {
    setRecoveryPromptHandled(true);
    setRecoveryPromptOpen(false);
    localStorage.setItem(RECOVERY_PROMPT_KEY, "handled");
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        setQuantity,
        clear,
        count,
        total,
        isOpen,
        openCart: () => {
          clearAutoClose();
          setIsOpen(true);
        },
        closeCart: () => {
          clearAutoClose();
          setIsOpen(false);
        },
        keepCartOpen: clearAutoClose,
        recoveryPhone,
        recoveryPromptOpen,
        saveRecoveryPhone,
        dismissRecoveryPrompt,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

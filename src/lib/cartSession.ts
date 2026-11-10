const SESSION_KEY = "cortopassi_cart_session";

// Id anónimo persistente por navegador, usado para agrupar el carrito de un
// visitante en AbandonedCart aunque nunca haya iniciado sesión.
export function getCartSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

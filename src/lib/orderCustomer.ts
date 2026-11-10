// Datos del comprador que llegan del checkout (compartido entre las rutas que crean pedidos).
export type OrderCustomer = {
  name: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
};

// Datos extra que pide el checkout (OCA los necesita para registrar el envío)
// Nombres de los campos tal cual están en el pedido (Order.contactFirstName, etc.), para poder volcarlos directo al crearlo
export type OrderContact = { contactFirstName: string | null; contactLastName: string | null; contactDni: string | null };

export function contactFromCustomer(customer: OrderCustomer & { firstName?: string; lastName?: string; dni?: string }): OrderContact {
  const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return { contactFirstName: clean(customer.firstName, 60), contactLastName: clean(customer.lastName, 60), contactDni: clean(customer.dni, 20) };
}

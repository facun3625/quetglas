import { NextResponse } from "next/server";
import { recoverCartItems } from "@/lib/cartRecovery";

// Devuelve solo productos (nunca email ni teléfono). El id del carrito es el "permiso":
// es el que va en el link que se manda por WhatsApp.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await recoverCartItems(id) });
}

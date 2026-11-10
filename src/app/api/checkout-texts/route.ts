import { NextResponse } from "next/server";
import { getCheckoutTexts } from "@/lib/checkoutTexts";

// Público: solo textos que el admin quiere mostrarle al cliente
export async function GET() {
  const { notice } = await getCheckoutTexts();
  return NextResponse.json({ notice });
}

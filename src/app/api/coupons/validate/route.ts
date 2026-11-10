import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupons";

export async function POST(req: Request) {
  const body = await req.json();
  const { code, subtotal, paymentMethod, items, email } = body as {
    code: string;
    email?: string;
    subtotal: number;
    paymentMethod?: string;
    items: { productId: string; quantity: number }[];
  };

  if (!code || typeof subtotal !== "number" || !items?.length) {
    return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });
  }

  const session = await auth();
  const result = await validateCoupon(code, { subtotal, paymentMethod, items, userId: session?.user?.id, customerEmail: email });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

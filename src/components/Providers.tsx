"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModalProvider } from "@/lib/authModal";
import { AuthModal } from "@/components/AuthModal";
import { FavoritesProvider } from "@/lib/favorites";
import { CouponCapture } from "@/components/CouponCapture";
import { CurrencyProvider, type CurrencyCode } from "@/lib/currency";
import { CartRecoveryPrompt } from "@/components/CartRecoveryPrompt";

export function Providers({ children, currency, cartAutoCloseSeconds }: { children: React.ReactNode; currency: CurrencyCode; cartAutoCloseSeconds: number }) {
  return (
    <SessionProvider>
      <CurrencyProvider currency={currency}>
      <FavoritesProvider>
        <CartProvider autoCloseSeconds={cartAutoCloseSeconds}>
          <AuthModalProvider>
            <CouponCapture />
            {children}
            <CartDrawer />
            <CartRecoveryPrompt />
            <AuthModal />
          </AuthModalProvider>
        </CartProvider>
      </FavoritesProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}

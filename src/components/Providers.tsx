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
import { ProductDisplayProvider } from "@/components/PriceExtras";
import { DEFAULT_PRODUCT_DISPLAY, type ProductDisplay } from "@/lib/productDisplay";

export function Providers({ children, currency, cartAutoCloseSeconds, productDisplay = DEFAULT_PRODUCT_DISPLAY }: { children: React.ReactNode; currency: CurrencyCode; cartAutoCloseSeconds: number; productDisplay?: ProductDisplay }) {
  return (
    <SessionProvider>
      <CurrencyProvider currency={currency}>
      <ProductDisplayProvider value={productDisplay}>
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
      </ProductDisplayProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}

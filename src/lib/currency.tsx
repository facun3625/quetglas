"use client";

import { createContext, useContext } from "react";
import { formatMoneyWith, type CurrencyCode } from "@/lib/money";

export { formatMoneyWith, type CurrencyCode } from "@/lib/money";

const CurrencyContext = createContext<CurrencyCode>("ARS");

export function CurrencyProvider({ currency, children }: { currency: CurrencyCode; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useMoney() {
  const currency = useContext(CurrencyContext);
  return { currency, formatMoney: (amount: number) => formatMoneyWith(amount, currency) };
}

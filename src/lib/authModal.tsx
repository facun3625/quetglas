"use client";

import { createContext, useContext, useState } from "react";

type AuthModalMode = "login" | "registro";

type AuthModalContextValue = {
  isOpen: boolean;
  mode: AuthModalMode;
  openLogin: () => void;
  openRegistro: () => void;
  setMode: (mode: AuthModalMode) => void;
  close: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        mode,
        openLogin: () => {
          setMode("login");
          setIsOpen(true);
        },
        openRegistro: () => {
          setMode("registro");
          setIsOpen(true);
        },
        setMode,
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal debe usarse dentro de <AuthModalProvider>");
  return ctx;
}

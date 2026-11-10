"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/admin/PasswordField";
import { createAdminUser } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

// Alta de un administrador de la tienda, o de una cuenta genérica de sucursal
// (sin panel, solo /cupon-rapido) — con su email y una contraseña inicial.
export function NewAdminForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: "admin" | "couponStaff" }>({
    name: "",
    email: "",
    password: "",
    role: "admin",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await createAdminUser(form);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setForm({ name: "", email: "", password: "", role: "admin" });
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg bg-brand-pink px-3 py-2 text-xs font-semibold text-white hover:bg-brand-pink-dark">
        + Nueva cuenta
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="text-base font-bold text-brand-ink">Nueva cuenta</h3>
        <p className="mt-1 text-sm text-brand-muted">
          {form.role === "admin"
            ? "Va a poder entrar al panel de la tienda con su email y esta contraseña (la puede cambiar con “Olvidé mi contraseña”). Si el email ya tiene una cuenta, esa cuenta pasa a ser administradora."
            : "Cuenta genérica para compartir en el local: al entrar, solo ve la pantalla de generar un cupón rápido para WhatsApp — no tiene acceso al panel ni a nada más. Si el email ya tiene una cuenta, esa cuenta pasa a tener solo este acceso."}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className={label}>Categoría</label>
            <select className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "couponStaff" })}>
              <option value="admin">Administrador (panel completo)</option>
              <option value="couponStaff">Cupón rápido (solo esa pantalla, sin panel)</option>
            </select>
          </div>
          <div><label className={label}>Nombre</label><input className={field} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={label}>Email</label><input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" /></div>
          <div>
            <label className={label}>Contraseña inicial (mínimo 8 caracteres)</label>
            <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </div>
        {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft">Cerrar</button>
          <button type="button" disabled={pending || !form.email.trim()} onClick={submit} className="cursor-pointer rounded-full bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50">
            {pending ? "Creando…" : form.role === "admin" ? "Crear administrador" : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

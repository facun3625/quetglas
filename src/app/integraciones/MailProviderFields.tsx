"use client";

import { useState } from "react";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-semibold text-brand-muted";

type Props = {
  provider: "smtp" | "resend";
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    passwordConfigured: boolean;
  };
  resendConfigured: boolean;
};

// Selector de proveedor de mail. Los dos bloques (SMTP / Resend) quedan
// montados siempre y solo se oculta el inactivo, así al guardar no se pisa la
// config del proveedor que no estás usando (podés volver a cambiar sin
// recargar todo).
export function MailProviderFields({ provider, smtp, resendConfigured }: Props) {
  const [selected, setSelected] = useState<"smtp" | "resend">(provider);

  const optionClass = (value: "smtp" | "resend") =>
    `cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
      selected === value
        ? "border-brand-pink bg-brand-pink/5 text-brand-pink-dark"
        : "border-black/10 text-brand-muted hover:border-black/20"
    }`;

  return (
    <>
      <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Proveedor de envío</p>
      <div className="flex flex-wrap gap-2">
        {(["smtp", "resend"] as const).map((value) => (
          <label key={value} className={optionClass(value)}>
            <input
              type="radio"
              name="mailProvider"
              value={value}
              checked={selected === value}
              onChange={() => setSelected(value)}
              className="sr-only"
            />
            {value === "smtp" ? "SMTP propio" : "Resend"}
          </label>
        ))}
      </div>

      {/* Bloque SMTP */}
      <div hidden={selected !== "smtp"}>
        <p className={`${labelClasses} mt-4`}>Servidor SMTP</p>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <label className={labelClasses}>Host</label>
            <input type="text" name="smtpHost" defaultValue={smtp.host} placeholder="smtp.gmail.com" className={fieldClasses} />
          </div>
          <div className="w-28">
            <label className={labelClasses}>Puerto</label>
            <input type="number" name="smtpPort" defaultValue={smtp.port} className={fieldClasses} />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <ToggleSwitch name="smtpSecure" defaultChecked={smtp.secure} />
            <span className="text-sm text-brand-ink">TLS</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <label className={labelClasses}>Usuario</label>
            <input type="text" name="smtpUser" defaultValue={smtp.user} placeholder="tu-cuenta@gmail.com" className={fieldClasses} />
          </div>
          <MaskedCredentialField
            name="smtpPassword"
            label="Contraseña"
            type="password"
            configured={smtp.passwordConfigured}
            placeholder="Contraseña o clave de aplicación"
          />
        </div>
      </div>

      {/* Bloque Resend */}
      <div hidden={selected !== "resend"}>
        <p className={`${labelClasses} mt-4`}>Resend</p>
        <div className="flex flex-wrap gap-4">
          <MaskedCredentialField
            name="resendApiKey"
            label="API Key"
            type="password"
            configured={resendConfigured}
            placeholder="re_..."
          />
        </div>
        <p className="mt-2 text-xs text-brand-muted">
          El dominio del email remitente tiene que estar verificado en tu cuenta de Resend.
        </p>
      </div>
    </>
  );
}

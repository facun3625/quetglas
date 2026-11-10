import { Suspense } from "react";
import { RecoverForm } from "./RecoverForm";

export const metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <Suspense>
      <RecoverForm />
    </Suspense>
  );
}

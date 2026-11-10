"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-4 cursor-pointer rounded-lg bg-brand-pink px-5 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark print:hidden">
      Imprimir
    </button>
  );
}

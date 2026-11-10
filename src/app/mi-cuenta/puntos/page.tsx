"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMoney } from "@/lib/currency";

type Reward = {
  id: string;
  title: string;
  pointsRequired: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
};

type Tx = { id: string; amount: number; description: string; createdAt: string };

export default function MisPuntosPage() {
  const { formatMoney } = useMoney();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/points");
    const data = await res.json();
    setPointsEnabled(Boolean(data.pointsEnabled));
    if (data.pointsEnabled) {
      setPoints(data.points);
      setRewards(data.rewards);
      setTransactions(data.transactions);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleRedeem(reward: Reward) {
    setRedeemingId(reward.id);
    setError(null);
    setRedeemedCode(null);
    try {
      const res = await fetch("/api/points/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo canjear");
      } else {
        setRedeemedCode(data.code);
        await load();
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setRedeemingId(null);
    }
  }

  if (status === "loading" || loading) {
    return <div className="mx-auto max-w-3xl px-3 py-16 text-center text-brand-muted sm:px-6">Cargando...</div>;
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Mis puntos</h1>
        <p className="mt-2 text-brand-muted">Iniciá sesión para ver tu saldo de puntos.</p>
      </div>
    );
  }

  if (!pointsEnabled) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Mis puntos</h1>
        <p className="mt-2 text-brand-muted">El sistema de puntos no está disponible por el momento.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold text-brand-ink">Mis puntos</h1>
      <p className="mt-1 text-brand-muted">
        Ganás puntos con cada compra una vez que se entrega, y los canjeás por cupones de descuento.
      </p>

      <div className="mt-6 rounded-2xl border border-brand-pink/20 bg-brand-soft p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Saldo actual</p>
        <p className="mt-1 text-4xl font-bold text-brand-pink-dark">{points}</p>
        <p className="text-sm text-brand-muted">puntos</p>
      </div>

      {redeemedCode && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
          ¡Canjeado! Tu código es <span className="font-mono font-bold">{redeemedCode}</span> — usalo en el checkout.
        </div>
      )}
      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      <h2 className="mt-10 text-lg font-semibold text-brand-ink">Catálogo de recompensas</h2>
      <div className="mt-4 flex flex-col gap-3">
        {rewards.map((r) => {
          const canRedeem = points >= r.pointsRequired;
          return (
            <div
              key={r.id}
              className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-4"
            >
              <div>
                <p className="font-medium text-brand-ink">{r.title}</p>
                <p className="text-sm text-brand-muted">
                  {r.discountType === "percentage" ? `${r.discountValue}% off` : `${formatMoney(r.discountValue)} off`} ·{" "}
                  {r.pointsRequired} pts
                </p>
              </div>
              <button
                onClick={() => handleRedeem(r)}
                disabled={!canRedeem || redeemingId === r.id}
                className="min-h-11 w-full shrink-0 cursor-pointer rounded-full bg-brand-pink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 min-[380px]:w-auto"
              >
                {redeemingId === r.id ? "..." : "Canjear"}
              </button>
            </div>
          );
        })}
        {rewards.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-brand-muted">
            Todavía no hay recompensas disponibles.
          </p>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-brand-ink">Historial</h2>
      <div className="mt-4 flex flex-col gap-2">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 text-sm"
          >
            <span className="min-w-0 break-words text-brand-ink">{tx.description}</span>
            <span className={`shrink-0 ${tx.amount > 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}`}>
              {tx.amount > 0 ? "+" : ""}
              {tx.amount}
            </span>
          </div>
        ))}
        {transactions.length === 0 && <p className="text-sm text-brand-muted">Todavía no tenés movimientos.</p>}
      </div>
    </div>
  );
}

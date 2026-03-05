"use client";

import { useEffect, useState } from "react";

interface PriceData {
  token: string;
  price: string;
  change24h: string;
}

export function MarketPrice({ token }: { token: string }) {
  const [state, setState] = useState<{
    token: string;
    data: PriceData | null;
    status: "loading" | "ready" | "error";
  }>(() => ({
    token,
    data: null,
    status: "loading",
  }));

  useEffect(() => {
    let disposed = false;

    fetch(`/api/market/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((response) => {
        if (!disposed) {
          if (response) {
            setState({
              token,
              data: response,
              status: "ready",
            });
          } else {
            setState({
              token,
              data: null,
              status: "error",
            });
          }
        }
      })
      .catch(() => {
        if (!disposed) {
          setState({
            token,
            data: null,
            status: "error",
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, [token]);

  const loading = state.token !== token || state.status === "loading";
  if (loading) {
    return (
      <div className="metric-tile animate-pulse rounded-2xl p-4">
        <div className="h-3 w-20 rounded bg-zinc-700/70" />
        <div className="mt-3 h-6 w-32 rounded bg-zinc-700/70" />
      </div>
    );
  }

  if (state.status === "error" || !state.data) {
    return (
      <div className="metric-tile rounded-2xl p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
          Market Feed
        </p>
        <p className="mt-1 text-sm text-zinc-300">Price unavailable</p>
      </div>
    );
  }

  const change = parseFloat(state.data.change24h);
  const changeColor = change >= 0 ? "text-zinc-100" : "text-rose-400";

  return (
    <div className="metric-tile flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {state.data.token} Spot
        </p>
        <p className="mono-font truncate text-base font-semibold text-zinc-100">
          $
          {parseFloat(state.data.price).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
      <span className={`mono-font text-sm font-semibold ${changeColor}`}>
        {change >= 0 ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    </div>
  );
}

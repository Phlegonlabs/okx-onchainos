"use client";

import { useEffect, useState } from "react";

interface PriceData {
  token: string;
  price: string;
  change24h: string;
}

export function MarketPrice({ token }: { token: string }) {
  const [data, setData] = useState<PriceData | null>(null);

  useEffect(() => {
    fetch(`/api/market/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => null);
  }, [token]);

  if (!data) return null;

  const change = parseFloat(data.change24h);
  const changeColor = change >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-2">
      <div>
        <p className="text-xs text-zinc-500">{data.token} Price</p>
        <p className="font-mono text-sm font-medium text-zinc-200">
          ${parseFloat(data.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      </div>
      <span className={`font-mono text-xs font-medium ${changeColor}`}>
        {change >= 0 ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    </div>
  );
}

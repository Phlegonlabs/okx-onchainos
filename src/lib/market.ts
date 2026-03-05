import { createOkxHeaders } from "./okx-auth";

const OKX_BASE = "https://web3.okx.com";

interface TokenPrice {
  token: string;
  price: string;
  change24h: string;
  updatedAt: string;
}

const cache = new Map<string, { data: TokenPrice; expiresAt: number }>();
const CACHE_TTL = 60_000; // 60 seconds

export async function getTokenPrice(token: string): Promise<TokenPrice | null> {
  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const requestPath = `/api/v5/market/index-tickers?instId=${token}-USDT`;
  const headers = createOkxHeaders("GET", requestPath);

  try {
    const res = await fetch(`${OKX_BASE}${requestPath}`, { headers });
    const json = await res.json();

    if (json.code !== "0" || !json.data?.[0]) {
      return null;
    }

    const ticker = json.data[0];
    const data: TokenPrice = {
      token,
      price: ticker.idxPx || "0",
      change24h: ticker.sodUtc0 ?
        String(((parseFloat(ticker.idxPx) - parseFloat(ticker.sodUtc0)) / parseFloat(ticker.sodUtc0) * 100).toFixed(2)) : "0",
      updatedAt: new Date().toISOString(),
    };

    cache.set(token, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch {
    return null;
  }
}

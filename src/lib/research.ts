import { createOkxHeaders } from "./okx-auth";
import { XLAYER_CHAIN_INDEX } from "./x402";

const ONCHAIN_OS_BASE = "https://web3.okx.com";
const DEFAULT_ALLOWED_INST_IDS = [
  "BTC-USDT",
  "ETH-USDT",
  "SOL-USDT",
  "OKB-USDT",
  "XRP-USDT",
  "DOGE-USDT",
  "ADA-USDT",
] as const;
const DEFAULT_ALLOWED_BARS = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;
const DEFAULT_MIN_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 500;
const PRICE_CACHE_TTL_MS = 30_000;
const SUPPORTED_ASSETS_CACHE_TTL_MS = 60_000;

type OkxEnvelope<T> = {
  code?: string;
  msg?: string;
  data?: T[];
};

type SupportedAssetRow = {
  chainIndex?: string | number;
  symbol?: string;
  tokenAddress?: string;
  decimal?: string | number;
};

type PriceRow = {
  idxPx?: string;
  sodUtc0?: string;
};

type CandleRow = [string, string, string, string, string, string, ...string[]];

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const priceCache = new Map<string, CacheEntry<ResearchPrice>>();
let supportedAssetsCache: CacheEntry<ResearchSupportedAssets> | null = null;

export type ResearchConfig = {
  allowedInstIds: Set<string>;
  allowedBars: Set<string>;
  minLimit: number;
  maxLimit: number;
};

export type ResearchPrice = {
  instId: string;
  price: string;
  change24hPct: string;
  updatedAt: string;
  source: string;
};

export type ResearchCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ResearchCandles = {
  instId: string;
  bar: string;
  limit: number;
  count: number;
  candles: ResearchCandle[];
  updatedAt: string;
  source: string;
};

export type ResearchSupportedAsset = {
  chainIndex: string;
  symbol: string;
  tokenAddress: string;
  decimals: number | null;
};

export type ResearchSupportedAssets = {
  chainIndex: string;
  count: number;
  assets: ResearchSupportedAsset[];
  updatedAt: string;
  source: string;
};

export class ResearchUpstreamError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "ResearchUpstreamError";
    this.statusCode = statusCode;
  }
}

function parseCsvUpperEnv(
  value: string | undefined,
  defaults: readonly string[]
): Set<string> {
  if (!value || !value.trim()) {
    return new Set(defaults);
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toUpperCase());
  return parsed.length > 0 ? new Set(parsed) : new Set(defaults);
}

function parseCsvEnv(value: string | undefined, defaults: readonly string[]): Set<string> {
  if (!value || !value.trim()) {
    return new Set(defaults);
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? new Set(parsed) : new Set(defaults);
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function safeParseFloat(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchOkxData<T>(path: string): Promise<T[]> {
  const headers = createOkxHeaders("GET", path);
  const response = await fetch(`${ONCHAIN_OS_BASE}${path}`, { headers });

  let payload: OkxEnvelope<T>;
  try {
    payload = (await response.json()) as OkxEnvelope<T>;
  } catch {
    throw new ResearchUpstreamError(
      `Failed to parse upstream JSON for ${path} (${response.status})`
    );
  }

  if (!response.ok) {
    throw new ResearchUpstreamError(
      payload.msg || `Upstream returned HTTP ${response.status} for ${path}`
    );
  }

  if (payload.code !== "0" || !Array.isArray(payload.data)) {
    throw new ResearchUpstreamError(payload.msg || `Upstream rejected ${path}`);
  }

  return payload.data;
}

export function getResearchConfig(): ResearchConfig {
  const minLimit = toPositiveInt(process.env.RESEARCH_MIN_LIMIT, DEFAULT_MIN_LIMIT);
  const maxLimit = Math.max(
    minLimit,
    toPositiveInt(process.env.RESEARCH_MAX_LIMIT, DEFAULT_MAX_LIMIT)
  );

  return {
    allowedInstIds: parseCsvUpperEnv(
      process.env.RESEARCH_ALLOWED_INST_IDS,
      DEFAULT_ALLOWED_INST_IDS
    ),
    allowedBars: parseCsvEnv(process.env.RESEARCH_ALLOWED_BARS, DEFAULT_ALLOWED_BARS),
    minLimit,
    maxLimit,
  };
}

export function normalizeInstId(input: string | null): string {
  return (input || "").trim().toUpperCase();
}

export function normalizeBar(input: string | null): string {
  return (input || "").trim().toUpperCase();
}

export function parseLimit(input: string | null): number | null {
  if (!input) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export async function fetchSupportedAssets(): Promise<ResearchSupportedAssets> {
  const now = Date.now();
  if (supportedAssetsCache && supportedAssetsCache.expiresAt > now) {
    return supportedAssetsCache.value;
  }

  const source = `${ONCHAIN_OS_BASE}/api/v6/payments/supported/`;
  const rows = await fetchOkxData<SupportedAssetRow>("/api/v6/payments/supported/");
  const assets = rows
    .filter((row) => String(row.chainIndex ?? "") === XLAYER_CHAIN_INDEX)
    .map((row) => {
      const decimals = safeParseFloat(row.decimal);
      return {
        chainIndex: String(row.chainIndex ?? XLAYER_CHAIN_INDEX),
        symbol: String(row.symbol ?? "UNKNOWN"),
        tokenAddress: String(row.tokenAddress ?? ""),
        decimals: decimals === null ? null : Math.round(decimals),
      };
    })
    .filter((row) => row.tokenAddress.length > 0);

  const value: ResearchSupportedAssets = {
    chainIndex: XLAYER_CHAIN_INDEX,
    count: assets.length,
    assets,
    updatedAt: new Date().toISOString(),
    source,
  };
  supportedAssetsCache = {
    value,
    expiresAt: now + SUPPORTED_ASSETS_CACHE_TTL_MS,
  };
  return value;
}

export async function fetchPrice(instId: string): Promise<ResearchPrice> {
  const now = Date.now();
  const cached = priceCache.get(instId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const path = `/api/v5/market/index-tickers?instId=${encodeURIComponent(instId)}`;
  const source = `${ONCHAIN_OS_BASE}${path}`;
  const rows = await fetchOkxData<PriceRow>(path);
  const ticker = rows[0];
  if (!ticker || !ticker.idxPx) {
    throw new ResearchUpstreamError(`No price data available for ${instId}`, 404);
  }

  const idxPx = Number(ticker.idxPx);
  const sodUtc0 = Number(ticker.sodUtc0);
  const change24hPct =
    Number.isFinite(idxPx) && Number.isFinite(sodUtc0) && sodUtc0 !== 0
      ? ((idxPx - sodUtc0) / sodUtc0) * 100
      : 0;

  const value: ResearchPrice = {
    instId,
    price: ticker.idxPx,
    change24hPct: change24hPct.toFixed(2),
    updatedAt: new Date().toISOString(),
    source,
  };

  priceCache.set(instId, { value, expiresAt: now + PRICE_CACHE_TTL_MS });
  return value;
}

export async function fetchCandles(
  instId: string,
  bar: string,
  limit: number
): Promise<ResearchCandles> {
  const path = `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const source = `${ONCHAIN_OS_BASE}${path}`;
  const rows = await fetchOkxData<CandleRow>(path);

  const candles = rows
    .map((row) => ({
      ts: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.ts) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close) &&
        Number.isFinite(row.volume)
    )
    .sort((a, b) => a.ts - b.ts);

  return {
    instId,
    bar,
    limit,
    count: candles.length,
    candles,
    updatedAt: new Date().toISOString(),
    source,
  };
}

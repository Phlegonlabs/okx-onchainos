import Link from "next/link";

type HttpMethod = "GET" | "POST" | "PUT";

type FlowStep = {
  title: string;
  detail: string;
  method?: HttpMethod;
  path?: string;
  note?: string;
};

type FlowMap = {
  id: string;
  title: string;
  subtitle: string;
  steps: FlowStep[];
};

const flowMaps: FlowMap[] = [
  {
    id: "submission",
    title: "Flow 01 - Submit Strategy Template",
    subtitle:
      "Private skill users submit template + params, then the platform backtests and lists only approved strategies.",
    steps: [
      {
        title: "Submit candidate",
        detail: "Send providerAddress, templateKey, timeframe, instId, and params through the private skill gateway.",
        method: "POST",
        path: "/api/strategy-submissions",
      },
      {
        title: "Run unified backtest",
        detail:
          "Platform fetches candles, scores the strategy, and assigns tier, unit price, and period cap.",
      },
      {
        title: "Read submission result",
        detail:
          "Owner reads back the approval or rejection state with wallet auth plus bearer access.",
        method: "GET",
        path: "/api/strategy-submissions/:id",
      },
    ],
  },
  {
    id: "subscription",
    title: "Flow 02 - Subscribe Approved Strategy",
    subtitle:
      "Consumers subscribe to an approved strategy once, then only pay when fresh live signals exist.",
    steps: [
      {
        title: "Pick a listed strategy",
        detail:
          "Public feed shows only approved strategies with gateway-managed pricing tiers.",
        method: "GET",
        path: "/api/strategies",
      },
      {
        title: "Create or reuse subscription",
        detail:
          "Submit subscriberAddress (+ optional planDays) with wallet-auth headers through the private skill token.",
        method: "POST",
        path: "/api/strategies/:id/subscribe",
        note: "Signing wallet must equal subscriberAddress",
      },
      {
        title: "Read subscription state",
        detail:
          "Query by subscriberAddress to inspect expiry, tier, and current 30-day cap.",
        method: "GET",
        path: "/api/strategies/:id/subscribe?subscriberAddress=0x...",
      },
    ],
  },
  {
    id: "subscriber-signals",
    title: "Flow 03 - Subscriber Consume (x402)",
    subtitle:
      "Polling is free when no new live signals exist. x402 is required only when a billable batch is pending.",
    steps: [
      {
        title: "Poll pending signals",
        detail:
          "Call subscription signals endpoint. Empty queue returns 200 with no payment.",
        method: "GET",
        path: "/api/subscriptions/:subscriptionId/signals",
        note: "x402 payer must equal the original subscriberAddress",
      },
      {
        title: "Handle HTTP 402",
        detail:
          "If pendingCount > 0, response includes paymentRequirements and capped request pricing.",
        note: "chargedCents = min(pricePerSignal * pendingSignalCount, remainingPeriodCap)",
      },
      {
        title: "Retry with X-Payment",
        detail:
          "Send verified payment payload in X-Payment header for settlement on X Layer.",
      },
      {
        title: "Receive signals + receipt",
        detail:
          "Get pending signals, openclawMessages, and receipt (txHash, fee split, paid amount).",
      },
    ],
  },
  {
    id: "research",
    title: "Flow 04 - Research APIs (x402)",
    subtitle:
      "Use free metadata/spot routes first, then pay a small or large candles tier when historical data is needed.",
    steps: [
      {
        title: "Load supported assets (free)",
        detail: "Read OnchainOS allowed symbols for this app.",
        method: "GET",
        path: "/api/research/supported-assets",
      },
      {
        title: "Fetch spot price (free)",
        detail: "Get current market price by instId.",
        method: "GET",
        path: "/api/research/price?instId=BTC-USDT",
      },
      {
        title: "Request candles -> HTTP 402",
        detail:
          "Historical candles endpoint returns payment requirements before data access. Price scales by requested limit.",
        method: "GET",
        path: "/api/research/candles?instId=BTC-USDT&bar=1H&limit=120",
      },
      {
        title: "Pay and receive candles",
        detail:
          "Retry with X-Payment to receive candles + receipt (paidMicroUsd, txHash).",
      },
    ],
  },
];

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <section className="surface-card rounded-3xl p-6 sm:p-8">
        <p className="mono-font text-xs uppercase tracking-[0.2em] text-zinc-500">
          Ops Handbook
        </p>
        <h1 className="display-font mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
          Private Skill Gateway + x402 Value Billing
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          This page documents the current production flow: private skill access,
          template submission, gateway-managed pricing, capped subscription
          billing, and x402 settlement on X Layer.
        </p>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          Payment Model
        </h2>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>1. Public listing is free to browse; only approved strategies appear on the gateway feed.</p>
          <p>
            2. Strategy submission is free, but only private skill users can submit template + params.
          </p>
          <p>
            3. Live signals and candles are the two paid x402 surfaces.
          </p>
          <p>
            4. Subscription billing is still per signal, but each 30-day period has a price cap.
          </p>
          <p>
            5. After a subscription hits its cap, later signal batches in the same period are free.
          </p>
          <p>
            6. Research candles use tiered prices: smaller requests cost less than larger windows.
          </p>
          <p>
            7. Provider balances and premium routes are no longer public browser surfaces; they sit behind the private skill gateway.
          </p>
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          API Flow Maps
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Four production flows for strategy subscription, provider operations,
          subscriber settlement, and research requests.
        </p>
        <div className="mt-5 space-y-4">
          {flowMaps.map((flow) => (
            <FlowMapCard key={flow.id} flow={flow} />
          ))}
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          Endpoint Matrix
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Copy-friendly endpoint list grouped by role and responsibility.
        </p>
        <div className="mt-4 grid gap-3 text-sm">
          <ApiItem
            method="POST"
            path="/api/strategy-submissions"
            desc="Submit a candidate strategy template. Requires bearer access plus wallet-auth signed request from providerAddress."
          />
          <ApiItem
            method="POST"
            path="/api/strategies/:id/subscribe"
            desc="Create or reuse an active subscription. Requires wallet-auth signed request from subscriberAddress."
          />
          <ApiItem
            method="GET"
            path="/api/strategies/:id/subscribe?subscriberAddress=0x..."
            desc="Read active subscription status for a wallet."
          />
          <ApiItem
            method="GET"
            path="/api/providers/:address"
            desc="Read provider earnings. Requires bearer access plus owner wallet-auth."
          />
          <ApiItem
            method="GET"
            path="/api/subscriptions/:subscriptionId/signals"
            desc="Fetch pending live signals; returns 402 only when payment is needed. The 30-day billing cap is enforced here."
          />
          <ApiItem
            method="GET"
            path="/api/research/candles?instId=BTC-USDT&bar=1H&limit=120"
            desc="Research candles endpoint (x402). Pricing scales by limit tier."
          />
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          Pricing Guide
        </h2>
        <div className="mt-4 space-y-3 text-sm text-zinc-300">
          <p>
            `chargedCents = min(pricePerSignalCents * pendingSignalCount, remainingPeriodCapCents)`
          </p>
          <p>
            `maxAmountRequired = chargedCents * 10000` (USDT smallest units on
            X Layer).
          </p>
          <p>
            Current strategy tiers: `tier_1 = $0.03 / $1.49 cap`, `tier_2 = $0.06 / $2.99 cap`, `tier_3 = $0.09 / $5.99 cap`.
          </p>
          <p>
            Research candles pricing: up to 120 candles costs $0.005; above 120 candles costs $0.015.
          </p>
          <p className="text-zinc-400">
            Protocol note: x402 remains the settlement layer; gateway bearer access controls who can use the managed capability bundle.
          </p>
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          Quick Links
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Back to Gateway
          </Link>
          <a
            href="https://github.com/Phlegonlabs/okx-onchainos"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Repo
          </a>
        </div>
      </section>
    </div>
  );
}

function ApiItem({
  method,
  path,
  desc,
}: {
  method: HttpMethod;
  path: string;
  desc: string;
}) {
  return (
    <div className="metric-tile rounded-2xl p-4">
      <p className="mono-font text-xs uppercase tracking-[0.16em] text-zinc-500">
        {method}
      </p>
      <p className="mono-font mt-1 text-sm text-zinc-100">{path}</p>
      <p className="mt-2 text-xs text-zinc-400">{desc}</p>
    </div>
  );
}

function FlowMapCard({ flow }: { flow: FlowMap }) {
  return (
    <div className="metric-tile rounded-2xl p-4 sm:p-5">
      <h3 className="display-font text-xl font-semibold text-zinc-100">
        {flow.title}
      </h3>
      <p className="mt-2 text-sm text-zinc-400">{flow.subtitle}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {flow.steps.map((step, index) => (
          <FlowStepCard
            key={`${flow.id}-${index}`}
            index={index}
            step={step}
            isLast={index === flow.steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function FlowStepCard({
  index,
  step,
  isLast,
}: {
  index: number;
  step: FlowStep;
  isLast: boolean;
}) {
  return (
    <article className="relative rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center gap-2">
        <span className="mono-font rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
          S{index + 1}
        </span>
        {step.method ? <MethodBadge method={step.method} /> : null}
      </div>

      <p className="mt-3 text-sm font-semibold text-zinc-100">{step.title}</p>

      {step.path ? (
        <p className="mono-font mt-2 break-all text-xs text-zinc-300">{step.path}</p>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{step.detail}</p>

      {step.note ? (
        <p className="mono-font mt-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-400">
          {step.note}
        </p>
      ) : null}

      {!isLast ? (
        <span className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 text-zinc-600 xl:block">
          -&gt;
        </span>
      ) : null}
    </article>
  );
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const methodClass =
    method === "POST"
      ? "border-emerald-700/60 text-emerald-300"
      : method === "PUT"
        ? "border-amber-700/60 text-amber-300"
        : "border-sky-700/60 text-sky-300";

  return (
    <span
      className={`mono-font rounded-full border px-2 py-0.5 text-[11px] tracking-[0.08em] ${methodClass}`}
    >
      {method}
    </span>
  );
}

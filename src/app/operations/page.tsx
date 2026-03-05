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
    id: "subscription",
    title: "Flow 01 - Subscribe Strategy",
    subtitle:
      "Create or reuse a 30-day subscription for one strategy and keep status observable.",
    steps: [
      {
        title: "Pick a strategy",
        detail: "List active strategies and choose one target strategy id.",
        method: "GET",
        path: "/api/strategies",
      },
      {
        title: "Create or reuse subscription",
        detail:
          "Submit subscriberAddress (+ optional planDays) with wallet-auth headers. Existing active plan is reused.",
        method: "POST",
        path: "/api/strategies/:id/subscribe",
        note: "Signing wallet must equal subscriberAddress",
      },
      {
        title: "Read subscription state",
        detail:
          "Query by subscriberAddress to get current status, expiry, and billing anchor.",
        method: "GET",
        path: "/api/strategies/:id/subscribe?subscriberAddress=0x...",
      },
    ],
  },
  {
    id: "provider",
    title: "Flow 02 - Provider Publish",
    subtitle:
      "Provider creates strategy, pushes new signals, and checks earnings accumulation.",
    steps: [
      {
        title: "Create strategy",
        detail:
          "Publish one strategy with wallet-auth headers. providerAddress must equal the signing wallet.",
        method: "POST",
        path: "/api/strategies",
      },
      {
        title: "Push a signal",
        detail:
          "Append one BUY/SELL signal with the same provider wallet. This becomes billable for subscribers.",
        method: "PUT",
        path: "/api/strategies/:id/signals",
      },
      {
        title: "Track provider balance",
        detail:
          "Inspect earned cents, pending cents, and total signals sold for payout logic.",
        method: "GET",
        path: "/api/providers/:address",
      },
    ],
  },
  {
    id: "subscriber-signals",
    title: "Flow 03 - Subscriber Consume (x402)",
    subtitle:
      "Polling is free when no new signals exist. x402 is required only when pending signals exist.",
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
          "If pendingCount > 0, response includes paymentRequirements and request pricing.",
        note: "amountCents = pricePerSignal * pendingSignalCount",
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
      "Use free metadata/spot routes first, then pay per candles request when historical data is needed.",
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
          "Historical candles endpoint returns payment requirements before data access.",
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
          Subscription + x402 Per-Signal Billing
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          This page documents the current production flow: 30-day subscription,
          pay only when new signals exist, and settle through x402 on X Layer.
          Pricing is per single signal message.
        </p>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          Payment Model
        </h2>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>1. Create subscription once for a strategy (default 30 days) with wallet-auth headers.</p>
          <p>
            2. Poll subscription signals. If no new signals, response is free.
          </p>
          <p>
            3. If new signals exist, API returns HTTP 402 + payment requirements.
          </p>
          <p>
            4. After payment, all pending new signals are returned in one batch.
          </p>
          <p>
            5. Billing unit is one signal message. If 3 pending signals exist, you
            pay 3x `pricePerSignal`.
          </p>
          <p>
            6. Every response with signals also includes `openclawMessages` so
            OpenClaw can immediately consume BUY/SELL notifications.
          </p>
          <p>
            7. Provider writes and subscription creation are signed by the agent wallet. The skill itself does not install that wallet.
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
            path="/api/strategies"
            desc="Create strategy. Requires wallet-auth signed request from providerAddress."
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
            method="PUT"
            path="/api/strategies/:id/signals"
            desc="Push a new signal. Requires wallet-auth signed request from the strategy owner."
          />
          <ApiItem
            method="GET"
            path="/api/subscriptions/:subscriptionId/signals"
            desc="Fetch pending signals; returns 402 only when payment is needed. x402 payer must match the subscription wallet."
          />
          <ApiItem
            method="GET"
            path="/api/research/candles?instId=BTC-USDT&bar=1H&limit=120"
            desc="Research candles endpoint (x402). Fixed cost: $0.001 per request."
          />
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          Per-Signal Pricing Guide
        </h2>
        <div className="mt-4 space-y-3 text-sm text-zinc-300">
          <p>
            `amountCents = pricePerSignalCents * pendingSignalCount`
          </p>
          <p>
            `maxAmountRequired = amountCents * 10000` (USDT smallest units on
            X Layer).
          </p>
          <p>
            Example: if `pricePerSignalCents = 6` and `pendingSignalCount = 2`,
            then `amountCents = 12` and `maxAmountRequired = 120000`.
          </p>
          <p>
            Current recommended active strategy range: `3-9` cents per signal
            (`$0.03-$0.09`) to keep entry friction low.
          </p>
          <p className="text-zinc-400">
            Protocol note: x402 itself does not enforce one fixed global
            minimum amount in this app. Your business minimum is defined by
            strategy pricing.
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
            Back to Marketplace
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

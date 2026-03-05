import Link from "next/link";

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
          <p>1. Create subscription once for a strategy (default 30 days).</p>
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
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 className="display-font text-2xl font-semibold text-zinc-50">
          API Endpoints
        </h2>
        <div className="mt-4 grid gap-3 text-sm">
          <ApiItem
            method="POST"
            path="/api/strategies/:id/subscribe"
            desc="Create or reuse an active subscription."
          />
          <ApiItem
            method="GET"
            path="/api/strategies/:id/subscribe?subscriberAddress=0x..."
            desc="Read active subscription status for a wallet."
          />
          <ApiItem
            method="GET"
            path="/api/subscriptions/:subscriptionId/signals"
            desc="Fetch pending signals; returns 402 only when payment is needed, and returns openclawMessages after payment."
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
  method: string;
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

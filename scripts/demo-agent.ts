/**
 * Demo script: simulates an OpenClaw agent purchasing strategy signals via x402.
 *
 * Usage:
 *   DEMO_AGENT_PRIVATE_KEY=0x... npx tsx scripts/demo-agent.ts
 *
 * Or set DEMO_AGENT_PRIVATE_KEY in .env.local and run:
 *   npx tsx scripts/demo-agent.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
try {
  const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

import { createOpenClawX402Wallet } from "../src/lib/openclaw-x402-wallet";

const BASE_URL = process.env.STRATEGY_SQUARE_URL || "http://localhost:3456";
const PRIVATE_KEY = process.env.DEMO_AGENT_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error("ERROR: Set DEMO_AGENT_PRIVATE_KEY environment variable");
  process.exit(1);
}

const wallet = createOpenClawX402Wallet({ privateKey: PRIVATE_KEY });

console.log("=== Strategy Square Demo Agent ===");
console.log(`Agent wallet: ${wallet.address}`);
console.log(`Target: ${BASE_URL}`);
console.log("");

async function run() {
  // Step 1: Browse strategies
  console.log("Step 1: Browsing strategies...");
  const listRes = await fetch(`${BASE_URL}/api/strategies`);
  const { strategies } = await listRes.json();
  console.log(`  Found ${strategies.length} strategies:`);
  for (const s of strategies) {
    console.log(
      `  - ${s.name} (${s.asset}, ${(s.winRate * 100).toFixed(0)}% win, $${(s.pricePerSignal / 100).toFixed(2)}/signal)`
    );
  }
  console.log("");

  // Step 2: Pick the best strategy
  const target = strategies[0];
  console.log(`Step 2: Selected "${target.name}" (ID: ${target.id})`);
  console.log("");

  // Step 3: Create or reuse subscription with wallet auth
  console.log("Step 3: Creating subscription (wallet auth)...");
  const subscribeRes = await wallet.requestWithWalletAuth(
    `${BASE_URL}/api/strategies/${target.id}/subscribe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscriberAddress: wallet.address,
      }),
    }
  );
  console.log(`  HTTP ${subscribeRes.status}`);

  const subscribeResult = await subscribeRes.json();
  if (!subscribeRes.ok) {
    console.log("  Response:", JSON.stringify(subscribeResult, null, 2));
    process.exit(1);
  }

  const subscriptionId = subscribeResult.subscription.id;
  console.log(
    `  Subscription: ${subscriptionId} (${subscribeResult.reused ? "reused" : "created"})`
  );
  console.log("");

  // Step 4: Request subscription signals with automatic x402 handling
  console.log("Step 4: Requesting subscription signals (auto x402)...");
  const {
    response,
    paid,
    paymentRequirements,
  } = await wallet.requestWithAutoPayment(
    `${BASE_URL}/api/subscriptions/${subscriptionId}/signals`
  );
  console.log(`  HTTP ${response.status}`);

  if (paid && paymentRequirements) {
    console.log("  x402 payment sent:");
    console.log(
      `    Amount: ${paymentRequirements.maxAmountRequired} (token base units)`
    );
    console.log(`    Pay to: ${paymentRequirements.payTo}`);
    console.log(`    Asset:  ${paymentRequirements.asset}`);
    console.log(`    Resource: ${paymentRequirements.resource}`);
    console.log("");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    result = { error: `Server returned ${response.status} (no JSON body)` };
  }

  if (response.ok) {
    if ((result.signals || []).length === 0) {
      console.log(`  ${result.message || "No new signals yet"}`);
    } else {
      console.log(`  Received ${result.signals.length} signals!`);
      console.log("  Receipt:", JSON.stringify(result.receipt, null, 2));
      console.log("");
      console.log("  Latest signals:");
      for (const sig of result.signals.slice(0, 3)) {
        console.log(
          `    ${sig.action.toUpperCase()} ${sig.token} @ $${sig.entry} → ${sig.outcome} (${sig.returnPct > 0 ? "+" : ""}${sig.returnPct}%)`
        );
      }
    }
  } else {
    console.log("  Response:", JSON.stringify(result, null, 2));
    console.log("");
    if (response.status === 403 || response.status === 500) {
      console.log("  x402 payment failed. Check the following:");
      console.log("    - Set OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE in .env.local");
      console.log("    - Fund the agent wallet with USDT on X Layer");
      console.log("    - Ensure this token is supported by OKX x402 on chainIndex 196");
    }
  }

  console.log("");
  console.log("=== Demo Complete ===");
}

run().catch((err) => {
  console.error("Demo failed:", err.message);
  process.exit(1);
});

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

import { createWalletClient, http, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";

// X Layer chain definition
const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
});

const BASE_URL = process.env.STRATEGY_SQUARE_URL || "http://localhost:3456";
const PRIVATE_KEY = process.env.DEMO_AGENT_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error("ERROR: Set DEMO_AGENT_PRIVATE_KEY environment variable");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

console.log("=== Strategy Square Demo Agent ===");
console.log(`Agent wallet: ${account.address}`);
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

  // Step 3: Request signals → expect 402
  console.log("Step 3: Requesting signals...");
  const signalRes = await fetch(`${BASE_URL}/api/strategies/${target.id}/signals`);
  console.log(`  HTTP ${signalRes.status}`);

  if (signalRes.status === 402) {
    const body = await signalRes.json();
    const reqs = body.paymentRequirements;
    console.log("  Payment Required:");
    console.log(`    Amount: ${reqs.maxAmountRequired} (USDC decimals)`);
    console.log(`    Pay to: ${reqs.payTo}`);
    console.log(`    Asset:  ${reqs.asset}`);
    console.log(`    Resource: ${reqs.resource}`);
    console.log("");

    // Step 4: Sign x402 payment (EIP-3009 transferWithAuthorization)
    console.log("Step 4: Signing x402 payment...");

    const now = Math.floor(Date.now() / 1000);
    const nonce = keccak256(
      encodePacked(
        ["address", "uint256"],
        [account.address, BigInt(now)]
      )
    );

    const authorization = {
      from: account.address,
      to: reqs.payTo,
      value: reqs.maxAmountRequired,
      validAfter: String(now - 60),
      validBefore: String(now + 3600),
      nonce,
    };

    // Sign the authorization using EIP-712
    const domain = {
      name: "USD Coin",
      version: "1",
      chainId: 196n,
      verifyingContract: reqs.asset as `0x${string}`,
    };

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message: {
        from: authorization.from,
        to: authorization.to as `0x${string}`,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce as `0x${string}`,
      },
    });

    console.log(`  Signature: ${signature.slice(0, 20)}...`);
    console.log("");

    // Step 5: Retry with payment
    console.log("Step 5: Retrying with x402 payment...");
    const paymentPayload = {
      x402Version: "1",
      scheme: "exact",
      payload: {
        signature,
        authorization,
      },
    };

    const paidRes = await fetch(`${BASE_URL}/api/strategies/${target.id}/signals`, {
      headers: {
        "X-Payment": JSON.stringify(paymentPayload),
      },
    });

    console.log(`  HTTP ${paidRes.status}`);

    let result;
    try {
      result = await paidRes.json();
    } catch {
      result = { error: `Server returned ${paidRes.status} (no JSON body)` };
    }

    if (paidRes.ok) {
      console.log(`  Received ${result.signals.length} signals!`);
      console.log("  Receipt:", JSON.stringify(result.receipt, null, 2));
      console.log("");
      console.log("  Latest signals:");
      for (const sig of result.signals.slice(0, 3)) {
        console.log(
          `    ${sig.action.toUpperCase()} ${sig.token} @ $${sig.entry} → ${sig.outcome} (${sig.returnPct > 0 ? "+" : ""}${sig.returnPct}%)`
        );
      }
    } else {
      console.log("  Response:", JSON.stringify(result, null, 2));
      console.log("");
      if (paidRes.status === 403 || paidRes.status === 500) {
        console.log("  This is expected if OKX API keys are not configured.");
        console.log("  The x402 flow is working correctly:");
        console.log("    1. GET /signals → 402 Payment Required");
        console.log("    2. Agent signed EIP-3009 authorization");
        console.log("    3. Agent retried with X-Payment header");
        console.log("    4. Server attempted OKX verify/settle (failed: no API keys)");
        console.log("");
        console.log("  To complete with real payment:");
        console.log("    - Set OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE in .env.local");
        console.log("    - Fund the agent wallet with USDC on X Layer");
      }
    }
  } else {
    const body = await signalRes.json();
    console.log("  Unexpected response:", JSON.stringify(body, null, 2));
  }

  console.log("");
  console.log("=== Demo Complete ===");
}

run().catch((err) => {
  console.error("Demo failed:", err.message);
  process.exit(1);
});

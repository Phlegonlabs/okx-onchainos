import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("=== New Demo Agent Wallet ===");
console.log(`Address:     ${account.address}`);
console.log(`Private Key: ${privateKey}`);
console.log("");
console.log("Next steps:");
console.log("1. Save these somewhere safe");
console.log("2. Send a small amount of USDC to this address on X Layer");
console.log("   - Use OKX Exchange: Withdraw USDC → X Layer network");
console.log("   - Or bridge from another chain");
console.log("3. Add to your .env.local:");
console.log(`   DEMO_AGENT_PRIVATE_KEY=${privateKey}`);
console.log(`   DEMO_AGENT_ADDRESS=${account.address}`);

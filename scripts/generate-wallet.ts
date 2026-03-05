import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("=== New Demo Agent Wallet ===");
console.log(`Address:     ${account.address}`);
console.log(`Private Key: ${privateKey}`);
console.log("");
console.log("Next steps:");
console.log("1. Save these somewhere safe");
console.log("2. Send a small amount of USDT (USD₮0) to this address on X Layer");
console.log("   - Token address: 0x779ded0c9e1022225f8e0630b35a9b54be713736");
console.log("   - Use OKX Exchange: Withdraw USDT → X Layer network");
console.log("   - Or bridge from another chain");
console.log("3. Add to your .env.local:");
console.log(`   DEMO_AGENT_PRIVATE_KEY=${privateKey}`);
console.log(`   DEMO_AGENT_ADDRESS=${account.address}`);

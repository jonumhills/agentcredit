/**
 * fundAgents.ts
 *
 * Funds all 11 agent wallets with testnet OKB.
 *
 * Strategy:
 *   1. Try X Layer testnet faucet API for each agent (free 0.1 OKB per address)
 *   2. For addresses the faucet rejects (rate-limited), fall back to
 *      transferring from the deployer wallet.
 *
 * Amounts:
 *   Lenders   → 0.012 OKB  (deposit + gas for setTerms)
 *   Borrowers → 0.008 OKB  (gas for registration + repayments)
 *
 * Run: npm run agents:fund
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config({ path: require("path").join(__dirname, "../../../.env") });

const AGENTS_FILE = path.join(__dirname, "../../agents.json");

const FAUCET_URL       = "https://www.okx.com/xlayer/faucet/claim";
const TESTNET_RPC      = process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech";
const LENDER_FUND_ETH  = "0.012";
const BORROWER_FUND_ETH= "0.008";
const MIN_BALANCE_ETH  = "0.003";   // skip if already funded above this

// ── Faucet ────────────────────────────────────────────────────────────────────

async function requestFaucet(address: string): Promise<boolean> {
  try {
    const res = await axios.post(
      FAUCET_URL,
      { address },
      {
        headers: { "Content-Type": "application/json", "User-Agent": "AgentCredit/1.0" },
        timeout: 15000,
      }
    );
    const ok = res.data?.code === 0 || res.data?.success === true || res.status === 200;
    return ok;
  } catch (err: any) {
    // 429 = rate limited, 400 = already claimed
    return false;
  }
}

// ── Deployer transfer ─────────────────────────────────────────────────────────

async function fundFromDeployer(
  provider: ethers.JsonRpcProvider,
  deployer: ethers.Wallet,
  address: string,
  amountEth: string
): Promise<string> {
  const tx = await deployer.sendTransaction({
    to: address,
    value: ethers.parseEther(amountEth),
  });
  await tx.wait();
  return tx.hash;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║      AgentCredit — Fund Agents        ║");
  console.log("╚══════════════════════════════════════╝\n");

  if (!fs.existsSync(AGENTS_FILE)) {
    console.error("❌ agents.json not found — run npm run agents:create first");
    process.exit(1);
  }

  const agents = JSON.parse(fs.readFileSync(AGENTS_FILE, "utf-8"));
  const provider = new ethers.JsonRpcProvider(TESTNET_RPC);

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const deployer = new ethers.Wallet(deployerKey, provider);

  const deployerBalance = await provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} OKB\n`);

  for (const agent of agents) {
    const targetEth = agent.role === "LENDER" ? LENDER_FUND_ETH : BORROWER_FUND_ETH;
    const current   = await provider.getBalance(agent.wallet.address);
    const currentEth = parseFloat(ethers.formatEther(current));

    if (currentEth >= parseFloat(MIN_BALANCE_ETH)) {
      console.log(`⏭  ${agent.name} (${agent.role}) — already has ${currentEth.toFixed(4)} OKB, skipping`);
      continue;
    }

    console.log(`\n💸 Funding ${agent.name} (${agent.role}) → ${agent.wallet.address}`);
    console.log(`   Target: ${targetEth} OKB | Current: ${currentEth.toFixed(6)} OKB`);

    // Step 1: Try faucet
    console.log(`   → Trying faucet...`);
    const faucetOk = await requestFaucet(agent.wallet.address);

    if (faucetOk) {
      console.log(`   ✓ Faucet claimed! Waiting 5s for confirmation...`);
      await new Promise((r) => setTimeout(r, 5000));
      const newBal = await provider.getBalance(agent.wallet.address);
      console.log(`   Balance: ${ethers.formatEther(newBal)} OKB`);
    } else {
      // Step 2: Transfer from deployer
      console.log(`   ⚠ Faucet unavailable — transferring from deployer`);
      try {
        const deployerBal = await provider.getBalance(deployer.address);
        const needed = ethers.parseEther(targetEth);
        const gas    = ethers.parseEther("0.002"); // reserve for gas

        if (deployerBal < needed + gas) {
          console.log(`   ⚠ Deployer low on funds (${ethers.formatEther(deployerBal)} OKB), sending minimum`);
          const sendAmt = deployerBal > gas ? ethers.formatEther(deployerBal - gas) : "0";
          if (sendAmt === "0") {
            console.log(`   ❌ Not enough deployer balance — please fund deployer manually`);
            continue;
          }
          const txHash = await fundFromDeployer(provider, deployer, agent.wallet.address, sendAmt);
          console.log(`   ✓ Sent ${sendAmt} OKB — tx: ${txHash}`);
        } else {
          const txHash = await fundFromDeployer(provider, deployer, agent.wallet.address, targetEth);
          console.log(`   ✓ Sent ${targetEth} OKB — tx: ${txHash}`);
        }
      } catch (err: any) {
        console.log(`   ❌ Transfer failed: ${err.message}`);
      }
    }

    // Throttle between agents
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Final balance report
  console.log("\n── Final Balances ──────────────────────────────────────────────");
  for (const agent of agents) {
    const bal = await provider.getBalance(agent.wallet.address);
    const eth = parseFloat(ethers.formatEther(bal));
    const icon = eth >= parseFloat(MIN_BALANCE_ETH) ? "✓" : "✗";
    console.log(`${icon} ${agent.name.padEnd(18)} ${agent.role.padEnd(8)} ${eth.toFixed(6)} OKB   ${agent.wallet.address}`);
  }

  const deployerFinal = await provider.getBalance(deployer.address);
  console.log(`\nDeployer remaining: ${ethers.formatEther(deployerFinal)} OKB`);
  console.log("\nNext: npm run agents:bootstrap\n");
}

main().catch(console.error);

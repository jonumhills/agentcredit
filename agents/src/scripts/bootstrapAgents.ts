/**
 * bootstrapAgents.ts
 *
 * One-time setup for all 11 agents:
 *   1. Register on AgentRegistry (onchain, via platform API)
 *   2. Run KYA — compute + write trust score onchain
 *   3. LENDERS: deposit liquidity + set terms on LoanEscrow
 *
 * Updates agents.json with registered/kyaPassed/trustScore state.
 *
 * Run: npm run agents:bootstrap
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { LENDER_CONFIGS } from "../config/agents.config";

const AGENTS_FILE = path.join(__dirname, "../../agents.json");
const API_BASE    = process.env.BACKEND_URL || "http://localhost:3001";
const TESTNET_RPC = process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech";

const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 30000 });

// LoanEscrow ABI — only what we need for deposit + setTerms
const LOAN_ESCROW_ABI = [
  "function deposit() external payable",
  "function setTerms(uint256 maxLoanSize, uint8 minBorrowerScore, uint256 interestRateBps, uint256 maxDurationSeconds) external",
  "function lenderTerms(address) external view returns (address lender, uint256 availableLiquidity, uint256 maxLoanSize, uint8 minBorrowerScore, uint256 interestRateBps, uint256 maxDurationSeconds, bool active)",
];

function loadAgents() {
  if (!fs.existsSync(AGENTS_FILE)) {
    console.error("❌ agents.json not found — run npm run agents:create first");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(AGENTS_FILE, "utf-8"));
}

function saveAgents(agents: any[]) {
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
}

// ── Step 1: Register ──────────────────────────────────────────────────────────

async function registerAgent(wallet: string, role: string): Promise<boolean> {
  try {
    const res = await api.post("/kya/register", { wallet, role });
    return res.data?.success === true;
  } catch (err: any) {
    const msg = err.response?.data?.error || err.message;
    if (msg?.includes("Already registered")) return true;  // idempotent
    console.log(`    ⚠ Register failed: ${msg}`);
    return false;
  }
}

// ── Step 2: KYA ───────────────────────────────────────────────────────────────

async function runKYA(wallet: string): Promise<number> {
  try {
    const res = await api.post("/kya/score", { wallet });
    return res.data?.total ?? 0;
  } catch (err: any) {
    console.log(`    ⚠ KYA failed: ${err.response?.data?.error || err.message}`);
    return 0;
  }
}

// ── Step 3: Lender deposit + set terms ───────────────────────────────────────

async function depositAndSetTerms(agent: any): Promise<boolean> {
  const config = LENDER_CONFIGS.find((c) => c.id === agent.id);
  if (!config) return false;

  const provider   = new ethers.JsonRpcProvider(TESTNET_RPC);
  const signer     = new ethers.Wallet(agent.wallet.privateKey, provider);
  const escrowAddr = process.env.LOAN_ESCROW_ADDRESS;
  if (!escrowAddr) throw new Error("LOAN_ESCROW_ADDRESS not set");

  const escrow = new ethers.Contract(escrowAddr, LOAN_ESCROW_ABI, signer);

  const balance = await provider.getBalance(signer.address);
  const depositWei = ethers.parseEther(config.goals.depositAmountEth);

  if (balance < depositWei) {
    console.log(`    ⚠ Insufficient balance (${ethers.formatEther(balance)} OKB) for deposit of ${config.goals.depositAmountEth} OKB`);
    return false;
  }

  // Check if already deposited
  const terms = await escrow.lenderTerms(signer.address);
  if (terms.availableLiquidity > 0n) {
    console.log(`    ⏭  Already deposited — liquidity: ${ethers.formatEther(terms.availableLiquidity)} OKB`);
    return true;
  }

  console.log(`    → Depositing ${config.goals.depositAmountEth} OKB...`);
  const depositTx = await escrow.deposit({ value: depositWei });
  await depositTx.wait();
  console.log(`    ✓ Deposited — tx: ${depositTx.hash}`);

  console.log(`    → Setting terms (minScore: ${config.goals.minBorrowerScore}, rate: ${config.goals.interestRateBps}bps)...`);
  const termsTx = await escrow.setTerms(
    ethers.parseEther(config.goals.maxLoanSizeEth),
    config.goals.minBorrowerScore,
    config.goals.interestRateBps,
    config.goals.maxDurationDays * 24 * 60 * 60   // convert days → seconds
  );
  await termsTx.wait();
  console.log(`    ✓ Terms set — tx: ${termsTx.hash}`);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║    AgentCredit — Bootstrap Agents     ║");
  console.log("╚══════════════════════════════════════╝\n");

  const agents = loadAgents();

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    console.log(`\n[${i + 1}/${agents.length}] ${agent.name} (${agent.role}) — ${agent.wallet.address}`);

    // ── Register ───────────────────────────────────────────────────────
    if (!agent.registered) {
      console.log(`  Step 1: Registering...`);
      const ok = await registerAgent(agent.wallet.address, agent.role);
      if (ok) {
        agents[i].registered = true;
        saveAgents(agents);
        console.log(`  ✓ Registered as ${agent.role}`);
      }
    } else {
      console.log(`  Step 1: ⏭  Already registered`);
    }

    // ── KYA ────────────────────────────────────────────────────────────
    if (!agent.kyaPassed) {
      console.log(`  Step 2: Running KYA...`);
      const score = await runKYA(agent.wallet.address);
      agents[i].trustScore = score;
      if (score >= 41) {
        agents[i].kyaPassed = true;
        console.log(`  ✓ KYA passed — trust score: ${score}`);
      } else {
        console.log(`  ✗ KYA score too low: ${score} (need ≥41)`);
      }
      saveAgents(agents);
    } else {
      console.log(`  Step 2: ⏭  KYA already passed (score: ${agent.trustScore})`);
    }

    // ── Lender deposit ─────────────────────────────────────────────────
    if (agent.role === "LENDER" && agent.kyaPassed && agent.wallet.privateKey) {
      console.log(`  Step 3: Deposit + set terms...`);
      try {
        await depositAndSetTerms(agent);
      } catch (err: any) {
        console.log(`  ✗ Deposit failed: ${err.message}`);
      }
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  // Print final state
  console.log("\n── Bootstrap Complete ──────────────────────────────────────────");
  console.log("Name               Role       Score  KYA    Registered");
  console.log("─────────────────────────────────────────────────────────");
  for (const a of agents) {
    const score = String(a.trustScore).padStart(5);
    const kya   = a.kyaPassed   ? "✓" : "✗";
    const reg   = a.registered  ? "✓" : "✗";
    console.log(`${a.name.padEnd(18)} ${a.role.padEnd(10)} ${score}  ${kya}      ${reg}`);
  }
  console.log("\nNext: npm run agents:start\n");
}

main().catch(console.error);

/**
 * orchestrator.ts
 *
 * Runs all 11 agents on an hourly cycle using Claude API + tool use.
 * Each agent is autonomous — it reads its own state and decides what to do.
 *
 * Lender cycle (every 60 min):
 *   - Check liquidity
 *   - Top up deposit if below threshold
 *   - Log active loans and earnings
 *
 * Borrower cycle (every 60 min):
 *   - Check if active loan exists
 *   - If no loan → request a new one
 *   - If loan due within 2h → repay it
 *   - Log decision and reasoning
 *
 * Run: npm run agents:start
 */

import Anthropic from "@anthropic-ai/sdk";
import { ethers }  from "ethers";
import * as fs     from "fs";
import * as path   from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: require("path").join(__dirname, "../../.env") });

import { LENDER_CONFIGS, BORROWER_CONFIGS } from "./config/agents.config";

const AGENTS_FILE = path.join(__dirname, "../agents.json");
const API_BASE    = process.env.BACKEND_URL || "http://localhost:3001";
const TESTNET_RPC = process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech";
const CYCLE_MS    = 60 * 60 * 1000;   // 60 minutes

const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const provider   = new ethers.JsonRpcProvider(TESTNET_RPC);

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentRecord {
  id: string;
  name: string;
  role: "LENDER" | "BORROWER";
  wallet: { address: string; privateKey: string };
  registered: boolean;
  kyaPassed: boolean;
  trustScore: number;
}

interface AgentState {
  record:       AgentRecord;
  activeLoanId: number | null;
  cycleCount:   number;
  lastCycleAt:  string | null;
  totalEarned:  string;    // ETH string
  totalBorrowed:string;
}

// ── Shared platform tools ─────────────────────────────────────────────────────

import axios from "axios";
const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 20000 });

async function apiCall(method: "get" | "post", path: string, data?: object): Promise<any> {
  try {
    const res = method === "get" ? await api.get(path) : await api.post(path, data);
    return res.data;
  } catch (err: any) {
    return { error: err.response?.data?.error || err.message };
  }
}

// ── Lender Agent ──────────────────────────────────────────────────────────────

const LOAN_ESCROW_ABI = [
  "function deposit() external payable",
  "function setTerms(uint256 maxLoanSize, uint8 minBorrowerScore, uint256 interestRateBps, uint256 maxDurationSeconds) external",
  "function lenderTerms(address) external view returns (address lender, uint256 availableLiquidity, uint256 maxLoanSize, uint8 minBorrowerScore, uint256 interestRateBps, uint256 maxDurationSeconds, bool active)",
  "function getLenderLoans(address lender) external view returns (uint256[])",
];

function lenderTools(config: typeof LENDER_CONFIGS[0]): Anthropic.Tool[] {
  return [
    {
      name: "check_liquidity",
      description: "Check current available liquidity in LoanEscrow for this lender.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "top_up_deposit",
      description: "Deposit more OKB into LoanEscrow to replenish liquidity.",
      input_schema: {
        type: "object" as const,
        properties: {
          amount_eth: { type: "string", description: "Amount of OKB to deposit" },
        },
        required: ["amount_eth"],
      },
    },
    {
      name: "get_active_loans",
      description: "Get all loan IDs for this lender and their current status.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "get_trust_score",
      description: "Get current trust score for this lender.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "log",
      description: "Log a decision or status update.",
      input_schema: {
        type: "object" as const,
        properties: { message: { type: "string" } },
        required: ["message"],
      },
    },
  ];
}

async function handleLenderTool(name: string, input: any, state: AgentState): Promise<string> {
  const { record } = state;
  const config = LENDER_CONFIGS.find((c) => c.id === record.id)!;
  const escrowAddr = process.env.LOAN_ESCROW_ADDRESS!;

  switch (name) {
    case "check_liquidity": {
      const escrow = new ethers.Contract(escrowAddr, LOAN_ESCROW_ABI, provider);
      const terms  = await escrow.lenderTerms(record.wallet.address);
      const walBal = await provider.getBalance(record.wallet.address);
      return JSON.stringify({
        availableLiquidity: ethers.formatEther(terms.availableLiquidity),
        walletBalance:      ethers.formatEther(walBal),
        minBorrowerScore:   terms.minBorrowerScore,
        interestRateBps:    Number(terms.interestRateBps),
        active:             terms.active,
      });
    }
    case "top_up_deposit": {
      if (!record.wallet.privateKey) return JSON.stringify({ error: "No private key" });
      const signer = new ethers.Wallet(record.wallet.privateKey, provider);
      const escrow = new ethers.Contract(escrowAddr, LOAN_ESCROW_ABI, signer);
      const depositWei = ethers.parseEther(input.amount_eth);
      const balance    = await provider.getBalance(signer.address);
      if (balance < depositWei) {
        return JSON.stringify({ error: `Insufficient balance: ${ethers.formatEther(balance)} OKB` });
      }
      const tx = await escrow.deposit({ value: depositWei });
      await tx.wait();
      return JSON.stringify({ success: true, txHash: tx.hash, deposited: input.amount_eth });
    }
    case "get_active_loans": {
      const escrow = new ethers.Contract(escrowAddr, LOAN_ESCROW_ABI, provider);
      const ids    = await escrow.getLenderLoans(record.wallet.address);
      const loans  = await Promise.all(
        ids.map(async (id: bigint) => {
          const data = await apiCall("get", `/loans/${id.toString()}`);
          return data;
        })
      );
      return JSON.stringify({ loans, totalLoans: loans.length });
    }
    case "get_trust_score": {
      const data = await apiCall("get", `/kya/score/${record.wallet.address}`);
      return JSON.stringify(data);
    }
    case "log": {
      console.log(`  [${record.name}] ${input.message}`);
      return "logged";
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function runLenderCycle(state: AgentState) {
  const { record } = state;
  const config     = LENDER_CONFIGS.find((c) => c.id === record.id)!;

  console.log(`\n  🏦 [${record.name}] Lender cycle #${state.cycleCount + 1}`);

  const system = `You are ${record.name}, an autonomous AI lending agent on AgentCredit (X Layer blockchain).

Your profile:
- Role: LENDER
- Wallet: ${record.wallet.address}
- Trust Score: ${record.trustScore}
- Personality: ${config.personality}
- Target yield: ${config.goals.interestRateBps / 100}% APR
- Min borrower score: ${config.goals.minBorrowerScore}
- Max loan size: ${config.goals.maxLoanSizeEth} OKB

Your job this cycle:
1. Check your current liquidity in LoanEscrow
2. If available liquidity < 0.003 OKB, top up with a small deposit
3. Check active loans — note any completed ones
4. Log your current status and any decisions made

Be concise. Make real decisions based on the data.`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "Run your lending cycle. Check liquidity, review loans, and take any necessary actions." },
  ];

  const tools = lenderTools(config);
  let iterations = 0;

  while (iterations < 8) {
    iterations++;
    const res = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn") break;
    if (res.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const result = await handleLenderTool(block.name, block.input, state);
      results.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }
    messages.push({ role: "user", content: results });
  }

  state.cycleCount++;
  state.lastCycleAt = new Date().toISOString();
}

// ── Borrower Agent ────────────────────────────────────────────────────────────

function borrowerTools(): Anthropic.Tool[] {
  return [
    {
      name: "get_active_loan",
      description: "Check if this borrower has an active loan and its repayment status.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "get_available_lenders",
      description: "Get list of active lenders and their terms.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "request_loan",
      description: "Request a loan from the best available lender.",
      input_schema: {
        type: "object" as const,
        properties: {
          amount_eth: { type: "string" },
          duration_days: { type: "number" },
          purpose: { type: "string" },
        },
        required: ["amount_eth", "duration_days", "purpose"],
      },
    },
    {
      name: "repay_loan",
      description: "Repay an active loan before the deadline.",
      input_schema: {
        type: "object" as const,
        properties: { loan_id: { type: "number" } },
        required: ["loan_id"],
      },
    },
    {
      name: "get_trust_score",
      description: "Get current trust score.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "get_wallet_balance",
      description: "Check current OKB wallet balance.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    },
    {
      name: "log",
      description: "Log a decision or status update.",
      input_schema: {
        type: "object" as const,
        properties: { message: { type: "string" } },
        required: ["message"],
      },
    },
  ];
}

async function handleBorrowerTool(name: string, input: any, state: AgentState): Promise<string> {
  const { record } = state;

  switch (name) {
    case "get_active_loan": {
      if (state.activeLoanId === null) {
        return JSON.stringify({ activeLoan: null, message: "No active loan" });
      }
      const loan = await apiCall("get", `/loans/${state.activeLoanId}`);
      return JSON.stringify(loan);
    }
    case "get_available_lenders": {
      const data = await apiCall("get", "/loans/lenders/active");
      return JSON.stringify(data);
    }
    case "request_loan": {
      const result = await apiCall("post", "/loans/request", {
        borrower:    record.wallet.address,
        amountEth:   input.amount_eth,
        durationDays:input.duration_days,
        purpose:     input.purpose,
      });
      if (result.loanId !== undefined) {
        state.activeLoanId = result.loanId;
      }
      return JSON.stringify(result);
    }
    case "repay_loan": {
      const result = await apiCall("post", `/loans/${input.loan_id}/repay`);
      if (result.success) {
        state.activeLoanId = null;
      }
      return JSON.stringify(result);
    }
    case "get_trust_score": {
      const data = await apiCall("get", `/kya/score/${record.wallet.address}`);
      if (data.score) state.record.trustScore = data.score;
      return JSON.stringify(data);
    }
    case "get_wallet_balance": {
      const balance = await provider.getBalance(record.wallet.address);
      return JSON.stringify({ balanceOKB: ethers.formatEther(balance) });
    }
    case "log": {
      console.log(`  [${record.name}] ${input.message}`);
      return "logged";
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function runBorrowerCycle(state: AgentState) {
  const { record } = state;
  const config     = BORROWER_CONFIGS.find((c) => c.id === record.id)!;

  console.log(`\n  💳 [${record.name}] Borrower cycle #${state.cycleCount + 1}`);

  const system = `You are ${record.name}, an autonomous AI borrower agent on AgentCredit (X Layer blockchain).

Your profile:
- Role: BORROWER
- Wallet: ${record.wallet.address}
- Trust Score: ${record.trustScore}
- Personality: ${config.personality}
- Preferred loan: ${config.goals.loanAmountEth} OKB for ${config.goals.preferredDurationDays} day(s)
- Max rate: ${config.goals.maxInterestRateBps / 100}% APR
- Purpose: ${config.goals.purpose}
- Active loan ID: ${state.activeLoanId ?? "none"}

Your job this cycle:
1. Check wallet balance and current trust score
2. If you have an active loan:
   - Check if it's due within 2 hours → repay it immediately
   - Otherwise → log status and wait
3. If no active loan:
   - Check available lenders
   - If a lender's rate is ≤ your max rate AND your score qualifies → request a loan
   - If no suitable lender → log and wait
4. Always explain your reasoning

Make autonomous decisions. Be a responsible borrower.`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: "Run your borrowing cycle. Check your status and take the right action." },
  ];

  let iterations = 0;
  while (iterations < 10) {
    iterations++;
    const res = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system,
      tools:      borrowerTools(),
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn") break;
    if (res.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const result = await handleBorrowerTool(block.name, block.input, state);
      results.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }
    messages.push({ role: "user", content: results });
  }

  state.cycleCount++;
  state.lastCycleAt = new Date().toISOString();
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

async function runCycle(states: AgentState[]) {
  const now = new Date().toISOString();
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  AgentCredit Orchestrator — ${now}`);
  console.log(`  Running ${states.length} agents`);
  console.log(`${"═".repeat(60)}`);

  // Run all agents concurrently (but with a small stagger to avoid API rate limits)
  const lenders   = states.filter((s) => s.record.role === "LENDER");
  const borrowers = states.filter((s) => s.record.role === "BORROWER");

  console.log(`\n── Lenders (${lenders.length}) ─────────────────────────────────`);
  for (const state of lenders) {
    await runLenderCycle(state);
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n── Borrowers (${borrowers.length}) ───────────────────────────────`);
  for (const state of borrowers) {
    await runBorrowerCycle(state);
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n✅ Cycle complete. Next run in ${CYCLE_MS / 60000} minutes.\n`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   AgentCredit Orchestrator — Hourly Loop      ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  if (!fs.existsSync(AGENTS_FILE)) {
    console.error("❌ agents.json not found — run npm run agents:create && agents:bootstrap first");
    process.exit(1);
  }

  const records: AgentRecord[] = JSON.parse(fs.readFileSync(AGENTS_FILE, "utf-8"));
  const eligible = records.filter((r) => r.kyaPassed);

  if (eligible.length === 0) {
    console.error("❌ No KYA-approved agents found — run npm run agents:bootstrap first");
    process.exit(1);
  }

  console.log(`Starting ${eligible.length} agents (${records.length - eligible.length} skipped — KYA not passed)\n`);

  const states: AgentState[] = eligible.map((r) => ({
    record:        r,
    activeLoanId:  null,
    cycleCount:    0,
    lastCycleAt:   null,
    totalEarned:   "0",
    totalBorrowed: "0",
  }));

  // Run immediately, then every CYCLE_MS
  await runCycle(states);
  setInterval(() => runCycle(states), CYCLE_MS);
}

main().catch(console.error);

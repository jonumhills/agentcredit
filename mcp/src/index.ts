#!/usr/bin/env node
/**
 * AgentCredit MCP Server
 *
 * Exposes AgentCredit's lending protocol as MCP tools so any Claude-based
 * agent (Claude Code, Claude Desktop, any MCP client) can:
 *   - Register as a lender or borrower
 *   - Run KYA to get a trust score
 *   - Browse active lenders and their terms
 *   - Request and repay loans
 *   - Check the trust score leaderboard
 *
 * Usage (Claude Code):
 *   claude mcp add agentcredit -- npx tsx /path/to/mcp/src/index.ts
 *
 * Usage (Claude Desktop — claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "agentcredit": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/agentcredit/mcp/src/index.ts"],
 *         "env": { "AGENTCREDIT_API_URL": "http://localhost:3001" }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const API_URL = process.env.AGENTCREDIT_API_URL || "http://localhost:3001";

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30000 });

// ── Server setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "agentcredit",
  version: "0.1.0",
});

// ── Helper ───────────────────────────────────────────────────────────────────

async function call(method: "get" | "post", path: string, data?: object): Promise<string> {
  try {
    const res = method === "get"
      ? await api.get(path)
      : await api.post(path, data);
    return JSON.stringify(res.data, null, 2);
  } catch (err: any) {
    const msg = err.response?.data?.error || err.message || "Unknown error";
    return JSON.stringify({ error: msg });
  }
}

// ── Tools ─────────────────────────────────────────────────────────────────────

/**
 * 1. agentcredit_status
 * Check platform health and deployed contract addresses.
 */
server.tool(
  "agentcredit_status",
  "Check AgentCredit platform health, network status, and deployed contract addresses on X Layer.",
  {},
  async () => ({
    content: [{ type: "text", text: await call("get", "/health") }],
  })
);

/**
 * 2. agentcredit_register
 * Register a wallet as a Lender or Borrower on AgentCredit.
 */
server.tool(
  "agentcredit_register",
  "Register an OKX Agentic Wallet on AgentCredit as a LENDER or BORROWER. This writes the agent identity to the AgentRegistry smart contract on X Layer. Required before running KYA or requesting loans.",
  {
    wallet: z.string().describe("The agent's OKX Agentic Wallet address (0x...)"),
    role: z.enum(["LENDER", "BORROWER"]).describe("The role to register: LENDER deposits liquidity, BORROWER requests loans"),
  },
  async ({ wallet, role }) => ({
    content: [{ type: "text", text: await call("post", "/kya/register", { wallet, role }) }],
  })
);

/**
 * 3. agentcredit_run_kya
 * Run Know Your Agent (KYA) — compute and write trust score onchain.
 */
server.tool(
  "agentcredit_run_kya",
  "Run the Know Your Agent (KYA) process for a wallet. Computes a trust score (0–100) using 5 factors: onchain TX activity (30%), loan repayment history (25%), wallet balance (20%), DEX trading (15%), wallet age (10%). Writes the score to the TrustScore contract on X Layer. Score must be ≥41 to participate.",
  {
    wallet: z.string().describe("The wallet address to run KYA on"),
  },
  async ({ wallet }) => ({
    content: [{ type: "text", text: await call("post", "/kya/score", { wallet }) }],
  })
);

/**
 * 4. agentcredit_get_score
 * Get current trust score and tier for a wallet.
 */
server.tool(
  "agentcredit_get_score",
  "Get the current trust score, tier, and loan history for a wallet address. Tiers: NO_ACCESS (0-40), SMALL_ONLY (41-60), MEDIUM (61-80), FULL_ACCESS (81-100).",
  {
    wallet: z.string().describe("The wallet address to check"),
  },
  async ({ wallet }) => ({
    content: [{ type: "text", text: await call("get", `/kya/score/${wallet}`) }],
  })
);

/**
 * 5. agentcredit_get_agents
 * List all registered agents with their trust scores and KYA status.
 */
server.tool(
  "agentcredit_get_agents",
  "List all agents registered on AgentCredit with their trust scores, roles, and KYA verification status.",
  {},
  async () => ({
    content: [{ type: "text", text: await call("get", "/agents") }],
  })
);

/**
 * 6. agentcredit_leaderboard
 * Top agents ranked by trust score.
 */
server.tool(
  "agentcredit_leaderboard",
  "Get the top agents on AgentCredit ranked by trust score. Useful for understanding what score is competitive and who the most reputable agents are.",
  {},
  async () => ({
    content: [{ type: "text", text: await call("get", "/agents/leaderboard") }],
  })
);

/**
 * 7. agentcredit_get_agent_profile
 * Detailed profile for a specific agent.
 */
server.tool(
  "agentcredit_get_agent_profile",
  "Get the full profile for a specific agent wallet: role, trust score breakdown, loan history, and KYA status.",
  {
    wallet: z.string().describe("The agent's wallet address"),
  },
  async ({ wallet }) => ({
    content: [{ type: "text", text: await call("get", `/agents/${wallet}`) }],
  })
);

/**
 * 8. agentcredit_get_lenders
 * Browse active lenders and their current terms.
 */
server.tool(
  "agentcredit_get_lenders",
  "Browse all active lenders on AgentCredit and their loan terms: available liquidity, interest rate (APR), minimum borrower trust score required, max loan size, and max duration. Use this to find the best lender before requesting a loan.",
  {},
  async () => ({
    content: [{ type: "text", text: await call("get", "/loans/lenders/active") }],
  })
);

/**
 * 9. agentcredit_request_loan
 * Borrower agent requests a loan.
 */
server.tool(
  "agentcredit_request_loan",
  "Request a loan from AgentCredit as a borrower agent. The platform will automatically find the best matching lender based on your trust score and the requested terms. Requires KYA trust score ≥41. Loan is disbursed via x402 protocol to the borrower's OKX Agentic Wallet.",
  {
    borrower: z.string().describe("The borrower's wallet address (must be registered + KYA passed)"),
    amountEth: z.string().describe("Amount to borrow in OKB/ETH (e.g. '0.1')"),
    durationDays: z.number().int().min(1).max(90).describe("Loan duration in days (1–90)"),
    purpose: z.string().describe("What the loan will be used for (e.g. 'DeFi yield farming on X Layer')"),
  },
  async ({ borrower, amountEth, durationDays, purpose }) => ({
    content: [{
      type: "text",
      text: await call("post", "/loans/request", { borrower, amountEth, durationDays, purpose }),
    }],
  })
);

/**
 * 10. agentcredit_get_loan
 * Get details of a specific loan.
 */
server.tool(
  "agentcredit_get_loan",
  "Get full details of a loan: status (ACTIVE/REPAID/DEFAULTED), lender, borrower, principal, interest rate, due date, and total amount owed.",
  {
    loanId: z.number().int().min(0).describe("The loan ID (returned when loan was created)"),
  },
  async ({ loanId }) => ({
    content: [{ type: "text", text: await call("get", `/loans/${loanId}`) }],
  })
);

/**
 * 11. agentcredit_repay_loan
 * Confirm repayment of a loan.
 */
server.tool(
  "agentcredit_repay_loan",
  "Confirm repayment of an active loan. This records the repayment on-chain via the LoanEscrow contract, updates the borrower's trust score (+5 for on-time, +1 for late), and returns liquidity to the lender's pool. The actual x402 payment must be sent separately to the lender before calling this.",
  {
    loanId: z.number().int().min(0).describe("The loan ID to repay"),
  },
  async ({ loanId }) => ({
    content: [{ type: "text", text: await call("post", `/loans/${loanId}/repay`) }],
  })
);

// ── Resources ─────────────────────────────────────────────────────────────────

/**
 * Protocol guide — returned when an agent asks "how do I use this?"
 */
server.resource(
  "agentcredit://guide",
  "AgentCredit Protocol Guide",
  async () => ({
    contents: [{
      uri: "agentcredit://guide",
      mimeType: "text/plain",
      text: `
# AgentCredit — Agent Lending Protocol on X Layer

AgentCredit is a decentralized lending platform where AI agents autonomously lend
and borrow OKB (X Layer native token) using reputation-based trust scores.

## Quick Onboarding (4 steps)

### As a BORROWER:
1. agentcredit_register(wallet, "BORROWER")
2. agentcredit_run_kya(wallet)             — must score ≥41
3. agentcredit_get_lenders()               — find best terms
4. agentcredit_request_loan(wallet, amount, days, purpose)
5. agentcredit_repay_loan(loanId)          — before deadline → score +5

### As a LENDER:
1. agentcredit_register(wallet, "LENDER")
2. agentcredit_run_kya(wallet)             — must score ≥61
3. Deposit OKB to LoanEscrow contract directly (or via platform UI)
4. Borrowers automatically matched to your terms

## Trust Score Tiers
- 0–40:   NO_ACCESS — fails KYA, cannot participate
- 41–60:  SMALL_ONLY — borrow small amounts only
- 61–80:  MEDIUM — medium loans + eligible to lend
- 81–100: FULL_ACCESS — best rates, largest loans

## Score Changes
- On-time repayment:  +5 points
- Late repayment:     +1 point
- Default:            -20 points (permanent onchain flag)

## Contracts (X Layer Testnet, chainId 1952)
- AgentRegistry: 0x7342A312979b28163360CFD60a5EC006B2B1eA8a
- TrustScore:    0x6B915189C6d37Da79d42E033dac16F69C8C37164
- LoanEscrow:    0x8436Fbe0D6BAF0e87A14e26ab0c921a963Baf118

## Interest Rate
Lenders set their own rates (typically 3–8% APR).
Total repayment = principal × (1 + interestBps / 10000)
`.trim(),
    }],
  })
);

// ── Start server ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentCredit MCP server running — waiting for connections");
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});

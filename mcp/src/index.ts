#!/usr/bin/env node
/**
 * BancoProtocol MCP Server — HTTP/SSE transport
 *
 * Exposes BancoProtocol's lending protocol as MCP tools over HTTP so any
 * remote agent (Hostinger, cloud, etc.) can call it via SSE.
 *
 * Endpoints:
 *   GET  /sse          — SSE connection (agent subscribes here)
 *   POST /messages     — agent sends tool calls here
 *   GET  /health       — liveness check
 *
 * Env vars:
 *   AGENTCREDIT_API_URL   — BancoProtocol backend URL (default: http://localhost:3001)
 *   PORT                  — HTTP port to bind (default: 3002)
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import axios from "axios";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const API_URL = process.env.AGENTCREDIT_API_URL
  || process.env.BACKEND_URL
  || "http://localhost:3001";

const PORT = Number(process.env.PORT || 3002);

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30_000 });

// ── Helper ────────────────────────────────────────────────────────────────────

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

// ── Build MCP server + register tools ────────────────────────────────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "bancoprotocol",
    version: "0.1.0",
  });

  // ── 1. Status ──────────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_status",
    "Check BancoProtocol platform health, network status, and deployed contract addresses on X Layer Testnet.",
    {},
    async () => ({
      content: [{ type: "text", text: await call("get", "/health") }],
    })
  );

  // ── 2. Register ────────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_register",
    "Register an OKX Agentic Wallet on BancoProtocol as a LENDER or BORROWER. Writes agent identity to the AgentRegistry smart contract on X Layer. Must be called before running KYA or requesting loans.",
    {
      wallet: z.string().describe("The agent's wallet address (0x...)"),
      role: z.enum(["LENDER", "BORROWER"]).describe("LENDER deposits liquidity and earns interest. BORROWER requests loans against trust score."),
      name: z.string().optional().describe("Optional display name for the agent (e.g. 'Choki', 'TradingBot-1'). Shown on the dashboard."),
    },
    async ({ wallet, role, name }) => ({
      content: [{ type: "text", text: await call("post", "/kya/register", { wallet, role, name }) }],
    })
  );

  // ── 3. Run KYA ─────────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_run_kya",
    "Run Know Your Agent (KYA) for a wallet. Scores 5 factors: onchain TX activity (30%), loan repayment history (25%), wallet balance (20%), DEX trading (15%), wallet age (10%). Writes score 0–100 to TrustScore contract. Score must be ≥41 to participate.",
    {
      wallet: z.string().describe("Wallet address to run KYA on"),
    },
    async ({ wallet }) => ({
      content: [{ type: "text", text: await call("post", "/kya/score", { wallet }) }],
    })
  );

  // ── 4. Get score ───────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_get_score",
    "Get current trust score and tier for a wallet. Tiers: NO_ACCESS (0–40), SMALL_ONLY (41–60), MEDIUM (61–80), FULL_ACCESS (81–100).",
    {
      wallet: z.string().describe("Wallet address to check"),
    },
    async ({ wallet }) => ({
      content: [{ type: "text", text: await call("get", `/kya/score/${wallet}`) }],
    })
  );

  // ── 5. List all agents ─────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_get_agents",
    "List all agents registered on BancoProtocol with their trust scores, roles, and KYA verification status.",
    {},
    async () => ({
      content: [{ type: "text", text: await call("get", "/agents") }],
    })
  );

  // ── 6. Leaderboard ─────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_leaderboard",
    "Get top agents ranked by trust score. Use this to benchmark your score and find highly reputable counterparties.",
    {},
    async () => ({
      content: [{ type: "text", text: await call("get", "/agents/leaderboard") }],
    })
  );

  // ── 7. Agent profile ───────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_get_agent_profile",
    "Get full profile for a specific wallet: role, trust score breakdown, full loan history, and KYA status.",
    {
      wallet: z.string().describe("The agent's wallet address"),
    },
    async ({ wallet }) => ({
      content: [{ type: "text", text: await call("get", `/agents/${wallet}`) }],
    })
  );

  // ── 8. Browse lenders ──────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_get_lenders",
    "Browse all active lenders and their loan terms: available liquidity (OKB), interest rate (APR bps), minimum borrower trust score required, max loan size, max duration. Use this before requesting a loan to find the best match.",
    {},
    async () => ({
      content: [{ type: "text", text: await call("get", "/loans/lenders/active") }],
    })
  );

  // ── 9. Request loan ────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_request_loan",
    "Request a loan as a borrower agent. Platform auto-matches the best lender based on trust score and requested terms. Requires KYA score ≥41. Returns loanId on success.",
    {
      borrower: z.string().describe("Borrower wallet address (must be registered + KYA passed)"),
      amountEth: z.string().describe("Amount to borrow in OKB (e.g. '0.05')"),
      durationDays: z.number().min(0).max(90).optional().describe("Loan duration in days (e.g. 7). Use durationHours for short demo loans."),
      durationHours: z.number().min(1).max(72).optional().describe("Loan duration in hours for short demo loans (e.g. 6). Takes priority over durationDays."),
      purpose: z.string().describe("What the loan will be used for (e.g. 'DeFi yield farming on X Layer')"),
    },
    async ({ borrower, amountEth, durationDays, durationHours, purpose }) => ({
      content: [{
        type: "text",
        text: await call("post", "/loans/request", { borrower, amountEth, durationDays, durationHours, purpose }),
      }],
    })
  );

  // ── 10. Get loan ───────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_get_loan",
    "Get full details of a loan: status (ACTIVE/REPAID/DEFAULTED), lender, borrower, principal, interest rate, due date, total amount owed.",
    {
      loanId: z.number().int().min(0).describe("The loan ID returned when loan was created"),
    },
    async ({ loanId }) => ({
      content: [{ type: "text", text: await call("get", `/loans/${loanId}`) }],
    })
  );

  // ── 11. Repay loan ─────────────────────────────────────────────────────────
  server.tool(
    "bancoprotocol_repay_loan",
    "Confirm repayment of an active loan. Records repayment on-chain, updates borrower trust score (+5 on-time, +1 late), and returns liquidity to lender. Call this after the OKB transfer has been sent.",
    {
      loanId: z.number().int().min(0).describe("The loan ID to repay"),
    },
    async ({ loanId }) => ({
      content: [{ type: "text", text: await call("post", `/loans/${loanId}/repay`) }],
    })
  );

  // ── Protocol guide resource ────────────────────────────────────────────────
  server.resource(
    "bancoprotocol://guide",
    "BancoProtocol Agent Guide",
    async () => ({
      contents: [{
        uri: "bancoprotocol://guide",
        mimeType: "text/plain",
        text: `
# BancoProtocol — Agent Lending on X Layer Testnet

Reputation-based, undercollateralized lending for AI agents.
Trust score ≥41 required to borrow. ≥61 to lend.

## Borrower Flow (5 steps)
1. bancoprotocol_register(wallet, "BORROWER")
2. bancoprotocol_run_kya(wallet)           — get a score ≥41
3. bancoprotocol_get_lenders()             — pick the best terms
4. bancoprotocol_request_loan(wallet, amountEth, durationDays, purpose)
5. bancoprotocol_repay_loan(loanId)        — before due date → score +5

## Lender Flow
1. bancoprotocol_register(wallet, "LENDER")
2. bancoprotocol_run_kya(wallet)           — must score ≥61
3. Deposit OKB via LoanEscrow contract
4. Borrowers are automatically matched to your terms

## Trust Score Tiers
- 0–40:   NO_ACCESS  — cannot participate
- 41–60:  SMALL_ONLY — small loans only
- 61–80:  MEDIUM     — medium loans + eligible to lend
- 81–100: FULL_ACCESS — best rates, largest loans

## Score Changes per Repayment
- On-time: +5 pts  |  Late: +1 pt  |  Default: -20 pts

## Contracts (X Layer Testnet · chainId 1952)
AgentRegistry: 0x7342A312979b28163360CFD60a5EC006B2B1eA8a
TrustScore:    0x6B915189C6d37Da79d42E033dac16F69C8C37164
LoanEscrow:    0x8436Fbe0D6BAF0e87A14e26ab0c921a963Baf118
`.trim(),
      }],
    })
  );

  return server;
}

// ── Express app + SSE transport ───────────────────────────────────────────────

const app = express();
app.use(express.json());

// Map of sessionId → SSEServerTransport (one per connected client)
const transports = new Map<string, SSEServerTransport>();

// GET /sse — client opens this to establish the SSE stream
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);

  res.on("close", () => {
    transports.delete(sessionId);
  });

  const mcpServer = buildMcpServer();
  await mcpServer.connect(transport);
});

// POST /messages — client sends JSON-RPC tool calls here
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(400).json({ error: "Unknown sessionId — connect via /sse first" });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

// GET /health — liveness probe
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "bancoprotocol-mcp",
    version: "0.1.0",
    backend: API_URL,
    endpoints: {
      sse: "/sse",
      messages: "/messages",
    },
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BancoProtocol MCP server listening on port ${PORT}`);
  console.log(`  SSE endpoint:  http://0.0.0.0:${PORT}/sse`);
  console.log(`  Messages:      http://0.0.0.0:${PORT}/messages`);
  console.log(`  Backend:       ${API_URL}`);
});

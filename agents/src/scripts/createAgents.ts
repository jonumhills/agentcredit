/**
 * createAgents.ts
 *
 * Creates OKX Agentic Wallets for all 11 agents (4 lenders + 7 borrowers).
 * Falls back to local ethers wallets if OKX WaaS API is unavailable.
 *
 * Output: agents/agents.json  (gitignored — contains private keys)
 *
 * Run: npx ts-node-dev --transpile-only src/scripts/createAgents.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { ALL_AGENT_CONFIGS } from "../config/agents.config";

const AGENTS_FILE = path.join(__dirname, "../../agents.json");

export interface AgentWallet {
  address: string;
  privateKey: string;
  okxWalletId?: string;       // set if created via OKX WaaS
  source: "okx" | "local";
}

export interface AgentRecord {
  id: string;
  name: string;
  role: "LENDER" | "BORROWER";
  wallet: AgentWallet;
  registered: boolean;
  kyaPassed: boolean;
  trustScore: number;
  createdAt: string;
}

// ── OKX WaaS wallet creation ──────────────────────────────────────────────────

function buildOKXHeaders(method: string, requestPath: string, body = ""): Record<string, string> {
  const timestamp = new Date().toISOString();
  const secretKey  = process.env.OKX_SECRET_KEY   || "";
  const apiKey     = process.env.OKX_API_KEY       || "";
  const passphrase = process.env.OKX_PASSPHRASE    || "";
  const projectId  = process.env.OKX_PROJECT_ID    || "";

  const prehash  = timestamp + method.toUpperCase() + requestPath + body;
  const signature = crypto.createHmac("sha256", secretKey).update(prehash).digest("base64");

  return {
    "OK-ACCESS-KEY":       apiKey,
    "OK-ACCESS-SIGN":      signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE":passphrase,
    "OK-ACCESS-PROJECT":   projectId,
    "Content-Type":        "application/json",
  };
}

async function createOKXAgenticWallet(name: string): Promise<AgentWallet> {
  const requestPath = "/api/v5/waas/wallet/create-wallet";
  const bodyObj = { name, chainIndex: "195" };   // 195 = X Layer testnet
  const body    = JSON.stringify(bodyObj);
  const headers = buildOKXHeaders("POST", requestPath, body);

  const res = await axios.post(
    `https://www.okx.com${requestPath}`,
    bodyObj,
    { headers, timeout: 10000 }
  );

  if (res.data?.code !== "0") {
    throw new Error(`OKX WaaS error: ${JSON.stringify(res.data)}`);
  }

  const data = res.data?.data?.[0];
  if (!data?.addresses?.[0]?.address) {
    throw new Error(`No address in OKX WaaS response: ${JSON.stringify(res.data)}`);
  }

  return {
    address:     data.addresses[0].address,
    privateKey:  data.addresses[0].privateKey || "",
    okxWalletId: data.walletId,
    source:      "okx",
  };
}

async function createLocalWallet(): Promise<AgentWallet> {
  const w = ethers.Wallet.createRandom();
  return {
    address:    w.address,
    privateKey: w.privateKey,
    source:     "local",
  };
}

async function createWallet(name: string): Promise<AgentWallet> {
  const hasOKXKeys =
    process.env.OKX_API_KEY &&
    process.env.OKX_SECRET_KEY &&
    process.env.OKX_PROJECT_ID;

  if (hasOKXKeys) {
    try {
      console.log(`  → Trying OKX WaaS for ${name}...`);
      const wallet = await createOKXAgenticWallet(name);
      console.log(`  ✓ OKX Agentic Wallet: ${wallet.address}`);
      return wallet;
    } catch (err: any) {
      console.log(`  ⚠ OKX WaaS failed (${err.message}) — using local wallet`);
    }
  }

  const wallet = await createLocalWallet();
  console.log(`  ✓ Local EVM wallet: ${wallet.address}`);
  return wallet;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║      AgentCredit — Create Agents      ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Load existing file if present (avoid re-creating wallets)
  let existing: AgentRecord[] = [];
  if (fs.existsSync(AGENTS_FILE)) {
    existing = JSON.parse(fs.readFileSync(AGENTS_FILE, "utf-8"));
    console.log(`ℹ  Found ${existing.length} existing agents in agents.json\n`);
  }

  const existingIds = new Set(existing.map((a) => a.id));
  const records: AgentRecord[] = [...existing];

  for (const config of ALL_AGENT_CONFIGS) {
    if (existingIds.has(config.id)) {
      console.log(`⏭  Skipping ${config.name} (${config.id}) — already exists`);
      continue;
    }

    console.log(`\nCreating ${config.role}: ${config.name} (${config.id})`);
    const wallet = await createWallet(config.name);

    records.push({
      id:          config.id,
      name:        config.name,
      role:        config.role,
      wallet,
      registered:  false,
      kyaPassed:   false,
      trustScore:  0,
      createdAt:   new Date().toISOString(),
    });

    // Small delay to avoid OKX rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  fs.writeFileSync(AGENTS_FILE, JSON.stringify(records, null, 2));
  console.log(`\n✅ ${records.length} agents saved to agents.json\n`);

  // Print summary table
  console.log("┌─────────────────────────┬──────────┬────────────────────────────────────────────┐");
  console.log("│ Name                    │ Role     │ Address                                    │");
  console.log("├─────────────────────────┼──────────┼────────────────────────────────────────────┤");
  for (const r of records) {
    const name = r.name.padEnd(23);
    const role = r.role.padEnd(8);
    console.log(`│ ${name} │ ${role} │ ${r.wallet.address} │`);
  }
  console.log("└─────────────────────────┴──────────┴────────────────────────────────────────────┘");
  console.log("\nNext: npm run agents:fund\n");
}

main().catch(console.error);

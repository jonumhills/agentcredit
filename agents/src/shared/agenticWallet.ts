import axios from "axios";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

/**
 * OKX Agentic Wallet integration.
 *
 * Each AI agent on AgentCredit gets an OKX Agentic Wallet as their
 * onchain identity. The wallet address is their platform ID registered
 * in AgentRegistry.
 *
 * This module wraps the OKX Wallet API for:
 * - Creating a new agent wallet
 * - Querying balance
 * - Signing and sending transactions (ETH transfers via x402)
 */

interface WalletInfo {
  address: string;
  walletId: string;
  createdAt: string;
}

function buildOKXHeaders(method: string, requestPath: string, body: string = "") {
  const timestamp = new Date().toISOString();
  const apiKey = process.env.OKX_API_KEY || "";
  const secretKey = process.env.OKX_SECRET_KEY || "";
  const passphrase = process.env.OKX_PASSPHRASE || "";
  const projectId = process.env.OKX_PROJECT_ID || "";

  const prehash = timestamp + method.toUpperCase() + requestPath + body;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(prehash)
    .digest("base64");

  return {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "OK-ACCESS-PROJECT": projectId,
    "Content-Type": "application/json",
  };
}

const OKX_BASE = "https://www.okx.com";

export async function createAgentWallet(agentName: string): Promise<WalletInfo> {
  const path = "/api/v5/waas/wallet/create-wallet";
  const body = JSON.stringify({ name: agentName, chainIndex: "196" }); // X Layer chain ID
  const headers = buildOKXHeaders("POST", path, body);

  const res = await axios.post(`${OKX_BASE}${path}`, JSON.parse(body), { headers });
  const data = res.data?.data?.[0];
  if (!data) throw new Error("Failed to create OKX Agentic Wallet: " + JSON.stringify(res.data));

  return {
    address: data.address,
    walletId: data.walletId,
    createdAt: new Date().toISOString(),
  };
}

export async function getWalletBalance(address: string): Promise<string> {
  const path = `/api/v5/waas/asset/token-balances?address=${address}&chainIndex=196&tokenContractAddress=`;
  const headers = buildOKXHeaders("GET", path);
  const res = await axios.get(`${OKX_BASE}${path}`, { headers });
  const balances = res.data?.data?.[0]?.tokenAssets;
  const eth = balances?.find((b: any) => b.symbol === "ETH");
  return eth?.balance || "0";
}

export async function sendTransaction(params: {
  from: string;
  to: string;
  amountEth: string;
  data?: string;
}): Promise<string> {
  const path = "/api/v5/waas/transaction/send-transaction";
  const body = JSON.stringify({
    chainIndex: "196",
    from: params.from,
    to: params.to,
    value: params.amountEth,
    data: params.data || "0x",
  });
  const headers = buildOKXHeaders("POST", path, body);
  const res = await axios.post(`${OKX_BASE}${path}`, JSON.parse(body), { headers });
  const txHash = res.data?.data?.[0]?.txhash;
  if (!txHash) throw new Error("Transaction failed: " + JSON.stringify(res.data));
  return txHash;
}

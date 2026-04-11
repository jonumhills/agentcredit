# AgentCredit

**Agent-Native Lending Platform on X Layer** — OKX Build X Hackathon 2026

AgentCredit is the credit layer of the X Layer agent economy. It enables AI agents to onboard as lenders or borrowers, pass a Know Your Agent (KYA) process to establish a trust score, and participate in undercollateralized, reputation-based lending — autonomously, without human intervention.

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│              AgentCredit Platform (Backend)         │
│          Node.js / TypeScript + Claude API          │
│                                                     │
│  KYA Engine      → pulls onchain data via Onchain OS│
│  Trust Score     → computed offchain, stored onchain│
│  Matchmaking     → pairs lenders with borrowers     │
│  Loan Manager    → tracks active loans & repayments │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│           X Layer Smart Contracts (Solidity)        │
│                                                     │
│  AgentRegistry   → onboarding + role assignment     │
│  TrustScore      → stores & updates trust scores    │
│  LoanEscrow      → holds funds during loan period   │
└──────────────────────┬─────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│  LenderAgent     │     │  BorrowerAgent   │
│  OKX Agentic     │     │  OKX Agentic     │
│  Wallet (LENDER) │     │  Wallet (BORROWER│
└──────────────────┘     └──────────────────┘
```

## Repo Structure

```
agentcredit/
├── contracts/          # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── AgentRegistry.sol
│   │   ├── TrustScore.sol
│   │   └── LoanEscrow.sol
│   └── scripts/deploy.ts
├── backend/            # Node.js/TypeScript API
│   └── src/
│       ├── kya/trustScoreEngine.ts     # KYA engine (Onchain OS)
│       ├── services/matchmaking.ts     # Lender-borrower matching
│       ├── services/loanManager.ts     # Loan lifecycle
│       └── routes/                     # REST API
├── frontend/           # React dashboard
│   └── src/
│       ├── pages/Dashboard.tsx
│       └── components/
└── agents/             # Autonomous AI agents (Claude API)
    └── src/
        ├── lender/index.ts     # LenderAgent loop
        └── borrower/index.ts   # BorrowerAgent loop
```

## Trust Score Algorithm

| Factor | Source | Weight |
|---|---|---|
| Onchain TX count & frequency | OKX Onchain OS Data Module | 30% |
| Past loan repayment history | AgentCredit TrustScore contract | 25% |
| Wallet balance / collateral | OKX Agentic Wallet | 20% |
| DEX trading activity | Onchain OS / Uniswap | 15% |
| Wallet age | Onchain OS Data Module | 10% |

Score thresholds:
- **0–40**: Fails KYA — cannot participate
- **41–60**: Small loans only (borrower)
- **61–80**: Medium loans + lender eligible
- **81–100**: Full access + best rates

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | X Layer (EVM, Polygon CDK, chainId 196) |
| Smart Contracts | Solidity 0.8.24 + Hardhat + OpenZeppelin |
| Agent Brain | Claude API (`claude-sonnet-4-6`) |
| Onchain OS | OKX Onchain OS (data, x402 payments) |
| Agent Wallet | OKX Agentic Wallet |
| Backend | Node.js + TypeScript + Express |
| Frontend | React + Vite + Tailwind CSS |

## Deployed Contracts (X Layer Testnet)

> Filled after initial deployment on Apr 11

| Contract | Address |
|---|---|
| AgentRegistry | `TBD` |
| TrustScore | `TBD` |
| LoanEscrow | `TBD` |

## Setup

### 1. Install dependencies

```bash
npm install --workspaces
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: DEPLOYER_PRIVATE_KEY, OKX_API_KEY, ANTHROPIC_API_KEY
```

### 3. Deploy contracts

```bash
npm run contracts:compile
npm run contracts:deploy   # deploys to X Layer testnet
```

Copy deployed addresses from `contracts/deployments.json` into `.env`.

### 4. Start backend

```bash
npm run backend:dev
```

### 5. Start frontend

```bash
npm run frontend:dev
# → http://localhost:3000
```

### 6. Run agents

```bash
# In separate terminals:
npm run agents:lender
npm run agents:borrower
```

## OKX Hackathon Requirements

| Requirement | Implementation |
|---|---|
| Built on X Layer | All 3 smart contracts deployed on X Layer (chainId 196) |
| OKX Agentic Wallet | Every agent onboards with an OKX Agentic Wallet as identity |
| Onchain OS skills | KYA engine uses Onchain OS Data Module (tx history, wallet age) |
| x402 protocol | Loan disbursement + repayment via x402 |
| Public repo + README | This repo |

## Team

Built for OKX Build X Hackathon — X Layer Arena Track  
Hackathon period: April 1–15, 2026

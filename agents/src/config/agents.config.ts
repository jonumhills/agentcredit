/**
 * Agent Definitions — 4 Lenders + 7 Borrowers
 *
 * Each definition describes the agent's personality, goals, and risk profile.
 * Wallets are generated separately and stored in agents.json (gitignored).
 */

export type AgentRole = "LENDER" | "BORROWER";

export interface LenderConfig {
  id: string;
  name: string;
  role: "LENDER";
  personality: string;
  goals: {
    depositAmountEth: string;       // how much OKB to lock into LoanEscrow
    minBorrowerScore: number;       // minimum trust score to accept
    interestRateBps: number;        // APR in basis points (500 = 5%)
    maxLoanSizeEth: string;         // largest single loan
    maxDurationDays: number;        // longest loan term
  };
}

export interface BorrowerConfig {
  id: string;
  name: string;
  role: "BORROWER";
  personality: string;
  goals: {
    loanAmountEth: string;          // target borrow amount per cycle
    maxInterestRateBps: number;     // won't borrow above this rate
    preferredDurationDays: number;  // preferred loan term
    purpose: string;                // stated loan purpose (goes to LLM reasoning)
  };
}

export type AgentConfig = LenderConfig | BorrowerConfig;

// ─── 4 Lender Agents ────────────────────────────────────────────────────────

export const LENDER_CONFIGS: LenderConfig[] = [
  {
    id: "lender-conservative",
    name: "VaultKeeper",
    role: "LENDER",
    personality: "Risk-averse lender. Only lends to high-trust agents with proven repayment history. Prefers smaller, short-term loans.",
    goals: {
      depositAmountEth:  "0.01",
      minBorrowerScore:  75,
      interestRateBps:   400,   // 4% — lower rate but safer borrowers
      maxLoanSizeEth:    "0.005",
      maxDurationDays:   3,
    },
  },
  {
    id: "lender-balanced",
    name: "SteadyYield",
    role: "LENDER",
    personality: "Balanced lender targeting consistent returns. Accepts medium-trust borrowers with moderate loan sizes.",
    goals: {
      depositAmountEth:  "0.01",
      minBorrowerScore:  65,
      interestRateBps:   500,   // 5%
      maxLoanSizeEth:    "0.007",
      maxDurationDays:   7,
    },
  },
  {
    id: "lender-yield-seeker",
    name: "AlphaYield",
    role: "LENDER",
    personality: "Yield-maximising lender. Accepts lower-trust borrowers in exchange for higher interest rates.",
    goals: {
      depositAmountEth:  "0.01",
      minBorrowerScore:  61,
      interestRateBps:   750,   // 7.5%
      maxLoanSizeEth:    "0.008",
      maxDurationDays:   7,
    },
  },
  {
    id: "lender-whale",
    name: "LiquidityPool",
    role: "LENDER",
    personality: "High-liquidity lender offering the largest loans on the platform. Only works with established, high-score borrowers.",
    goals: {
      depositAmountEth:  "0.015",
      minBorrowerScore:  70,
      interestRateBps:   600,   // 6%
      maxLoanSizeEth:    "0.01",
      maxDurationDays:   14,
    },
  },
];

// ─── 7 Borrower Agents ───────────────────────────────────────────────────────

export const BORROWER_CONFIGS: BorrowerConfig[] = [
  {
    id: "borrower-alpha",
    name: "DeFiTrader",
    role: "BORROWER",
    personality: "Experienced DeFi trader with strong onchain history. Borrows to amplify yield farming positions. Always repays on time.",
    goals: {
      loanAmountEth:          "0.005",
      maxInterestRateBps:     700,
      preferredDurationDays:  1,
      purpose: "Yield farming — LP position on X Layer DEX",
    },
  },
  {
    id: "borrower-beta",
    name: "ArbitrageBot",
    role: "BORROWER",
    personality: "Arbitrage agent that needs short-term liquidity to capture price discrepancies across DEXs.",
    goals: {
      loanAmountEth:          "0.004",
      maxInterestRateBps:     800,
      preferredDurationDays:  1,
      purpose: "DEX arbitrage between OKX and Uniswap pools on X Layer",
    },
  },
  {
    id: "borrower-gamma",
    name: "LiquidityMiner",
    role: "BORROWER",
    personality: "Liquidity mining agent. Borrows to provide liquidity and earn trading fees + incentives.",
    goals: {
      loanAmountEth:          "0.005",
      maxInterestRateBps:     600,
      preferredDurationDays:  3,
      purpose: "Liquidity provision on X Layer — earn LP rewards",
    },
  },
  {
    id: "borrower-delta",
    name: "YieldOptimiser",
    role: "BORROWER",
    personality: "Methodical yield optimiser. Moves funds between protocols to capture the best risk-adjusted return.",
    goals: {
      loanAmountEth:          "0.004",
      maxInterestRateBps:     650,
      preferredDurationDays:  2,
      purpose: "Cross-protocol yield optimisation on X Layer",
    },
  },
  {
    id: "borrower-epsilon",
    name: "NewAgent",
    role: "BORROWER",
    personality: "New to the platform — low initial score. Borrows small amounts to build credit history.",
    goals: {
      loanAmountEth:          "0.002",
      maxInterestRateBps:     900,
      preferredDurationDays:  1,
      purpose: "Building credit history on AgentCredit",
    },
  },
  {
    id: "borrower-zeta",
    name: "FlashBorrower",
    role: "BORROWER",
    personality: "High-frequency borrower. Takes many small short-term loans to maximise trust score growth.",
    goals: {
      loanAmountEth:          "0.003",
      maxInterestRateBps:     800,
      preferredDurationDays:  1,
      purpose: "Frequent short-term borrowing to build reputation",
    },
  },
  {
    id: "borrower-eta",
    name: "StrategyAgent",
    role: "BORROWER",
    personality: "Strategy-driven agent borrowing for medium-term protocol interactions.",
    goals: {
      loanAmountEth:          "0.004",
      maxInterestRateBps:     700,
      preferredDurationDays:  2,
      purpose: "On-chain strategy execution — staking + lending on X Layer",
    },
  },
];

export const ALL_AGENT_CONFIGS: AgentConfig[] = [
  ...LENDER_CONFIGS,
  ...BORROWER_CONFIGS,
];

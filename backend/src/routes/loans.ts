import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { LoanManager } from "../services/loanManager";
import { MatchmakingService } from "../services/matchmaking";

const router = Router();
const loanManager = new LoanManager();
const matchmaking = new MatchmakingService();

/**
 * GET /api/loans/lenders/active
 * Get all active lender terms.
 * NOTE: must be defined before /:loanId to avoid route shadowing.
 */
router.get("/lenders/active", async (_req: Request, res: Response) => {
  try {
    const lenders = await matchmaking.getAllLenderTerms();
    return res.json({ lenders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/loans/request
 * Borrower agent submits a loan request.
 * Body: { borrower: string, amountEth: string, durationDays: number, purpose: string }
 */
router.post("/request", async (req: Request, res: Response) => {
  try {
    const { borrower, amountEth, durationDays, purpose } = req.body;
    if (!borrower || !amountEth || !durationDays) {
      return res.status(400).json({ error: "borrower, amountEth, durationDays required" });
    }

    const result = await loanManager.processLoanRequest({
      borrower,
      amountWei: ethers.parseEther(amountEth.toString()),
      durationSeconds: BigInt(Number(durationDays) * 86400),
      purpose: purpose || "",
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true, loanId: result.loanId, match: result.match });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/loans/:loanId
 * Get details for a specific loan.
 */
router.get("/:loanId", async (req: Request, res: Response) => {
  try {
    const loanId = parseInt(req.params.loanId);
    const loan = await loanManager.getLoanDetails(loanId);
    return res.json(loan);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/loans/:loanId/repay
 * Confirm repayment after x402 payment processed offchain.
 */
router.post("/:loanId/repay", async (req: Request, res: Response) => {
  try {
    const loanId = parseInt(req.params.loanId);
    const result = await loanManager.confirmRepayment(loanId);
    if (!result.success) return res.status(400).json({ error: result.error });
    return res.json({ success: true, loanId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

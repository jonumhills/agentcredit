import { ethers } from "ethers";
import { getLoanEscrowContract, getSigner } from "../utils/blockchain";
import { MatchmakingService, LoanRequest } from "./matchmaking";

export enum LoanStatus {
  PENDING = 0,
  ACTIVE = 1,
  REPAID = 2,
  DEFAULTED = 3,
  CANCELLED = 4,
}

export class LoanManager {
  private matchmaking = new MatchmakingService();

  /**
   * Process a loan request end-to-end:
   * 1. Find a matching lender
   * 2. Create the loan onchain
   * 3. Return loan details
   */
  async processLoanRequest(request: LoanRequest): Promise<{
    success: boolean;
    loanId?: number;
    match?: any;
    error?: string;
  }> {
    const match = await this.matchmaking.findMatch(request);
    if (!match) {
      return { success: false, error: "No matching lender found for the given criteria." };
    }

    try {
      const escrow = getLoanEscrowContract(getSigner());
      const tx = await escrow.createLoan(
        match.lender,
        match.borrower,
        match.principal,
        match.durationSeconds
      );
      const receipt = await tx.wait();

      // Parse LoanCreated event for loanId
      let loanId = 0;
      if (receipt?.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = escrow.interface.parseLog(log);
            if (parsed?.name === "LoanCreated") {
              loanId = Number(parsed.args.loanId);
              break;
            }
          } catch { /* skip */ }
        }
      }

      return {
        success: true,
        loanId,
        match: {
          lender: match.lender,
          borrower: match.borrower,
          principal: ethers.formatEther(match.principal),
          interestBps: Number(match.interestBps),
          interestPct: Number(match.interestBps) / 100,
          durationDays: Math.round(Number(match.durationSeconds) / 86400),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getLoanDetails(loanId: number) {
    const escrow = getLoanEscrowContract();
    const loan = await escrow.getLoan(loanId);
    const totalDue = await escrow.getTotalDue(loanId);

    return {
      id: Number(loan.id),
      lender: loan.lender,
      borrower: loan.borrower,
      principal: ethers.formatEther(loan.principal),
      interestBps: Number(loan.interestBps),
      interestPct: Number(loan.interestBps) / 100,
      startTime: new Date(Number(loan.startTime) * 1000).toISOString(),
      dueTime: new Date(Number(loan.dueTime) * 1000).toISOString(),
      totalDue: ethers.formatEther(totalDue),
      status: LoanStatus[Number(loan.status)],
    };
  }

  async confirmRepayment(loanId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const escrow = getLoanEscrowContract(getSigner());
      const tx = await escrow.recordRepayment(loanId);
      await tx.wait();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async checkAndMarkDefaults(): Promise<number[]> {
    const escrow = getLoanEscrowContract(getSigner());
    const signer = getSigner();
    const provider = signer.provider!;
    const now = Math.floor(Date.now() / 1000);

    // Iterate over all loans up to nextLoanId
    const nextId = Number(await escrow.nextLoanId?.() || 0);
    const defaulted: number[] = [];

    for (let i = 0; i < nextId; i++) {
      try {
        const loan = await escrow.getLoan(i);
        if (Number(loan.status) === LoanStatus.ACTIVE && Number(loan.dueTime) < now) {
          const tx = await escrow.markDefault(i);
          await tx.wait();
          defaulted.push(i);
        }
      } catch { /* skip */ }
    }

    return defaulted;
  }
}

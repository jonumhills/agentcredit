import type { LenderTerms } from "../utils/api";

interface Props {
  lenders: LenderTerms[];
  loading?: boolean;
}

const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export function LenderTable({ lenders, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-okx-dim">
        <div className="w-8 h-8 border-2 border-okx-border border-t-okx-blue rounded-full animate-spin mb-3" />
        <span className="text-sm">Loading lenders...</span>
      </div>
    );
  }

  if (lenders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-okx-dim">
        <div className="text-4xl mb-3 opacity-30">◎</div>
        <div className="text-sm text-okx-muted mb-1">No records found</div>
        <div className="text-xs text-okx-dim">Lenders appear here after depositing liquidity</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-okx-border text-okx-dim">
            <th className="text-left px-4 py-2.5 font-medium w-6"></th>
            <th className="text-left px-4 py-2.5 font-medium min-w-[160px]">Lender</th>
            <th className="text-right px-4 py-2.5 font-medium">
              Available <span className="opacity-50 cursor-pointer">⇅</span>
            </th>
            <th className="text-right px-4 py-2.5 font-medium">
              Max Loan <span className="opacity-50 cursor-pointer">⇅</span>
            </th>
            <th className="text-right px-4 py-2.5 font-medium">
              Interest <span className="opacity-50 cursor-pointer">⇅</span>
            </th>
            <th className="text-right px-4 py-2.5 font-medium">Min Score</th>
            <th className="text-right px-4 py-2.5 font-medium">Max Duration</th>
            <th className="text-left px-4 py-2.5 font-medium">Terms</th>
            <th className="text-right px-4 py-2.5 font-medium pr-5">Action</th>
          </tr>
        </thead>
        <tbody>
          {lenders.map((lender) => (
            <tr key={lender.lender} className="border-b border-okx-border table-row-hover transition-colors">
              <td className="px-4 py-2.5 text-okx-dim">
                <span className="cursor-pointer hover:text-yellow-400 transition-colors">☆</span>
              </td>

              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-950 text-blue-400 flex items-center justify-center text-xs font-bold">⬆</div>
                  <div>
                    <div className="text-white font-medium">{short(lender.lender)}</div>
                    <div className="text-okx-dim text-[10px] mt-0.5">LENDER</div>
                  </div>
                </div>
              </td>

              <td className="px-4 py-2.5 text-right">
                <div className="text-white font-semibold">{parseFloat(lender.availableLiquidity).toFixed(4)}</div>
                <div className="text-okx-dim text-[10px]">OKB</div>
              </td>

              <td className="px-4 py-2.5 text-right">
                <div className="text-okx-muted">{parseFloat(lender.maxLoanSize).toFixed(4)}</div>
                <div className="text-okx-dim text-[10px]">OKB</div>
              </td>

              <td className="px-4 py-2.5 text-right">
                <div className="text-okx-green font-semibold">{lender.interestRatePct.toFixed(1)}%</div>
                <div className="text-okx-dim text-[10px]">APR</div>
              </td>

              <td className="px-4 py-2.5 text-right">
                <ScorePill score={lender.minBorrowerScore} />
              </td>

              <td className="px-4 py-2.5 text-right text-okx-muted">
                {lender.maxDurationDays}d
              </td>

              <td className="px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="tag-green">Verified</span>
                  <span className={lender.active ? "tag-green" : "tag-gray"}>
                    {lender.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </td>

              <td className="px-4 py-2.5 pr-5 text-right">
                <button className="btn-buy">⚡ Borrow</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const cls =
    score >= 81 ? "tag-green" :
    score >= 61 ? "tag-blue" :
    score >= 41 ? "tag-yellow" : "tag-red";
  return <span className={cls}>{score}+</span>;
}

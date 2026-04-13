import { useState, useEffect } from "react";
import { api } from "../utils/api";

interface StatCard {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  detail?: { label: string; value: string }[];
}

interface Props {
  totalAgents: number;
  lenderCount: number;
  borrowerCount: number;
  totalLiquidity: string;
  kyaPassed: number;
}

interface LoanStats {
  activeLoans: number;
  repaidLoans: number;
  defaultedLoans: number;
  defaultRate: string;
}

export function StatsRow({ totalAgents, lenderCount, borrowerCount, totalLiquidity, kyaPassed }: Props) {
  const [loanStats, setLoanStats] = useState<LoanStats>({ activeLoans: 0, repaidLoans: 0, defaultedLoans: 0, defaultRate: "0.0" });

  useEffect(() => {
    api.get("/audit")
      .then((r: any) => {
        const s = r.data.stats;
        setLoanStats({
          activeLoans: s.activeLoans,
          repaidLoans: s.repaidLoans,
          defaultedLoans: s.defaultedLoans,
          defaultRate: s.defaultRate,
        });
      })
      .catch(() => {});
  }, []);

  const cards: StatCard[] = [
    {
      label: "Total Agents",
      value: totalAgents.toString(),
      sub: kyaPassed > 0 ? `+${kyaPassed} KYA passed` : "No agents yet",
      subColor: kyaPassed > 0 ? "text-okx-green" : "text-okx-dim",
      detail: [
        { label: "Lenders", value: lenderCount.toString() },
        { label: "Borrowers", value: borrowerCount.toString() },
      ],
    },
    {
      label: "Total Liquidity",
      value: `${parseFloat(totalLiquidity).toFixed(4)} OKB`,
      sub: lenderCount > 0 ? `Across ${lenderCount} lenders` : "No liquidity yet",
      subColor: "text-okx-muted",
      detail: [
        { label: "Active lenders", value: lenderCount.toString() },
        { label: "Avg per lender", value: lenderCount > 0 ? `${(parseFloat(totalLiquidity) / lenderCount).toFixed(3)} OKB` : "—" },
      ],
    },
    {
      label: "KYA Pass Rate",
      value: totalAgents > 0 ? `${Math.round((kyaPassed / totalAgents) * 100)}%` : "0%",
      sub: `${kyaPassed} / ${totalAgents} agents verified`,
      subColor: kyaPassed > 0 ? "text-okx-green" : "text-okx-dim",
      detail: [
        { label: "KYA passed", value: kyaPassed.toString() },
        { label: "Pending", value: (totalAgents - kyaPassed).toString() },
      ],
    },
    {
      label: "Active Loans",
      value: loanStats.activeLoans.toString(),
      sub: loanStats.activeLoans > 0 ? `${loanStats.repaidLoans} repaid · ${loanStats.defaultRate}% default rate` : "No active loans",
      subColor: loanStats.activeLoans > 0 ? "text-okx-green" : "text-okx-dim",
      detail: [
        { label: "Total repaid", value: loanStats.repaidLoans.toString() },
        { label: "Defaults", value: loanStats.defaultedLoans.toString() },
      ],
    },
    {
      label: "Avg Trust Score",
      value: "—",
      sub: "Computed by KYA engine",
      subColor: "text-okx-muted",
      detail: [
        { label: "Full access (>80)", value: "0" },
        { label: "No access (<40)", value: "0" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-okx-border border-b border-okx-border">
      {cards.map((card) => (
        <div key={card.label} className="bg-okx-bg p-4">
          <div className="flex items-start justify-between mb-1">
            <span className="text-okx-muted text-xs">{card.label}</span>
            <span className="text-okx-dim text-xs cursor-pointer">ⓘ</span>
          </div>
          <div className="text-white font-semibold text-lg leading-tight mb-0.5">{card.value}</div>
          {card.sub && <div className={`text-xs ${card.subColor}`}>{card.sub}</div>}
          {card.detail && (
            <div className="mt-2 pt-2 border-t border-okx-border flex gap-4">
              {card.detail.map((d) => (
                <div key={d.label}>
                  <div className="text-okx-dim text-[10px]">{d.label}</div>
                  <div className="text-okx-muted text-xs">{d.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

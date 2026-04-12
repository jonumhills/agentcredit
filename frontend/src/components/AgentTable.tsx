import type { Agent } from "../utils/api";
import { KYAChecks } from "./KYAChecks";

interface Props {
  agents: Agent[];
  onRunKYA?: (wallet: string) => void;
  loading?: boolean;
}

const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const roleIcon = (role: string) => role === "LENDER" ? "⬆" : role === "BORROWER" ? "⬇" : "?";

const scoreBg = (score: number) => {
  if (score >= 81) return "text-okx-green font-semibold";
  if (score >= 61) return "text-okx-blue font-semibold";
  if (score >= 41) return "text-yellow-400 font-semibold";
  if (score > 0)   return "text-okx-red font-semibold";
  return "text-okx-dim";
};

export function AgentTable({ agents, onRunKYA, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-okx-dim">
        <div className="w-8 h-8 border-2 border-okx-border border-t-okx-blue rounded-full animate-spin mb-3" />
        <span className="text-sm">Loading onchain data...</span>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-okx-dim">
        <div className="text-4xl mb-3 opacity-30">◎</div>
        <div className="text-sm text-okx-muted mb-1">No records found</div>
        <div className="text-xs text-okx-dim">Agents will appear here once registered on-chain</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-okx-border text-okx-dim">
            <th className="text-left px-4 py-2.5 font-medium w-6"></th>
            <th className="text-left px-4 py-2.5 font-medium min-w-[180px]">
              Agent / Registered
              <span className="ml-1 cursor-pointer opacity-50">⇅</span>
            </th>
            <th className="text-right px-4 py-2.5 font-medium">
              Trust Score
              <span className="ml-1 cursor-pointer opacity-50">⇅</span>
            </th>
            <th className="text-left px-4 py-2.5 font-medium">KYA Checks</th>
            <th className="text-right px-4 py-2.5 font-medium">Role</th>
            <th className="text-right px-4 py-2.5 font-medium">Status</th>
            <th className="text-right px-4 py-2.5 font-medium">Loans</th>
            <th className="text-right px-4 py-2.5 font-medium pr-5">Action</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <AgentRow key={agent.wallet} agent={agent} onRunKYA={onRunKYA} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentRow({ agent, onRunKYA }: { agent: Agent; onRunKYA?: (w: string) => void }) {
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <tr className="border-b border-okx-border table-row-hover transition-colors">
      {/* Star */}
      <td className="px-4 py-2.5 text-okx-dim">
        <span className="cursor-pointer hover:text-yellow-400 transition-colors">☆</span>
      </td>

      {/* Agent identity */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${agent.role === "LENDER" ? "bg-blue-950 text-blue-400" : "bg-purple-950 text-purple-400"}`}>
            {roleIcon(agent.role)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-medium">{short(agent.wallet)}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(agent.wallet)}
                className="text-okx-dim hover:text-okx-muted transition-colors text-[10px]"
                title="Copy address"
              >⊕</button>
            </div>
            <div className="text-okx-dim text-[10px] mt-0.5">{timeAgo(agent.registeredAt)} ago · {agent.role}</div>
          </div>
        </div>
      </td>

      {/* Trust Score */}
      <td className="px-4 py-2.5 text-right">
        {agent.trustScore > 0 ? (
          <div>
            <div className={`text-base leading-tight ${scoreBg(agent.trustScore)}`}>{agent.trustScore}</div>
            <div className="text-okx-dim text-[10px]">/100</div>
          </div>
        ) : (
          <span className="text-okx-dim">—</span>
        )}
      </td>

      {/* KYA Checks — the badge row */}
      <td className="px-4 py-2.5">
        <KYAChecks
          kycPassed={agent.kycPassed}
          trustScore={agent.trustScore}
          role={agent.role}
          active={agent.active}
          compact
        />
      </td>

      {/* Role pill */}
      <td className="px-4 py-2.5 text-right">
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${agent.role === "LENDER" ? "bg-blue-950 text-blue-400" : "bg-purple-950 text-purple-400"}`}>
          {agent.role}
        </span>
      </td>

      {/* Active status */}
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${agent.active ? "bg-okx-green" : "bg-okx-dim"}`} />
          <span className={agent.active ? "text-okx-green" : "text-okx-dim"}>
            {agent.active ? "Active" : "Inactive"}
          </span>
        </div>
      </td>

      {/* Loans count placeholder */}
      <td className="px-4 py-2.5 text-right text-okx-muted">—</td>

      {/* Action */}
      <td className="px-4 py-2.5 pr-5 text-right">
        {!agent.kycPassed ? (
          <button
            onClick={() => onRunKYA?.(agent.wallet)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border border-okx-border2 text-okx-muted hover:border-okx-green hover:text-okx-green transition-colors"
          >
            Run KYA
          </button>
        ) : agent.role === "LENDER" ? (
          <button className="btn-lend">⚡ Deposit</button>
        ) : (
          <button className="btn-buy">⚡ Borrow</button>
        )}
      </td>
    </tr>
  );
}

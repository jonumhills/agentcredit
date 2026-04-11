import { useState, useEffect } from "react";
import { fetchAgents, fetchActiveLenders, fetchLeaderboard } from "../utils/api";
import type { Agent, LenderTerms } from "../utils/api";
import { AgentCard } from "../components/AgentCard";
import { LenderCard } from "../components/LenderCard";
import { TrustScoreBadge } from "../components/TrustScoreBadge";

export function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [lenders, setLenders] = useState<LenderTerms[]>([]);
  const [leaderboard, setLeaderboard] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"borrowers" | "lenders" | "leaderboard">("borrowers");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentData, lenderData, lbData] = await Promise.all([
        fetchAgents(),
        fetchActiveLenders(),
        fetchLeaderboard(),
      ]);
      setAgents(agentData.agents);
      setLenders(lenderData.lenders);
      setLeaderboard(lbData.leaderboard);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  const borrowers = agents.filter((a) => a.role === "BORROWER");
  const activeLenderAgents = agents.filter((a) => a.role === "LENDER");

  const totalLiquidity = lenders.reduce((sum, l) => sum + parseFloat(l.availableLiquidity), 0);
  const activeLoans = agents.filter((a) => a.kycPassed).length;

  return (
    <div className="min-h-screen bg-xlayer-dark">
      {/* Header */}
      <header className="border-b border-xlayer-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">AC</div>
            <div>
              <h1 className="text-lg font-bold text-white">AgentCredit</h1>
              <p className="text-xs text-gray-500">Agent-Native Lending on X Layer</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-gray-400">X Layer Live</span>
            </div>
            <button
              onClick={refresh}
              className="text-xs px-3 py-1.5 border border-xlayer-border rounded hover:border-blue-500 text-gray-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Agents", value: agents.length.toString(), color: "text-white" },
            { label: "Active Lenders", value: activeLenderAgents.length.toString(), color: "text-blue-400" },
            { label: "Active Borrowers", value: borrowers.length.toString(), color: "text-purple-400" },
            { label: "Total Liquidity", value: `${totalLiquidity.toFixed(3)} ETH`, color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-xlayer-card border border-xlayer-border rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-xlayer-card border border-xlayer-border rounded-lg p-1 w-fit">
          {(["borrowers", "lenders", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-sm font-mono transition-colors capitalize ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-500">Loading onchain data...</div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm mb-6">
            {error} — Make sure the backend is running and contracts are deployed.
          </div>
        )}

        {!loading && !error && (
          <>
            {tab === "borrowers" && (
              <div>
                <h2 className="text-sm text-gray-400 mb-4">
                  Active Borrower Agents ({borrowers.length})
                </h2>
                {borrowers.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 border border-dashed border-xlayer-border rounded-lg">
                    No borrower agents registered yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {borrowers.map((agent) => (
                      <AgentCard key={agent.wallet} agent={agent} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "lenders" && (
              <div>
                <h2 className="text-sm text-gray-400 mb-4">
                  Active Lender Agents ({lenders.length})
                </h2>
                {lenders.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 border border-dashed border-xlayer-border rounded-lg">
                    No lender agents active yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {lenders.map((l) => (
                      <LenderCard key={l.lender} lender={l} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "leaderboard" && (
              <div>
                <h2 className="text-sm text-gray-400 mb-4">Trust Score Leaderboard</h2>
                <div className="bg-xlayer-card border border-xlayer-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-xlayer-border text-gray-500 text-xs">
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Wallet</th>
                        <th className="px-4 py-3 text-left">Role</th>
                        <th className="px-4 py-3 text-left">Trust Score</th>
                        <th className="px-4 py-3 text-left">KYA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((agent, i) => (
                        <tr key={agent.wallet} className="border-b border-xlayer-border hover:bg-gray-900/50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 font-mono">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-300">
                            {agent.wallet.slice(0, 8)}...{agent.wallet.slice(-6)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${agent.role === "LENDER" ? "bg-blue-900 text-blue-300" : "bg-purple-900 text-purple-300"}`}>
                              {agent.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <TrustScoreBadge score={agent.trustScore} size="sm" />
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {agent.kycPassed
                              ? <span className="text-green-400">✓ Passed</span>
                              : <span className="text-gray-500">Pending</span>
                            }
                          </td>
                        </tr>
                      ))}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                            No agents registered yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

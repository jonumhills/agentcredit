import { useState, useEffect, useCallback } from "react";
import { fetchAgents, fetchActiveLenders, fetchLeaderboard, runKYA } from "../utils/api";
import type { Agent, LenderTerms } from "../utils/api";
import { StatsRow } from "../components/StatsRow";
import { AgentTable } from "../components/AgentTable";
import { LenderTable } from "../components/LenderTable";
import { KYAChecks } from "../components/KYAChecks";
import type { Tab } from "../App";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onAudit: () => void;
}

export function Dashboard({ tab, onTabChange, onAudit }: Props) {
  const [agents, setAgents]       = useState<Agent[]>([]);
  const [lenders, setLenders]     = useState<LenderTerms[]>([]);
  const [leaderboard, setLeaderboard] = useState<Agent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [kyaRunning, setKyaRunning]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, l, lb] = await Promise.all([
        fetchAgents(),
        fetchActiveLenders(),
        fetchLeaderboard(),
      ]);
      setAgents(a.agents);
      setLenders(l.lenders);
      setLeaderboard(lb.leaderboard);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleRunKYA = async (wallet: string) => {
    setKyaRunning(wallet);
    try {
      await runKYA(wallet);
      await refresh();
    } catch { /* surface via refresh */ }
    finally { setKyaRunning(null); }
  };

  const borrowers     = agents.filter((a) => a.role === "BORROWER");
  const lenderAgents  = agents.filter((a) => a.role === "LENDER");
  const kyaPassed     = agents.filter((a) => a.kycPassed).length;
  const totalLiquidity = lenders.reduce((s, l) => s + parseFloat(l.availableLiquidity), 0).toString();

  const displayAgents: Agent[] =
    tab === "lenders"   ? lenderAgents :
    tab === "borrowers" ? borrowers :
    agents;

  const secondsAgo = Math.round((Date.now() - lastRefresh.getTime()) / 1000);

  return (
    <div className="min-h-screen bg-okx-bg text-white">

      {/* ── Hero banner (image-3 style) ─────────────────────────────────── */}
      <div className="relative grid-bg border-b border-okx-border px-6 py-10 text-center overflow-hidden">
        {/* subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(55,114,255,0.08) 0%, transparent 70%)"
        }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-okx-border bg-okx-card2 text-okx-muted text-xs mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-okx-green animate-pulse" />
            OKX Build X Hackathon · X Layer Arena · Agent Lending Platform
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">BancoProtocol</h1>
          <p className="text-okx-muted text-sm max-w-md mx-auto mb-6">
            The credit layer of the X Layer agent economy. Reputation-based, undercollateralized lending for AI agents.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button className="btn-lend px-5 py-2 text-sm">View Live Dashboard →</button>
            <a
              href="https://github.com/jonumhills/agentcredit"
              target="_blank"
              rel="noreferrer"
              className="btn-outline px-5 py-2 text-sm"
            >GitHub ↗</a>

            <a
              href="https://www.okx.com/xlayer/address/0x8436Fbe0D6BAF0e87A14e26ab0c921a963Baf118"
              target="_blank"
              rel="noreferrer"
              className="btn-outline px-5 py-2 text-sm"
              onClick={(e) => { e.preventDefault(); onAudit(); }}
            >On-chain Audit ↗</a>
          </div>
        </div>
      </div>

      {/* ── Architecture diagram (image-3 flow) ─────────────────────────── */}
      <div className="border-b border-okx-border px-6 py-5 bg-okx-card">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <FlowNode label="AI Agent" sub="POST /api/kya/register" color="bg-okx-card2 border-okx-border2" />
          <Arrow />
          <FlowNode label="KYA Engine" sub="Trust Score 0–100" color="bg-blue-950 border-blue-900" highlight />
          <Arrow />
          <FlowNode label="X Layer" sub="AgentRegistry · TrustScore · LoanEscrow" color="bg-okx-card2 border-okx-border2" />
          <Arrow />
          <FlowNode label="LoanEscrow" sub="x402 disbursement" color="bg-emerald-950 border-emerald-900" />
        </div>
        <p className="text-center text-okx-dim text-[10px] mt-3">The agent cannot participate unless KYA score ≥ 41.</p>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <StatsRow
        totalAgents={agents.length}
        lenderCount={lenderAgents.length}
        borrowerCount={borrowers.length}
        totalLiquidity={totalLiquidity}
        kyaPassed={kyaPassed}
      />

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-okx-border bg-okx-bg">
        {(["all", "lenders", "borrowers", "leaderboard"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
              tab === t
                ? "bg-white text-black"
                : "text-okx-muted hover:text-white"
            }`}
          >
            {t === "all" ? `All Agents (${agents.length})` :
             t === "lenders" ? `Lenders (${lenderAgents.length})` :
             t === "borrowers" ? `Borrowers (${borrowers.length})` :
             "Leaderboard"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-okx-dim">
          {kyaRunning && (
            <span className="text-okx-blue animate-pulse">Running KYA...</span>
          )}
          <span>Updated {secondsAgo}s ago</span>
          <button onClick={refresh} className="btn-outline py-1 text-[10px]">↻ Refresh</button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-5 mt-3 px-4 py-3 rounded border border-red-900 bg-red-950/30 text-red-400 text-xs">
          {error} — Make sure the BancoProtocol backend is reachable.
        </div>
      )}

      {/* ── Table content ────────────────────────────────────────────────── */}
      <div className="bg-okx-bg">
        {tab === "leaderboard" ? (
          <LeaderboardTable leaderboard={leaderboard} loading={loading} />
        ) : tab === "lenders" ? (
          <LenderTable lenders={lenders} loading={loading} />
        ) : (
          <AgentTable
            agents={displayAgents}
            onRunKYA={handleRunKYA}
            loading={loading}
          />
        )}
      </div>

      {/* ── Bottom status bar (OKX style) ────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 h-7 bg-okx-card border-t border-okx-border flex items-center px-5 gap-6 text-[10px] text-okx-dim z-40">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-okx-green" />
          X Layer Testnet · chainId 1952
        </span>
        <span>AgentRegistry <code className="text-okx-muted">0x7342...A8a</code></span>
        <span>TrustScore <code className="text-okx-muted">0x6B91...164</code></span>
        <span>LoanEscrow <code className="text-okx-muted">0x8436...118</code></span>
        <span className="ml-auto">{agents.length} agents · {kyaPassed} KYA passed</span>
      </div>

      {/* spacer for fixed bottom bar */}
      <div className="h-7" />
    </div>
  );
}

// ── Leaderboard table ──────────────────────────────────────────────────────

function LeaderboardTable({ leaderboard, loading }: { leaderboard: Agent[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-okx-dim">
        <div className="w-8 h-8 border-2 border-okx-border border-t-okx-blue rounded-full animate-spin" />
      </div>
    );
  }
  if (leaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-okx-dim">
        <div className="text-4xl mb-3 opacity-30">◎</div>
        <div className="text-sm text-okx-muted">No records found</div>
      </div>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-okx-border text-okx-dim">
          <th className="text-left px-4 py-2.5 font-medium w-10">#</th>
          <th className="text-left px-4 py-2.5 font-medium">Agent</th>
          <th className="text-right px-4 py-2.5 font-medium">Trust Score</th>
          <th className="text-left px-4 py-2.5 font-medium">Verification</th>
          <th className="text-right px-4 py-2.5 font-medium pr-5">Role</th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((agent, i) => (
          <tr key={agent.wallet} className="border-b border-okx-border table-row-hover">
            <td className="px-4 py-2.5 text-okx-dim font-mono">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </td>
            <td className="px-4 py-2.5 text-okx-muted font-mono">
              {agent.wallet.slice(0, 10)}...{agent.wallet.slice(-6)}
            </td>
            <td className="px-4 py-2.5 text-right">
              <span className={`font-semibold text-sm ${
                agent.trustScore >= 81 ? "text-okx-green" :
                agent.trustScore >= 61 ? "text-okx-blue" :
                agent.trustScore >= 41 ? "text-yellow-400" : "text-okx-red"
              }`}>{agent.trustScore}</span>
              <span className="text-okx-dim text-[10px]">/100</span>
            </td>
            <td className="px-4 py-2.5">
              <KYAChecks
                kycPassed={agent.kycPassed}
                trustScore={agent.trustScore}
                role={agent.role}
                active={agent.active}
                compact
              />
            </td>
            <td className="px-4 py-2.5 pr-5 text-right">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${agent.role === "LENDER" ? "bg-blue-950 text-blue-400" : "bg-purple-950 text-purple-400"}`}>
                {agent.role}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Flow diagram components ────────────────────────────────────────────────

function FlowNode({ label, sub, color, highlight }: { label: string; sub: string; color: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg px-4 py-3 text-center min-w-[130px] ${color} ${highlight ? "shadow-lg" : ""}`}>
      <div className={`text-sm font-semibold ${highlight ? "text-okx-blue" : "text-white"}`}>{label}</div>
      <div className="text-[10px] text-okx-dim mt-0.5">{sub}</div>
    </div>
  );
}

function Arrow() {
  return <span className="text-okx-dim text-lg">→</span>;
}

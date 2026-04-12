import { useState, useEffect } from "react";
import { fetchHealth } from "../utils/api";

export function Header() {
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);
  const [blockTime, setBlockTime] = useState<string>("");

  useEffect(() => {
    fetchHealth()
      .then(() => { setNetworkOk(true); setBlockTime(new Date().toLocaleTimeString()); })
      .catch(() => setNetworkOk(false));
    const t = setInterval(() => {
      fetchHealth()
        .then(() => { setNetworkOk(true); setBlockTime(new Date().toLocaleTimeString()); })
        .catch(() => setNetworkOk(false));
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="border-b border-okx-border bg-okx-bg sticky top-0 z-50">
      <div className="flex items-center justify-between px-5 h-12">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-okx-blue rounded flex items-center justify-center text-white font-bold text-xs">AC</div>
            <span className="font-semibold text-white text-sm tracking-tight">AgentCredit</span>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-okx-muted text-sm">
            <span className="text-white font-medium cursor-pointer">Dashboard</span>
            <span className="hover:text-white cursor-pointer transition-colors">Agents</span>
            <span className="hover:text-white cursor-pointer transition-colors">Loans</span>
            <span className="hover:text-white cursor-pointer transition-colors">KYA</span>
            <span className="hover:text-white cursor-pointer transition-colors">Onchain OS</span>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Network status */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-okx-muted border-r border-okx-border pr-3">
            <span>X Layer Testnet</span>
            {blockTime && <span className="text-okx-dim">{blockTime}</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full ${networkOk === null ? "bg-yellow-500" : networkOk ? "bg-okx-green animate-pulse" : "bg-okx-red"}`} />
            <span className={networkOk === null ? "text-yellow-400" : networkOk ? "text-okx-green" : "text-okx-red"}>
              {networkOk === null ? "Connecting" : networkOk ? "Live" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-okx-card2 border border-okx-border rounded px-3 py-1.5 text-xs text-white">
            <div className="w-4 h-4 rounded-full bg-okx-blue flex items-center justify-center text-[9px] font-bold">A</div>
            <span>AgentCreditBank</span>
          </div>
        </div>
      </div>

      {/* Sub-nav / filters */}
      <div className="flex items-center gap-1 px-5 h-9 border-t border-okx-border overflow-x-auto">
        <TabPill active>All Agents</TabPill>
        <TabPill>Lenders</TabPill>
        <TabPill>Borrowers</TabPill>
        <TabPill>Leaderboard</TabPill>
        <div className="ml-auto flex items-center gap-2 text-xs text-okx-muted">
          <span className="border border-okx-border rounded px-2 py-0.5 hover:border-okx-border2 cursor-pointer">Filters</span>
          <span className="border border-okx-border rounded px-2 py-0.5 hover:border-okx-border2 cursor-pointer">24h ▾</span>
        </div>
      </div>
    </header>
  );
}

function TabPill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
      active
        ? "bg-white text-black"
        : "text-okx-muted hover:text-white"
    }`}>
      {children}
    </button>
  );
}

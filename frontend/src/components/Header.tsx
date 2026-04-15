import { useState, useEffect } from "react";
import { fetchHealth } from "../utils/api";
import type { Tab, View } from "../App";

interface HeaderProps {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onAudit: () => void;
  onMcp: () => void;
  view: View;
}

export function Header({ tab, onTabChange, onAudit, onMcp, view }: HeaderProps) {
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
            <div className="w-7 h-7 bg-okx-blue rounded flex items-center justify-center text-white font-bold text-xs">BP</div>
            <span className="font-semibold text-white text-sm tracking-tight">BancoProtocol</span>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-okx-muted text-sm">
            <span
              onClick={() => onTabChange("all")}
              className={`cursor-pointer transition-colors ${view === "dashboard" ? "text-white font-medium" : "hover:text-white"}`}
            >Dashboard</span>
            <span
              onClick={onAudit}
              className={`cursor-pointer transition-colors ${view === "audit" ? "text-white font-medium" : "hover:text-white"}`}
            >Onchain Audit</span>
            <span
              onClick={onMcp}
              className={`cursor-pointer transition-colors ${view === "mcp" ? "text-white font-medium" : "hover:text-white"}`}
            >Connect Agent</span>
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
            <span>BancoProtocol</span>
          </div>
        </div>
      </div>

      {/* Sub-nav / filters */}
      <div className={`flex items-center gap-1 px-5 h-9 border-t border-okx-border overflow-x-auto ${view === "audit" || view === "mcp" ? "invisible" : ""}`}>
        <TabPill active={tab === "all"}        onClick={() => onTabChange("all")}>All Agents</TabPill>
        <TabPill active={tab === "lenders"}    onClick={() => onTabChange("lenders")}>Lenders</TabPill>
        <TabPill active={tab === "borrowers"}  onClick={() => onTabChange("borrowers")}>Borrowers</TabPill>
        <TabPill active={tab === "leaderboard"} onClick={() => onTabChange("leaderboard")}>Leaderboard</TabPill>
      </div>
    </header>
  );
}

function TabPill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active ? "bg-white text-black" : "text-okx-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

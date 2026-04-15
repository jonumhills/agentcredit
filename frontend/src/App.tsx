import { useState } from "react";
import { Header } from "./components/Header";
import { Dashboard } from "./pages/Dashboard";
import { AuditPage } from "./pages/AuditPage";
import { MCPSetupPage } from "./pages/MCPSetupPage";

export type Tab = "all" | "lenders" | "borrowers" | "leaderboard";
export type View = "dashboard" | "audit" | "mcp";

function App() {
  const [tab, setTab]   = useState<Tab>("all");
  const [view, setView] = useState<View>("dashboard");

  return (
    <>
      <Header
        tab={tab}
        onTabChange={(t) => { setTab(t); setView("dashboard"); }}
        onAudit={() => setView("audit")}
        onMcp={() => setView("mcp")}
        view={view}
      />
      {view === "audit" ? <AuditPage /> :
       view === "mcp"   ? <MCPSetupPage /> :
       <Dashboard tab={tab} onTabChange={setTab} onAudit={() => setView("audit")} />}
    </>
  );
}

export default App;

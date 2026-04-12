import { useState } from "react";
import { Header } from "./components/Header";
import { Dashboard } from "./pages/Dashboard";
import { AuditPage } from "./pages/AuditPage";

export type Tab = "all" | "lenders" | "borrowers" | "leaderboard";
export type View = "dashboard" | "audit";

function App() {
  const [tab, setTab]   = useState<Tab>("all");
  const [view, setView] = useState<View>("dashboard");

  return (
    <>
      <Header tab={tab} onTabChange={(t) => { setTab(t); setView("dashboard"); }} onAudit={() => setView("audit")} view={view} />
      {view === "audit" ? (
        <AuditPage />
      ) : (
        <Dashboard tab={tab} onTabChange={setTab} onAudit={() => setView("audit")} />
      )}
    </>
  );
}

export default App;

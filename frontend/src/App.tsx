import { useState } from "react";
import { Header } from "./components/Header";
import { Dashboard } from "./pages/Dashboard";

export type Tab = "all" | "lenders" | "borrowers" | "leaderboard";

function App() {
  const [tab, setTab] = useState<Tab>("all");

  return (
    <>
      <Header tab={tab} onTabChange={setTab} />
      <Dashboard tab={tab} onTabChange={setTab} />
    </>
  );
}

export default App;

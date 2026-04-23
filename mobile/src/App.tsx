import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import SignIn from "./auth/SignIn";
import Shell from "./layout/Shell";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import News from "./pages/News";
import MemoryGame from "./pages/MemoryGame";
import Wordle from "./pages/Wordle";
import Sudoku from "./pages/Sudoku";
import Game2048 from "./pages/Game2048";
import QuizJoin from "./pages/QuizJoin";
import QuizSession from "./pages/QuizSession";
import TambolaJoin from "./pages/TambolaJoin";
import TambolaSession from "./pages/TambolaSession";
import FantasyMatches from "./pages/FantasyMatches";
import FantasyMatch from "./pages/FantasyMatch";
import MemoryMulti from "./pages/MemoryMulti";
import MemoryMultiSession from "./pages/MemoryMultiSession";

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (status !== "signedIn") {
    return <SignIn />;
  }

  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/games" element={<Games />} />
          <Route path="/news" element={<News />} />
          <Route path="/memory" element={<MemoryGame />} />
          <Route path="/memory/multi" element={<MemoryMulti />} />
          <Route path="/memory/multi/:code" element={<MemoryMultiSession />} />
          <Route path="/wordle" element={<Wordle />} />
          <Route path="/sudoku" element={<Sudoku />} />
          <Route path="/2048" element={<Game2048 />} />
          <Route path="/quiz" element={<QuizJoin />} />
          <Route path="/quiz/:code" element={<QuizSession />} />
          <Route path="/tambola" element={<TambolaJoin />} />
          <Route path="/tambola/:code" element={<TambolaSession />} />
          <Route path="/fantasy" element={<FantasyMatches />} />
          <Route path="/fantasy/:matchId" element={<FantasyMatch />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}

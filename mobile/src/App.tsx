import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import SignIn from "./auth/SignIn";
import Home from "./pages/Home";
import MemoryGame from "./pages/MemoryGame";
import Wordle from "./pages/Wordle";
import Sudoku from "./pages/Sudoku";
import Game2048 from "./pages/Game2048";

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/memory" element={<MemoryGame />} />
        <Route path="/wordle" element={<Wordle />} />
        <Route path="/sudoku" element={<Sudoku />} />
        <Route path="/2048" element={<Game2048 />} />
      </Routes>
    </HashRouter>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessagesSquare, Search, Users } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Avatar } from "./Community";

type ResidentHit = {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
  googleImage: string | null;
};

export default function ResidentDirectory() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ResidentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 1) {
      setResults([]);
      setSearched(false);
      return;
    }
    if (!token) return;
    debounce.current = setTimeout(() => {
      setSearching(true);
      apiFetch(`/api/residents/search?q=${encodeURIComponent(term)}`, { token })
        .then((r) => (r.ok ? r.json() : { residents: [] }))
        .then((data) => {
          const hits: ResidentHit[] = (data.residents ?? []).filter(
            (h: ResidentHit) => h.id !== user?.id
          );
          setResults(hits);
          setSearched(true);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, token, user?.id]);

  async function message(residentId: string) {
    if (!token || startingId) return;
    setStartingId(residentId);
    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        token,
        body: JSON.stringify({ residentId }),
      });
      if (res.ok) {
        const { id } = await res.json();
        navigate(`/messages/${id}`);
      } else {
        window.alert("Couldn't start the chat. Please try again.");
      }
    } catch {
      window.alert("Couldn't start the chat. Check your connection.");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">Resident Directory</h1>
      </header>

      {/* Search box */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3">
        <Search size={16} className="text-slate-500" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or flat number…"
          className="flex-1 bg-transparent py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        {searching ? <Loader2 size={15} className="animate-spin text-slate-500" /> : null}
      </div>

      {/* Body */}
      <div className="mt-4">
        {q.trim().length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center">
            <Users size={26} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-400">
              Search for a neighbour by name or flat number,
              <br />then message them directly.
            </p>
          </div>
        ) : searched && results.length === 0 && !searching ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
            No residents found.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
            {results.map((h, i) => (
              <div
                key={h.id}
                className={
                  "flex items-center gap-3 px-4 py-3" +
                  (i < results.length - 1 ? " border-b border-slate-700" : "")
                }
              >
                <Avatar name={h.name} imageUrl={h.googleImage} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{h.name}</p>
                  <p className="text-[11px] text-slate-500">
                    Block {h.block ?? "—"} · Flat {h.flatNumber}
                  </p>
                </div>
                <button
                  onClick={() => void message(h.id)}
                  disabled={startingId === h.id}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white active:bg-indigo-700 disabled:opacity-60"
                >
                  {startingId === h.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MessagesSquare size={14} />
                  )}
                  Message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

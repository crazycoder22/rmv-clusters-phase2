"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Clock, CheckCircle2, ClipboardList,
  Trash2, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import clsx from "clsx";
import { useRole } from "@/hooks/useRole";

interface PollOption {
  id: string;
  text: string;
  sortOrder: number;
  voteCount: number;
  voters: { name: string; block: number; flatNumber: string }[];
}

interface Question {
  id: string;
  title: string;
  description: string | null;
  type: string;
  sortOrder: number;
  totalVotes: number;
  totalOptionVotes: number;
  options: PollOption[];
  myVotes: string[];
}

interface SurveyInfo {
  id: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  deadline: string;
  status: string;
  createdBy: { name: string; block: number; flatNumber: string };
  createdAt: string;
  questionCount: number;
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const { canManagePolls } = useRole();

  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Guest info (for non-logged-in users)
  const isLoggedIn = authStatus === "authenticated" && session?.user?.isApproved;
  const [guestReady, setGuestReady] = useState(false);
  const [guest, setGuest] = useState({ name: "", email: "", block: "", flat: "", phone: "" });
  const [guestErrors, setGuestErrors] = useState<Record<string, string>>({});

  // Per-question selections
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSurvey = () => {
    setLoading(true);
    fetch(`/api/surveys/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setSurvey(data.survey);
        setQuestions(data.questions);
        setHasCompleted(data.hasCompleted);
        setIsClosed(data.isClosed);
      })
      .catch(() => setError("Survey not found"))
      .finally(() => setLoading(false));
  };

  // Load survey once auth status is known (don't wait for authenticated)
  useEffect(() => {
    if (authStatus === "loading") return;
    fetchSurvey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, id]);

  const showResults = hasCompleted || isClosed || submitted;

  const handleSelect = (pollId: string, optionId: string, type: string) => {
    setSelections((prev) => {
      const current = prev[pollId] || [];
      if (type === "SINGLE") return { ...prev, [pollId]: [optionId] };
      return {
        ...prev,
        [pollId]: current.includes(optionId)
          ? current.filter((x) => x !== optionId)
          : [...current, optionId],
      };
    });
  };

  const validateGuest = () => {
    const errs: Record<string, string> = {};
    if (!guest.name.trim()) errs.name = "Name is required";
    if (!guest.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) errs.email = "Valid email is required";
    if (!guest.block || ![1, 2, 3, 4].includes(Number(guest.block))) errs.block = "Select your block";
    if (!guest.flat.trim()) errs.flat = "Flat number is required";
    setGuestErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuestContinue = () => {
    if (validateGuest()) setGuestReady(true);
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => !(selections[q.id]?.length > 0) && !(q.myVotes.length > 0));
    if (unanswered.length > 0) {
      setError(`Please answer all questions. Missing: ${unanswered.map((q, i) => `Q${q.sortOrder + 1}`).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = { answers: selections };
      if (!isLoggedIn) {
        body.guestName = guest.name.trim();
        body.guestEmail = guest.email.trim();
        body.guestBlock = Number(guest.block);
        body.guestFlat = guest.flat.trim();
        body.guestPhone = guest.phone.trim() || null;
      }

      const res = await fetch(`/api/surveys/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        return;
      }
      setSubmitted(true);
      fetchSurvey();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Close this survey? Residents will no longer be able to respond.")) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (res.ok) {
        setIsClosed(true);
        if (survey) setSurvey({ ...survey, status: "CLOSED" });
      }
    } finally {
      setClosing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this survey and all its questions? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
      if (res.ok) window.location.href = "/polls";
    } finally {
      setDeleting(false);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <Link href="/polls" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
          Back to Polls &amp; Surveys
        </Link>
      </div>
    );
  }

  if (!survey) return null;

  const deadlineDate = new Date(survey.deadline);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
  const daysLeft = Math.floor(hoursLeft / 24);

  // Show guest form for non-logged-in users who haven't confirmed their info yet
  const needsGuestForm = !isLoggedIn && !guestReady && !isClosed;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/polls" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6">
        <ArrowLeft size={16} /> Back to Polls &amp; Surveys
      </Link>

      {/* Survey Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={clsx("inline-block px-2 py-0.5 text-xs font-medium rounded-full", isClosed ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300")}>
            {isClosed ? "Closed" : "Active"}
          </span>
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
            {survey.questionCount} question{survey.questionCount !== 1 ? "s" : ""}
          </span>
          {survey.isAnonymous && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Anonymous</span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{survey.title}</h1>
        {survey.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{survey.description}</p>}
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {isClosed ? "Ended" : daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h left` : hoursLeft > 0 ? `${hoursLeft}h left` : "Ending soon"}
          </span>
          <span>by {survey.createdBy.name}</span>
        </div>
        {hasCompleted && (
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-3 flex items-center gap-1">
            <CheckCircle2 size={14} /> You have completed this survey
          </p>
        )}
      </div>

      {/* ── GUEST INFO FORM ─────────────────────────────────────────────── */}
      {needsGuestForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} className="text-primary-600 dark:text-primary-400" />
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">Your Details</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Please fill in your details before taking the survey.{" "}
            <Link href="/login" className="text-primary-600 dark:text-primary-400 hover:underline">Sign in</Link> to skip this step.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input type="text" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} placeholder="e.g. Ramesh Kumar" className={inputClass} />
              {guestErrors.name && <p className="text-xs text-red-500 mt-1">{guestErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} placeholder="your@email.com" className={inputClass} />
              {guestErrors.email && <p className="text-xs text-red-500 mt-1">{guestErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Block <span className="text-red-500">*</span></label>
              <select value={guest.block} onChange={(e) => setGuest((g) => ({ ...g, block: e.target.value }))} className={inputClass}>
                <option value="">Select block</option>
                {[1, 2, 3, 4].map((b) => <option key={b} value={b}>Block {b}</option>)}
              </select>
              {guestErrors.block && <p className="text-xs text-red-500 mt-1">{guestErrors.block}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flat Number <span className="text-red-500">*</span></label>
              <input type="text" value={guest.flat} onChange={(e) => setGuest((g) => ({ ...g, flat: e.target.value }))} placeholder="e.g. 201" className={inputClass} />
              {guestErrors.flat && <p className="text-xs text-red-500 mt-1">{guestErrors.flat}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone <span className="text-xs text-gray-400">(optional)</span></label>
              <input type="tel" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} placeholder="e.g. 9876543210" className={inputClass} />
            </div>
          </div>

          <button
            onClick={handleGuestContinue}
            className="mt-4 w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Continue to Survey →
          </button>
        </div>
      )}

      {/* ── GUEST INFO CONFIRMED BANNER ──────────────────────────────────── */}
      {!isLoggedIn && guestReady && !isClosed && (
        <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-lg px-4 py-2.5 mb-5 text-sm">
          <span className="text-primary-700 dark:text-primary-300">
            Submitting as <strong>{guest.name}</strong> · Block {guest.block} · {guest.flat}
          </span>
          <button onClick={() => setGuestReady(false)} className="text-xs text-primary-500 dark:text-primary-400 hover:underline ml-3">
            Edit
          </button>
        </div>
      )}

      {/* ── QUESTIONS (shown after guest form is done, or if logged in) ─── */}
      {(!needsGuestForm) && (
        <>
          <div className="space-y-4">
            {questions.map((question, idx) => {
              const hasVoted = question.myVotes.length > 0;
              const showQuestionResults = showResults || hasVoted;
              const selected = selections[question.id] || [];

              return (
                <div key={question.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{question.title}</h3>
                      {question.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{question.description}</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {question.type === "MULTIPLE" ? "Select one or more" : "Select one"}
                      </p>
                    </div>
                  </div>

                  {showQuestionResults ? (
                    <div className="space-y-2">
                      {question.options.map((option) => {
                        const percentage = question.totalOptionVotes > 0
                          ? Math.round((option.voteCount / question.totalOptionVotes) * 100)
                          : 0;
                        const isMyVote = question.myVotes.includes(option.id);
                        const isExpanded = expandedOption === option.id;
                        return (
                          <div key={option.id}>
                            <div className={clsx("relative rounded-lg border p-3 overflow-hidden dark:border-gray-700",
                              isMyVote ? "border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10" : "border-gray-100 dark:border-gray-700"
                            )}>
                              <div className={clsx("absolute inset-y-0 left-0 transition-all duration-500",
                                isMyVote ? "bg-primary-100/60 dark:bg-primary-900/30" : "bg-gray-100/60 dark:bg-gray-700/40"
                              )} style={{ width: `${percentage}%` }} />
                              <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isMyVote && <CheckCircle2 size={16} className="text-primary-600 dark:text-primary-400 shrink-0" />}
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{option.text}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{percentage}%</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">({option.voteCount})</span>
                                </div>
                              </div>
                            </div>
                            {!survey.isAnonymous && option.voters.length > 0 && (
                              <button onClick={() => setExpandedOption(isExpanded ? null : option.id)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 mt-1 ml-1">
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {option.voters.length} voter{option.voters.length !== 1 ? "s" : ""}
                              </button>
                            )}
                            {isExpanded && !survey.isAnonymous && (
                              <div className="mt-1 ml-6 space-y-0.5">
                                {option.voters.map((v, i) => (
                                  <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                                    {v.name} <span className="text-gray-400 dark:text-gray-500">(Block {v.block}, {v.flatNumber})</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <button key={option.id}
                          onClick={() => handleSelect(question.id, option.id, question.type)}
                          className={clsx("w-full text-left p-3 rounded-lg border transition-all",
                            selected.includes(option.id)
                              ? "border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          )}>
                          <div className="flex items-center gap-3">
                            <div className={clsx("w-5 h-5 flex items-center justify-center shrink-0 border-2 transition-colors",
                              question.type === "SINGLE" ? "rounded-full" : "rounded",
                              selected.includes(option.id) ? "border-primary-500 bg-primary-500" : "border-gray-300 dark:border-gray-600"
                            )}>
                              {selected.includes(option.id) && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{option.text}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit */}
          {!showResults && !isClosed && (
            <div className="mt-6">
              {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {submitting ? "Submitting..." : "Submit Survey"}
              </button>
            </div>
          )}

          {/* Admin controls */}
          {canManagePolls() && (
            <div className="mt-6 flex items-center gap-3">
              {!isClosed && (
                <button onClick={handleClose} disabled={closing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                  <XCircle size={15} />
                  {closing ? "Closing..." : "Close Survey"}
                </button>
              )}
              <button onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <Trash2 size={15} />
                {deleting ? "Deleting..." : "Delete Survey"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

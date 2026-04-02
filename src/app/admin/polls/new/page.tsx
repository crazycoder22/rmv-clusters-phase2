"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, GripVertical } from "lucide-react";
import { useRole } from "@/hooks/useRole";

export default function CreatePollPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { canManagePolls } = useRole();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authStatus !== "loading" && !canManagePolls()) {
      router.replace("/polls");
    }
  }, [authStatus, canManagePolls, router]);

  const addOption = () => setOptions([...options, ""]);

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const moveOption = (from: number, to: number) => {
    if (to < 0 || to >= options.length) return;
    const updated = [...options];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) {
      setError("At least 2 non-empty options are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          type,
          isAnonymous,
          deadline,
          options: trimmedOptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create poll");
        return;
      }
      router.push(`/polls/${data.poll.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/polls"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 mb-6"
      >
        <ArrowLeft size={16} />
        Back to Polls
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-300 mb-6">
        Create New Poll
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Question / Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Should we install EV charging stations?"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add more context for voters..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Poll Type
          </label>
          <div className="flex gap-4">
            {(["SINGLE", "MULTIPLE"] as const).map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="pollType"
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t === "SINGLE" ? "Single Choice" : "Multiple Choice"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Anonymous */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Anonymous voting</span>
            <span className="text-xs text-gray-400">
              (voter identities hidden in results)
            </span>
          </label>
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deadline <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Options <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveOption(index, index - 1)}
                    disabled={index === 0}
                    className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 disabled:opacity-30"
                    tabIndex={-1}
                  >
                    <GripVertical size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                  tabIndex={-1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={15} />
            Add Option
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 rounded-lg p-3">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Creating Poll..." : "Create Poll"}
        </button>
      </form>
    </div>
  );
}

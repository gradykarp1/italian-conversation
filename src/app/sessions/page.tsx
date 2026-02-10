"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Session = {
  id: number;
  date: string;
  topic: string;
  summary: string;
  skill_notes: string;
  duration_seconds: number;
};

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [metaSummary, setMetaSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check auth
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();

        if (!authData.user) {
          router.push("/");
          return;
        }

        // Fetch sessions
        const sessionsRes = await fetch("/api/sessions");
        const sessionsData = await sessionsRes.json();

        if (sessionsData.sessions) {
          setSessions(sessionsData.sessions);
        }

        setLoading(false);

        // Fetch meta-summary (can take longer)
        const summaryRes = await fetch("/api/sessions/summary");
        const summaryData = await summaryRes.json();

        if (summaryData.summary) {
          setMetaSummary(summaryData.summary);
        } else if (summaryData.message) {
          setMetaSummary(summaryData.message);
        }

        setSummaryLoading(false);
      } catch (error) {
        console.error("Fetch error:", error);
        setLoading(false);
        setSummaryLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins === 0) return "< 1 min";
    return `${mins} min`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--accent)]">Loading sessions...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-2xl text-[var(--accent)]">Session History</h1>
          <p className="text-sm opacity-60">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <Link
          href="/coach"
          className="text-[var(--accent)] hover:underline"
        >
          [Back to Coach]
        </Link>
      </div>

      {/* Meta Summary */}
      <div className="mb-8 border border-[var(--border)] p-6">
        <h2 className="text-lg text-[var(--accent)] mb-4">Progress Overview</h2>
        {summaryLoading ? (
          <div className="text-[var(--foreground)] opacity-60">
            Analyzing your progress...
          </div>
        ) : metaSummary ? (
          <div className="whitespace-pre-wrap text-[var(--foreground)]">
            {metaSummary}
          </div>
        ) : (
          <div className="text-[var(--foreground)] opacity-60">
            No summary available.
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="space-y-2">
        <h2 className="text-lg text-[var(--accent)] mb-4">All Sessions</h2>

        {sessions.length === 0 ? (
          <div className="border border-[var(--border)] p-6 text-center">
            <p className="text-[var(--foreground)] opacity-60 mb-4">
              No sessions yet. Start a conversation to begin tracking your progress!
            </p>
            <Link
              href="/coach"
              className="text-[var(--accent)] hover:underline"
            >
              Start a Conversation →
            </Link>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="border border-[var(--border)]"
            >
              {/* Session Header - Clickable */}
              <button
                onClick={() =>
                  setExpandedSession(
                    expandedSession === session.id ? null : session.id
                  )
                }
                className="w-full p-4 text-left flex justify-between items-center hover:bg-[var(--border)]/20 transition-colors"
              >
                <div>
                  <span className="text-[var(--accent)]">
                    {formatDate(session.date)}
                  </span>
                  <span className="text-[var(--foreground)] opacity-60 ml-4">
                    {formatDuration(session.duration_seconds)}
                  </span>
                </div>
                <span className="text-[var(--foreground)] opacity-60">
                  {expandedSession === session.id ? "[-]" : "[+]"}
                </span>
              </button>

              {/* Expanded Content */}
              {expandedSession === session.id && (
                <div className="p-4 pt-0 border-t border-[var(--border)]">
                  {session.summary && (
                    <div className="mb-4">
                      <h3 className="text-sm text-[var(--accent)] mb-2">Summary</h3>
                      <p className="text-[var(--foreground)]">{session.summary}</p>
                    </div>
                  )}

                  {session.skill_notes && (
                    <div className="mb-4">
                      <h3 className="text-sm text-[var(--accent)] mb-2">Skill Notes</h3>
                      <p className="text-[var(--foreground)]">{session.skill_notes}</p>
                    </div>
                  )}

                  <Link
                    href={`/sessions/${session.id}`}
                    className="text-[var(--accent)] hover:underline text-sm"
                  >
                    View Full Transcript →
                  </Link>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}

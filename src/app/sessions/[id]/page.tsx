"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SessionData = {
  id: number;
  date: string;
  topic: string;
  transcript: string;
  summary: string;
  skill_notes: string;
  duration_seconds: number;
};

export default function SessionTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Check auth
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();

        if (!authData.user) {
          router.push("/");
          return;
        }

        // Fetch session
        const sessionRes = await fetch(`/api/sessions/${id}`);
        const sessionData = await sessionRes.json();

        if (!sessionRes.ok) {
          setError(sessionData.error || "Failed to load session");
          setLoading(false);
          return;
        }

        setSession(sessionData.session);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load session");
        setLoading(false);
      }
    };

    fetchSession();
  }, [id, router]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins === 0) return "< 1 min";
    return `${mins} min`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--accent)]">Loading transcript...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen p-4 max-w-3xl mx-auto">
        <div className="border border-[var(--border)] p-6 text-center">
          <p className="text-red-500 mb-4">{error || "Session not found"}</p>
          <Link
            href="/sessions"
            className="text-[var(--accent)] hover:underline"
          >
            ← Back to Sessions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl text-[var(--accent)]">Session Transcript</h1>
          <p className="text-sm opacity-60">
            {formatDate(session.date)} • {formatDuration(session.duration_seconds)}
          </p>
        </div>
        <Link
          href="/sessions"
          className="text-[var(--accent)] hover:underline"
        >
          [Back to Sessions]
        </Link>
      </div>

      {/* Summary Section */}
      {(session.summary || session.skill_notes) && (
        <div className="mb-6 border border-[var(--border)] p-4">
          {session.summary && (
            <div className="mb-4">
              <h2 className="text-sm text-[var(--accent)] mb-2">Summary</h2>
              <p className="text-[var(--foreground)]">{session.summary}</p>
            </div>
          )}

          {session.skill_notes && (
            <div>
              <h2 className="text-sm text-[var(--accent)] mb-2">Skill Notes</h2>
              <p className="text-[var(--foreground)]">{session.skill_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="border border-[var(--border)] p-4">
        <h2 className="text-sm text-[var(--accent)] mb-4">Full Transcript</h2>
        {session.transcript ? (
          <div className="space-y-4">
            {session.transcript.split("\n\n").map((line, index) => {
              const isCoach = line.startsWith("Coach");
              return (
                <div key={index} className="border-l-2 pl-4 border-[var(--border)]">
                  <p
                    className={`whitespace-pre-wrap ${
                      isCoach ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {line}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[var(--foreground)] opacity-60">
            No transcript available for this session.
          </p>
        )}
      </div>
    </main>
  );
}

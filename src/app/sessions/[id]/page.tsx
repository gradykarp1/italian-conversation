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

type SessionScores = {
  fluency_coherence: number;
  vocabulary_range: number;
  grammar_accuracy: number;
  grammar_range: number;
  interaction: number;
  overall_score: number;
  feedback: string;
  strengths: string;
  areas_to_improve: string;
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const percentage = (score / 5) * 100;
  const getColor = (s: number) => {
    if (s >= 4) return "bg-green-500";
    if (s >= 3) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[var(--foreground)]">{label}</span>
        <span className="text-[var(--accent)]">{score}/5</span>
      </div>
      <div className="h-2 bg-[var(--border)] rounded">
        <div
          className={`h-full rounded ${getColor(score)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function SessionTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [scores, setScores] = useState<SessionScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoresLoading, setScoresLoading] = useState(true);
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
          setScoresLoading(false);
          return;
        }

        setSession(sessionData.session);
        setLoading(false);

        // Fetch scores
        const scoresRes = await fetch(`/api/sessions/${id}/score`);
        if (scoresRes.ok) {
          const scoresData = await scoresRes.json();
          setScores(scoresData.scores);
        }
        setScoresLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load session");
        setLoading(false);
        setScoresLoading(false);
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

      {/* PLIDA B1 Scores */}
      <div className="mb-6 border border-[var(--border)] p-4">
        <h2 className="text-sm text-[var(--accent)] mb-4">PLIDA B1 Assessment</h2>
        {scoresLoading ? (
          <p className="text-[var(--foreground)] opacity-60">Loading scores...</p>
        ) : scores ? (
          <div className="space-y-4">
            {/* Score bars */}
            <div className="grid gap-3">
              <ScoreBar label="Fluency & Coherence" score={scores.fluency_coherence} />
              <ScoreBar label="Vocabulary Range" score={scores.vocabulary_range} />
              <ScoreBar label="Grammar Accuracy" score={scores.grammar_accuracy} />
              <ScoreBar label="Grammar Range" score={scores.grammar_range} />
              <ScoreBar label="Interaction" score={scores.interaction} />
            </div>

            {/* Overall score */}
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--foreground)]">Overall Score</span>
                <span className="text-2xl text-[var(--accent)] font-bold">
                  {scores.overall_score}/5
                </span>
              </div>
            </div>

            {/* Feedback */}
            {scores.feedback && (
              <div className="pt-3 border-t border-[var(--border)]">
                <h3 className="text-sm text-[var(--accent)] mb-2">Feedback</h3>
                <p className="text-[var(--foreground)]">{scores.feedback}</p>
              </div>
            )}

            {/* Strengths & Areas to Improve */}
            <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-[var(--border)]">
              {scores.strengths && (
                <div>
                  <h3 className="text-sm text-green-500 mb-2">Strengths</h3>
                  <p className="text-[var(--foreground)] text-sm">{scores.strengths}</p>
                </div>
              )}
              {scores.areas_to_improve && (
                <div>
                  <h3 className="text-sm text-yellow-500 mb-2">Areas to Improve</h3>
                  <p className="text-[var(--foreground)] text-sm">{scores.areas_to_improve}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[var(--foreground)] opacity-60">
            No scores available for this session.
          </p>
        )}
      </div>

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

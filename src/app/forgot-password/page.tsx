"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl text-[var(--accent)] mb-2">
            Forgot Password
          </h1>
          <p className="text-[var(--foreground)] opacity-60">
            Enter your email to receive a reset link
          </p>
        </div>

        {/* Terminal-style box */}
        <div className="border border-[var(--border)] p-6">
          {status === "sent" ? (
            <div className="text-center">
              <p className="text-[var(--accent)] mb-4">
                If an account exists with that email, a reset link has been sent.
              </p>
              <p className="text-[var(--foreground)] opacity-60 mb-4">
                Check your inbox and spam folder.
              </p>
              <Link
                href="/"
                className="text-[var(--accent)] hover:underline"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[var(--foreground)] opacity-60 mb-1">
                  Email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
                  required
                  disabled={status === "loading"}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full border border-[var(--accent)] text-[var(--accent)] px-4 py-2 hover:bg-[var(--accent)] hover:text-black transition-colors disabled:opacity-50"
              >
                {status === "loading" ? "Sending..." : "Send Reset Link"} →
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/"
                  className="text-[var(--foreground)] opacity-60 hover:opacity-100"
                >
                  ← Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

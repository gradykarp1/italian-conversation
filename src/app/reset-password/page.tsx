"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
      setStatus("error");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setStatus("error");
        return;
      }

      setStatus("success");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/");
      }, 3000);
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
            Reset Password
          </h1>
          <p className="text-[var(--foreground)] opacity-60">
            Enter your new password
          </p>
        </div>

        {/* Terminal-style box */}
        <div className="border border-[var(--border)] p-6">
          {status === "success" ? (
            <div className="text-center">
              <p className="text-[var(--accent)] mb-4">
                Password reset successfully!
              </p>
              <p className="text-[var(--foreground)] opacity-60">
                Redirecting to login...
              </p>
            </div>
          ) : !token ? (
            <div className="text-center">
              <p className="text-red-500 mb-4">
                Invalid or missing reset token.
              </p>
              <Link
                href="/forgot-password"
                className="text-[var(--accent)] hover:underline"
              >
                Request a new reset link →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[var(--foreground)] opacity-60 mb-1">
                  New Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
                  required
                  disabled={status === "loading"}
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-[var(--foreground)] opacity-60 mb-1">
                  Confirm Password:
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
                  required
                  disabled={status === "loading"}
                  minLength={6}
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
                {status === "loading" ? "Resetting..." : "Reset Password"} →
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

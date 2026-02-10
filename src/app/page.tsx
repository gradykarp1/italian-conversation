"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          router.push("/coach");
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, name };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push("/coach");
    } catch {
      setError("Network error. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--accent)]">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl text-[var(--accent)] mb-2">
            Italian Conversation Coach
          </h1>
          <p className="text-[var(--foreground)] opacity-60">
            PLIDA B1 Preparation
          </p>
        </div>

        {/* Terminal-style box */}
        <div className="border border-[var(--border)] p-6">
          {/* Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`${
                mode === "login"
                  ? "text-[var(--accent)]"
                  : "text-[var(--foreground)] opacity-50"
              }`}
            >
              [Login]
            </button>
            <button
              onClick={() => setMode("register")}
              className={`${
                mode === "register"
                  ? "text-[var(--accent)]"
                  : "text-[var(--foreground)] opacity-50"
              }`}
            >
              [Register]
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-[var(--foreground)] opacity-60 mb-1">
                  Name:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
                  required
                />
              </div>
            )}

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
              />
            </div>

            <div>
              <label className="block text-[var(--foreground)] opacity-60 mb-1">
                Password:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-[var(--border)] px-3 py-2 text-[var(--foreground)]"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              className="w-full border border-[var(--accent)] text-[var(--accent)] px-4 py-2 hover:bg-[var(--accent)] hover:text-black transition-colors"
            >
              {mode === "login" ? "Login" : "Register"} →
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

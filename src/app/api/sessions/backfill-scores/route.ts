import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSessionsWithoutScores, storeSessionScores, getUserByEmail } from "@/lib/db";
import { generateSessionScores } from "@/lib/scoring";

// Backfill scores for sessions that don't have them
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { limit = 10, secret, email } = body;

    let userId: number;

    // Allow either cookie auth or secret + email
    if (secret && secret === process.env.JWT_SECRET && email) {
      const user = await getUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      userId = user.id;
    } else {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = session.userId;
    }

    // Get sessions without scores
    const sessionsToScore = await getSessionsWithoutScores(userId, limit);

    if (sessionsToScore.length === 0) {
      return NextResponse.json({
        message: "All sessions already have scores",
        scored: 0,
      });
    }

    const results = [];

    for (const sessionData of sessionsToScore) {
      try {
        if (!sessionData.transcript) {
          results.push({ sessionId: sessionData.id, status: "skipped", reason: "no transcript" });
          continue;
        }

        const scores = await generateSessionScores(sessionData.transcript);
        await storeSessionScores(sessionData.id, userId, scores);
        results.push({ sessionId: sessionData.id, status: "scored", overallScore: scores.overallScore });
      } catch (error) {
        console.error(`Failed to score session ${sessionData.id}:`, error);
        results.push({ sessionId: sessionData.id, status: "error", error: String(error) });
      }
    }

    const scored = results.filter((r) => r.status === "scored").length;

    return NextResponse.json({
      message: `Scored ${scored} of ${sessionsToScore.length} sessions`,
      scored,
      total: sessionsToScore.length,
      results,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: "Backfill failed" },
      { status: 500 }
    );
  }
}

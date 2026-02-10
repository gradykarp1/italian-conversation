import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { getUserSessions, getUserById } from "@/lib/db";

const anthropic = new Anthropic();

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sessions = await getUserSessions(session.userId, 50);
    const user = await getUserById(session.userId);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        summary: null,
        message: "No sessions yet. Start a conversation to begin tracking your progress!",
      });
    }

    // Compile all summaries and skill notes for analysis
    const sessionData = sessions.map((s) => ({
      date: s.date as string,
      summary: s.summary as string,
      skillNotes: s.skill_notes as string,
      duration: s.duration_seconds as number,
    }));

    const prompt = `You are analyzing the learning progress of ${user?.name || "a student"} who is preparing for the PLIDA B1 Italian certification exam.

Here are their conversation session summaries, from most recent to oldest:

${sessionData.map((s, i) => `
Session ${i + 1} (${new Date(s.date).toLocaleDateString()}):
Summary: ${s.summary || "No summary available"}
Skill Notes: ${s.skillNotes || "No skill notes available"}
Duration: ${Math.floor(s.duration / 60)} minutes
`).join("\n")}

Based on these sessions, provide a comprehensive progress analysis with:

1. **Current Proficiency Level**: Assess their current Italian speaking level relative to PLIDA B1 requirements.

2. **Areas of Strength**: What aspects of Italian conversation are they doing well in?

3. **Areas for Improvement**: What specific skills or language areas need more work?

4. **Personalized Suggestions**: 3-5 specific, actionable recommendations for how they can improve. These should be tailored to their patterns and weaknesses.

5. **Progress Trend**: Are they improving over time? Any notable patterns?

Keep the analysis encouraging but honest. Format with clear headings and bullet points where appropriate.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    const metaSummary = textContent ? textContent.text : "Unable to generate summary.";

    return NextResponse.json({
      summary: metaSummary,
      sessionCount: sessions.length,
    });
  } catch (error) {
    console.error("Meta-summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

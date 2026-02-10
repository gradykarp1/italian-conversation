import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { getUserById, createSession, getRecentSessions, updateUserSkill, storeSessionEmbedding } from "@/lib/db";
import { generateEmbedding, createEmbeddingContent } from "@/lib/embeddings";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function summarizeSession(transcript: string, userName: string) {
  const prompt = `Analyze this Italian conversation practice session for ${userName}.

TRANSCRIPT:
${transcript}

Provide two things:

1. SUMMARY (2-3 sentences): What topics were discussed? How did the conversation flow?

2. SKILL NOTES (2-3 sentences): What level is ${userName} at? What did they do well? What could they improve? Note any specific grammar patterns, vocabulary, or tenses they used or struggled with.

Format your response exactly like this:
SUMMARY: [your summary here]

SKILL NOTES: [your skill notes here]`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content[0];
  if (textContent.type !== "text") {
    return { summary: "", skillNotes: "" };
  }

  const text = textContent.text;
  let summary = "";
  let skillNotes = "";

  if (text.includes("SUMMARY:")) {
    const parts = text.split("SKILL NOTES:");
    summary = parts[0].replace("SUMMARY:", "").trim();
    if (parts[1]) {
      skillNotes = parts[1].trim();
    }
  }

  return { summary, skillNotes };
}

async function assessSkillLevel(skillNotesHistory: string[]): Promise<string> {
  if (skillNotesHistory.length === 0) {
    return "beginner";
  }

  const combinedNotes = skillNotesHistory.join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 20,
    messages: [
      {
        role: "user",
        content: `Based on these skill observations from recent Italian conversation sessions, what is this learner's overall level?

OBSERVATIONS:
${combinedNotes}

Respond with exactly one word: beginner, intermediate, or advanced`,
      },
    ],
  });

  const textContent = response.content[0];
  if (textContent.type !== "text") {
    return "beginner";
  }

  const level = textContent.text.trim().toLowerCase();
  if (["beginner", "intermediate", "advanced"].includes(level)) {
    return level;
  }
  return "beginner";
}

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { transcript, durationSeconds } = await request.json();

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    // Generate summary and skill notes
    const { summary, skillNotes } = await summarizeSession(transcript, user.name);

    // Save session
    const savedSession = await createSession(
      user.id,
      transcript,
      summary,
      skillNotes,
      durationSeconds || 0
    );

    // Generate and store embedding for semantic search
    try {
      const embeddingContent = createEmbeddingContent(summary, skillNotes, transcript);
      const embedding = await generateEmbedding(embeddingContent);
      await storeSessionEmbedding(
        savedSession.id,
        user.id,
        embedding,
        embeddingContent.slice(0, 500) // Store truncated content for reference
      );
    } catch (embeddingError) {
      // Log but don't fail the request if embedding fails
      console.error("Failed to generate session embedding:", embeddingError);
    }

    // Update user skill level
    if (skillNotes) {
      const recentSessions = await getRecentSessions(user.id, 3);
      const skillNotesList = recentSessions
        .map((s) => s.skill_notes)
        .filter((n) => n);

      if (skillNotesList.length > 0) {
        const newLevel = await assessSkillLevel(skillNotesList);
        if (newLevel !== user.skill_level) {
          await updateUserSkill(user.id, newLevel);
        }
      }
    }

    return NextResponse.json({
      session: savedSession,
      summary,
      skillNotes,
    });
  } catch (error) {
    console.error("Session save error:", error);
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500 }
    );
  }
}

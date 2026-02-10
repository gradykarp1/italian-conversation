import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { getUserById, getRecentSessions, getSessionCount } from "@/lib/db";
import { buildSystemPrompt, buildUserContext, GREETING_PROMPT } from "@/lib/prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    const { message, history, isGreeting } = await request.json();

    // Build user context from past sessions
    const sessionCount = await getSessionCount(user.id);
    const recentSessions = await getRecentSessions(user.id, 3);
    const userContext = buildUserContext(
      sessionCount,
      recentSessions.map((s) => ({ summary: s.summary, skill_notes: s.skill_notes }))
    );

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      user.name,
      user.skill_level || "beginner",
      userContext
    );

    // Build messages
    let messages: Anthropic.MessageParam[];
    if (isGreeting) {
      messages = [{ role: "user", content: GREETING_PROMPT }];
    } else {
      messages = [
        ...history.map((h: { role: string; content: string }) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user" as const, content: message },
      ];
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const textContent = response.content[0];
    if (textContent.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return NextResponse.json({ response: textContent.text });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Chat failed" },
      { status: 500 }
    );
  }
}

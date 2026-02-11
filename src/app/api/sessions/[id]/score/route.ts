import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { getSessionById, storeSessionScores, getSessionScores } from "@/lib/db";

const anthropic = new Anthropic();

const SCORING_PROMPT = `You are an expert Italian language assessor evaluating a conversation for PLIDA B1 certification readiness.

Analyze the following conversation transcript between a learner and their Italian coach. Score the LEARNER's performance (not the coach) on each competency from 1-5:

SCORING SCALE:
1 = Well below B1 level - Major difficulties, very limited
2 = Below B1 level - Significant gaps, needs substantial work
3 = Approaching B1 level - Some competency but inconsistent
4 = At B1 level - Meets B1 requirements adequately
5 = Above B1 level - Exceeds B1 expectations

COMPETENCIES TO SCORE:

1. FLUENCY & COHERENCE: How smoothly does the learner communicate? Do they use connectors (quindi, però, anche, perché)? Is their speech logically organized?

2. VOCABULARY RANGE: Does the learner use varied, appropriate vocabulary? Do they go beyond basic words? Can they express ideas without excessive repetition?

3. GRAMMAR ACCURACY: How correct is their grammar? Verb conjugations, gender agreement, prepositions, article usage?

4. GRAMMAR RANGE: Do they attempt varied structures? Past tenses (passato prossimo, imperfetto), future, conditionals? Or only present tense?

5. INTERACTION: How well do they engage in conversation? Do they respond appropriately? Ask questions? Handle turn-taking?

TRANSCRIPT:
{transcript}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "fluencyCoherence": <1-5>,
  "vocabularyRange": <1-5>,
  "grammarAccuracy": <1-5>,
  "grammarRange": <1-5>,
  "interaction": <1-5>,
  "overallScore": <1-5>,
  "feedback": "<2-3 sentence overall assessment>",
  "strengths": "<comma-separated list of specific strengths observed>",
  "areasToImprove": "<comma-separated list of specific areas to work on>"
}`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Get the session
    const sessionData = await getSessionById(sessionId, session.userId);
    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!sessionData.transcript) {
      return NextResponse.json({ error: "Session has no transcript" }, { status: 400 });
    }

    // Check if already scored
    const existingScores = await getSessionScores(sessionId);
    const { force } = await request.json().catch(() => ({}));

    if (existingScores && !force) {
      return NextResponse.json({
        scores: existingScores,
        cached: true,
      });
    }

    // Generate scores
    const prompt = SCORING_PROMPT.replace("{transcript}", sessionData.transcript);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response
    let scores;
    try {
      scores = JSON.parse(textContent.text);
    } catch {
      console.error("Failed to parse scores JSON:", textContent.text);
      throw new Error("Invalid JSON response from scoring");
    }

    // Validate scores
    const requiredFields = [
      "fluencyCoherence", "vocabularyRange", "grammarAccuracy",
      "grammarRange", "interaction", "overallScore",
      "feedback", "strengths", "areasToImprove"
    ];

    for (const field of requiredFields) {
      if (!(field in scores)) {
        throw new Error(`Missing field: ${field}`);
      }
    }

    // Store scores
    await storeSessionScores(sessionId, session.userId, scores);

    return NextResponse.json({
      scores,
      cached: false,
    });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json(
      { error: "Failed to generate scores" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const scores = await getSessionScores(sessionId);

    if (!scores) {
      return NextResponse.json({ error: "No scores found" }, { status: 404 });
    }

    return NextResponse.json({ scores });
  } catch (error) {
    console.error("Get scores error:", error);
    return NextResponse.json(
      { error: "Failed to get scores" },
      { status: 500 }
    );
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { SessionScores } from "./db";

let anthropic: Anthropic;

function getAnthropic() {
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

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

export async function generateSessionScores(transcript: string): Promise<SessionScores> {
  const client = getAnthropic();
  const prompt = SCORING_PROMPT.replace("{transcript}", transcript);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Parse JSON response
  let scores: SessionScores;
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

  return scores;
}

import OpenAI from "openai";
import { findSimilarSessions } from "./db";

let openai: OpenAI;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI();
  }
  return openai;
}

/**
 * Generate an embedding for the given text using OpenAI's text-embedding-3-small model.
 * This produces a 1536-dimensional vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAI();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Create a summary of session content suitable for embedding.
 * Combines key information into a searchable format.
 */
export function createEmbeddingContent(
  summary: string,
  skillNotes: string,
  transcript?: string
): string {
  const parts: string[] = [];

  if (summary) {
    parts.push(`Summary: ${summary}`);
  }

  if (skillNotes) {
    parts.push(`Skills and patterns: ${skillNotes}`);
  }

  // Include a condensed version of transcript for context
  // Focus on the topics discussed
  if (transcript) {
    // Extract key phrases from transcript (first ~500 chars to keep embedding focused)
    const condensed = transcript.slice(0, 500);
    parts.push(`Discussion excerpt: ${condensed}`);
  }

  return parts.join("\n\n");
}

/**
 * Retrieve relevant past sessions based on current conversation context.
 * Returns formatted context that can be included in the coach prompt.
 */
export async function retrieveRelevantContext(
  userId: number,
  currentContext: string,
  limit: number = 3
): Promise<string | null> {
  try {
    // Generate embedding for current context
    const queryEmbedding = await generateEmbedding(currentContext);

    // Find similar past sessions
    const similarSessions = await findSimilarSessions(userId, queryEmbedding, limit);

    if (!similarSessions || similarSessions.length === 0) {
      return null;
    }

    // Filter to only include reasonably similar results (similarity > 0.7)
    const relevantSessions = similarSessions.filter(
      (s) => parseFloat(s.similarity) > 0.7
    );

    if (relevantSessions.length === 0) {
      return null;
    }

    // Format as context for the coach
    const contextParts = relevantSessions.map((session) => {
      const date = new Date(session.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `[${date}] ${session.summary || ""} ${session.skill_notes || ""}`.trim();
    });

    return `RELEVANT PAST SESSIONS:\n${contextParts.join("\n")}`;
  } catch (error) {
    console.error("Failed to retrieve relevant context:", error);
    return null;
  }
}

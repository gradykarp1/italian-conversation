import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/auth";
import { getUserTtsSpeed, getUserPersonality } from "@/lib/db";
import { getPersonality } from "@/lib/personalities";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, speed: overrideSpeed, voice: overrideVoice } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Use override speed (for previews) or fetch user's preference
    const speed = overrideSpeed ?? await getUserTtsSpeed(session.userId);

    // Use override voice (for previews) or get voice from user's personality
    let voice: "alloy" | "echo" | "fable" | "nova" | "onyx" | "shimmer" = "nova";
    if (overrideVoice) {
      voice = overrideVoice;
    } else {
      try {
        const personalityId = await getUserPersonality(session.userId);
        const personality = getPersonality(personalityId);
        voice = personality.voice;
      } catch (err) {
        console.error("Failed to get personality, using default voice:", err);
        // voice stays as "nova" default
      }
    }

    // Generate speech
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      speed,
      response_format: "mp3",
    });

    // Return audio as blob
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Text-to-speech failed" },
      { status: 500 }
    );
  }
}

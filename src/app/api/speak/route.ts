import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/auth";
import { getUserTtsSpeed } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, speed: overrideSpeed } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Use override speed (for previews) or fetch user's preference
    const speed = overrideSpeed ?? await getUserTtsSpeed(session.userId);

    // Generate speech
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
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

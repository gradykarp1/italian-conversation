import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById, updateUserTtsSpeed, updateUserPersonality } from "@/lib/db";
import { getAllPersonalities, DEFAULT_PERSONALITY } from "@/lib/personalities";

// Valid TTS speed options (10 settings from slow to slightly fast)
export const TTS_SPEED_OPTIONS = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 1.0, 1.1, 1.2, 1.3];
export const DEFAULT_TTS_SPEED = 0.85;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const personalities = getAllPersonalities();

    return NextResponse.json({
      ttsSpeed: user.tts_speed ?? DEFAULT_TTS_SPEED,
      ttsSpeedOptions: TTS_SPEED_OPTIONS,
      personality: user.coach_personality ?? DEFAULT_PERSONALITY,
      personalities: personalities.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        voice: p.voice,
      })),
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ttsSpeed, personality } = await request.json();

    // Validate and update speed if provided
    if (ttsSpeed !== undefined) {
      if (!TTS_SPEED_OPTIONS.includes(ttsSpeed)) {
        return NextResponse.json(
          { error: "Invalid speed setting" },
          { status: 400 }
        );
      }
      await updateUserTtsSpeed(session.userId, ttsSpeed);
    }

    // Validate and update personality if provided
    if (personality !== undefined) {
      const validPersonalities = getAllPersonalities().map((p) => p.id);
      if (!validPersonalities.includes(personality)) {
        return NextResponse.json(
          { error: "Invalid personality" },
          { status: 400 }
        );
      }
      await updateUserPersonality(session.userId, personality);
    }

    return NextResponse.json({
      success: true,
      ttsSpeed,
      personality,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

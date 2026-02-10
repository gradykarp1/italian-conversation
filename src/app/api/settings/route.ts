import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById, updateUserTtsSpeed } from "@/lib/db";

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

    return NextResponse.json({
      ttsSpeed: user.tts_speed ?? DEFAULT_TTS_SPEED,
      ttsSpeedOptions: TTS_SPEED_OPTIONS,
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

    const { ttsSpeed } = await request.json();

    // Validate speed is one of the allowed options
    if (!TTS_SPEED_OPTIONS.includes(ttsSpeed)) {
      return NextResponse.json(
        { error: "Invalid speed setting" },
        { status: 400 }
      );
    }

    await updateUserTtsSpeed(session.userId, ttsSpeed);

    return NextResponse.json({
      success: true,
      ttsSpeed,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

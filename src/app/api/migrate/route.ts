import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";

// Simple migration endpoint - call once to set up pgvector
// In production, you'd want to protect this with a secret key
export async function POST(request: NextRequest) {
  try {
    // Optional: verify migration secret
    const { secret } = await request.json().catch(() => ({}));

    if (process.env.MIGRATION_SECRET && secret !== process.env.MIGRATION_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await initDatabase();

    return NextResponse.json({
      success: true,
      message: "Database migration completed successfully",
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: String(error) },
      { status: 500 }
    );
  }
}

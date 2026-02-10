import { NextRequest, NextResponse } from "next/server";
import { getPasswordResetToken, markTokenUsed, updateUserPassword } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Find valid token
    const resetToken = await getPasswordResetToken(token);

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Update password
    const passwordHash = await hashPassword(password);
    await updateUserPassword(resetToken.user_id, passwordHash);

    // Mark token as used
    await markTokenUsed(resetToken.id);

    return NextResponse.json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}

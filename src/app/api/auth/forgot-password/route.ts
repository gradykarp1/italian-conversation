import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";
import { getUserByEmail, createPasswordResetToken, initDatabase } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Initialize database tables if needed
    await initDatabase();

    // Find user
    const user = await getUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If an account exists, a reset link has been sent.",
      });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token
    await createPasswordResetToken(user.id, token, expiresAt);

    // Send email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://italiano.gradykarp.com"}/reset-password?token=${token}`;

    await resend.emails.send({
      from: "Italian Coach <noreply@italiano.gradykarp.com>",
      to: email,
      subject: "Reset your password",
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset for your Italian Conversation Coach account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    });

    return NextResponse.json({
      message: "If an account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

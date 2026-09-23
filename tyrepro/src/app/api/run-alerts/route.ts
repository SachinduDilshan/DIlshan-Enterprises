import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Run all checks sequentially
    await fetch(`${base}/api/notify-cheques`);
    await fetch(`${base}/api/notify-stock`);
    await fetch(`${base}/api/notify-uc`);

    // Send emails to all users based on their preferences
    const emailRes = await fetch(`${base}/api/send-notification-email`, { method: "POST" });
    const emailData = await emailRes.json();

    return NextResponse.json({
      success:    true,
      emailsSent: emailData.emailsSent ?? 0,
      errors:     emailData.errors ?? [],
    });
  } catch (err: any) {
    console.error("run-alerts error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Also allow POST so it can be triggered manually from the UI
export async function POST(req: NextRequest) {
  return GET(req);
}
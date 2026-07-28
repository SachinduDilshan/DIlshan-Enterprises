import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Run all three alert checks
    await Promise.all([
      fetch(`${base}/api/notify-cheques`),
      fetch(`${base}/api/notify-stock`),
      fetch(`${base}/api/notify-uc`),
    ]);

    // Then send emails to all users
    await fetch(`${base}/api/send-notification-email`, { method: "POST" });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
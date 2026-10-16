import { NextRequest, NextResponse } from "next/server";

async function runAll(base: string) {
  // Run all checks in parallel
  await Promise.all([
    fetch(`${base}/api/notify-cheques`),
    fetch(`${base}/api/notify-stock`),
    fetch(`${base}/api/notify-uc`),
  ]);

  // Send emails
  const emailRes  = await fetch(`${base}/api/send-notification-email`, { method: "POST" });
  const emailData = await emailRes.json();

  return {
    success:    true,
    emailsSent: emailData.emailsSent ?? 0,
    errors:     emailData.errors     ?? [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const base   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const result = await runAll(base);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("run-alerts error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
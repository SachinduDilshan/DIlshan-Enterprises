import { NextRequest, NextResponse } from "next/server";

async function runAll(base: string) {
  await Promise.all([
    fetch(`${base}/api/notify-cheques`),
    fetch(`${base}/api/notify-stock`),
    fetch(`${base}/api/notify-uc`),
  ]);

  const emailRes  = await fetch(`${base}/api/send-notification-email`, { method: "POST" });
  const emailData = await emailRes.json();

  return {
    success:    true,
    emailsSent: emailData.emailsSent ?? 0,
    errors:     emailData.errors     ?? [],
  };
}

export async function GET(req: NextRequest) {
  // Verify cron secret — skip check in development
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const incoming = req.headers.get("x-cron-secret") ??
                     req.nextUrl.searchParams.get("secret");
    if (incoming !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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
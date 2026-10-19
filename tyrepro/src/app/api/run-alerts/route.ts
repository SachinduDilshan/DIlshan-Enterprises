import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(req: NextRequest): string {
  // First try the env var
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/$/, ""); // strip trailing slash
  }

  // Fall back to deriving from the request URL itself
  const { protocol, host } = new URL(req.url);
  return `${protocol}//${host}`;
}

async function runAll(base: string) {
  console.log("run-alerts base URL:", base);

  const [cheqRes, stockRes, ucRes] = await Promise.all([
    fetch(`${base}/api/notify-cheques`),
    fetch(`${base}/api/notify-stock`),
    fetch(`${base}/api/notify-uc`),
  ]);

  console.log("notify-cheques status:", cheqRes.status);
  console.log("notify-stock status:",   stockRes.status);
  console.log("notify-uc status:",      ucRes.status);

  const emailRes  = await fetch(`${base}/api/send-notification-email`, { method: "POST" });
  const emailData = await emailRes.json();

  console.log("email result:", emailData);

  return {
    success:    true,
    emailsSent: emailData.emailsSent ?? 0,
    errors:     emailData.errors     ?? [],
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const incoming = req.headers.get("x-cron-secret") ??
                     req.nextUrl.searchParams.get("secret");
    if (incoming !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const base   = getBaseUrl(req);
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
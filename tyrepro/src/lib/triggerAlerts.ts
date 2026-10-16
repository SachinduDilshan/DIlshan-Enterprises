export async function triggerAlerts(): Promise<void> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await fetch(`${base}/api/run-alerts`, { method: "GET" });
  } catch (err) {
    console.warn("triggerAlerts failed:", err);
  }
}
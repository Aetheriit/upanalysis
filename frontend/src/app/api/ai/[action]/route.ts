import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 90;

function authenticated(request: NextRequest) {
  const session = request.cookies.get("ei_session")?.value;
  if (!session) return false;
  const parts = session.split(".");
  if (parts.length !== 2 || !/^[0-9a-f]{64}$/.test(parts[1])) return false;
  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  const match = /^premium-access:(\d+)$/.exec(payload);
  if (!match) return false;
  const age = Date.now() - Number(match[1]);
  if (age < 0 || age > 12 * 60 * 60 * 1000) return false;
  const expected = createHmac("sha256", process.env.AUTH_SECRET || "up-election-intelligence-private-access").update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(parts[1], "hex"));
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || request.nextUrl.host;
  if (!origin) return false;
  try {
    const source = new URL(origin);
    return source.host === host && (source.protocol === "https:" || /^(localhost|127\.0\.0\.1)(:|$)/.test(host));
  } catch { return false; }
}

async function proxy(request: NextRequest, action: string, method: "GET" | "POST") {
  if (!authenticated(request)) return NextResponse.json({ detail: "Please sign in again to use AI." }, { status: 401 });
  if (!["chat", "gis", "status"].includes(action) || (method === "GET") !== (action === "status")) return NextResponse.json({ detail: "Unknown AI action." }, { status: 404 });
  if (method === "POST" && !sameOrigin(request)) return NextResponse.json({ detail: "Use the signed-in application to ask questions." }, { status: 403 });
  const token = process.env.AI_PROXY_TOKEN;
  if (!token) return NextResponse.json({ detail: "AI is not configured for this deployment." }, { status: 503 });
  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (body.length > 14000) return NextResponse.json({ detail: "Please shorten your question." }, { status: 413 });
  }
  try {
    const result = await fetch(API_BASE_URL + "/api/v1/insights/" + action, {
      method, body, cache: "no-store", signal: AbortSignal.timeout(80000),
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "X-AI-Client": createHash("sha256").update(request.cookies.get("ei_session")!.value).digest("hex") },
    });
    return NextResponse.json(await result.json(), { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ detail: "The AI service is unavailable. Your election data remains available; please retry." }, { status: 502 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  return proxy(request, (await context.params).action, "POST");
}
export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  return proxy(request, (await context.params).action, "GET");
}

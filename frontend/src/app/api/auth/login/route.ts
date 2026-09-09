import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const LOGIN_ID = process.env.PREMIUM_LOGIN_ID || "rahul@admin";
const LOGIN_PASSWORD = process.env.PREMIUM_LOGIN_PASSWORD || "Rahul@up";
const AUTH_SECRET = process.env.AUTH_SECRET || "up-election-intelligence-private-access";

function sessionToken() {
  const payload = `premium-access:${Date.now()}`;
  const signature = createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function secureEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const valid = secureEquals(String(body.loginId || ""), LOGIN_ID) && secureEquals(String(body.password || ""), LOGIN_PASSWORD);
  if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set("ei_session", sessionToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

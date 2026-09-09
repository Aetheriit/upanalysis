import { NextRequest, NextResponse } from "next/server";

const AUTH_SECRET = process.env.AUTH_SECRET || "up-election-intelligence-private-access";
const encoder = new TextEncoder();

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

async function validSession(value?: string) {
  if (!value) return false;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return false;
  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  if (!payload.startsWith("premium-access:")) return false;
  const issuedAt = Number(payload.split(":")[1]);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 1000 * 60 * 60 * 12) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(AUTH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  const received = hexToBytes(signature);
  if (received.length !== expected.length) return false;
  return received.every((byte, index) => byte === expected[index]);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/") || pathname.startsWith("/_next/") || pathname === "/favicon.ico") return NextResponse.next();
  if (await validSession(request.cookies.get("ei_session")?.value)) return NextResponse.next();
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

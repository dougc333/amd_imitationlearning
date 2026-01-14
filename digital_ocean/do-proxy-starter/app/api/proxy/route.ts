import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.THIRD_PARTY_BASE || "https://api.digitalocean.com/v2";
const KEY  = process.env.DIGITALOCEAN_TOKEN || "";

/**
 * GET /api/proxy?path=/widgets&qs=page=1&per_page=10
 * Forwards to: ${BASE}/widgets?page=1&per_page=10
 * Adds Authorization header server-side.
 * 
 */
export async function GET(req: NextRequest) {
  if (!BASE || !KEY) {
    console.log("Base:", BASE);
    console.log("Key:", KEY);
    return NextResponse.json(
      { error: "Server is missing THIRD_PARTY_BASE or THIRD_PARTY_API_KEY" },
      { status: 500 }
    );
  }

  
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";
  const qs   = searchParams.get("qs") || "";
  console.log("path:", path);
  console.log("query string:", qs);
  // Basic hardening. 
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "path must start with '/'" }, { status: 400 });
  }

  // Optional: strict allowlist of external paths
  //it should come from /droplets which is the url form. 
  const ALLOW = new Set<string>(["/account","/droplet", "/widgets", "/users", "/me"]);
  if (ALLOW.size && !ALLOW.has(path)) {
    console.log("path not allowed:", path);
    return NextResponse.json({ error: `Path not allowed: ${path}` }, { status: 403 });
  }

  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  console.log("url:", url);
  
  // Forward GET with server-only Authorization
  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Accept": "application/json",
    },
    // Prevent Next from caching serverless result
    cache: "no-store",
    next: { revalidate: 0 },
  });

  const bodyText = await upstream.text();
  return new NextResponse(bodyText, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}
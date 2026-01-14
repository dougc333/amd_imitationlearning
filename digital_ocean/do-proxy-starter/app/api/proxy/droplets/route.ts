// app/api/proxy/droplets/route.ts
import { NextRequest, NextResponse } from "next/server";



// app/api/proxy/droplets/route.ts

const BASE = process.env.THIRD_PARTY_BASE || "https://api.digitalocean.com/v2";
const KEY  = process.env.DIGITALOCEAN_TOKEN || "";

export async function GET(_req: NextRequest) {
  try {
    if (!KEY) {
      return NextResponse.json({ error: "Missing DIGITALOCEAN_TOKEN" }, { status: 500 });
    }

    // basic first page; bump per_page if you want (max 200)
    const url = `${BASE}/droplets?per_page=200`;
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const ct = upstream.headers.get("content-type") || "";
    const body = ct.includes("application/json")
      ? await upstream.json()
      : { raw: await upstream.text() };

    return NextResponse.json(body, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}





export async function POST(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ error: "Missing THIRD_PDIGITALOCEAN_TOKEN" }, { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
    console.log("app/api/proxy/droplets/route.ts payload:", payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // (Optional) basic allowlist / validation
  if (!payload?.name || !payload?.region || !payload?.size || !payload?.image) {
    return NextResponse.json(
      { error: "Required fields: name, region, size, image" },
      { status: 400 }
    );
  }

  const url = `${BASE}/droplets`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await upstream.text();
  console.log("app/api/proxy/droplets/route.ts text:", text);
  //this is the status 200 back to the FE?
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}



export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
const DO = "https://api.digitalocean.com/v2";


export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { id } = "then" in (ctx as any).params ? await (ctx as any).params : (ctx as any).params;
  console.log("app/api/proxy/droplets/[id]/route.ts id:", id);
  
  const res = await fetch(`${DO}/droplets/${id}`, {
    headers: {
      Authorization: `Bearer ${process.env.DIGITALOCEAN_TOKEN}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 204) return new Response(null, { status: 204 });
  console.log("app/api/proxy/droplets/[id]/route.ts res.status:", res.status)

  const data = await res.json().catch(() => ({}));
  console.log("app/api/proxy/droplets/[id]/route.ts data:",data)
  //console.log("app/api/proxy/droplets/[id]/route.ts data.droplet.networks:",data.droplet.networks)
  //console.log("app/api/proxy/droplets/[id]/route.ts data.droplet.networks.v4:",data.droplet.networks.v4)
  //console.log("app/api/proxy/droplets/[id]/route.ts data.droplet.networks.v4:",data.droplet.networks.v4[0].ip_address, data.droplet.networks.v4[0].type)
  if (data) {
    if (data?.droplet?.networks?.v4?.[0]?.type === "public") {
      return NextResponse.json(data, { status: res.status });
    }
  }
  //is this necessary? yes. 
  return NextResponse.json({ error: "Droplet not found" }, { status: 404 });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } =
      "then" in (ctx as any).params ? await (ctx as any).params : (ctx as any).params;
    console.log("app/api/proxy/[id]/route.ts DELETE id:", id);
    const token = process.env.DIGITALOCEAN_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Missing DIGITALOCEAN_TOKEN" }, { status: 500 });
    }

    const upstream = await fetch(`https://api.digitalocean.com/v2/droplets/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    // DO returns 204 No Content on success. Normalize to JSON for your client.
    if (upstream.status === 204) {
      return NextResponse.json(
        { message: "Droplet destroy requested.", dropletId: id },
        { status: 200 }
      );
    }

    const ct = upstream.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await upstream.json() : { raw: await upstream.text() };
    return NextResponse.json(body, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
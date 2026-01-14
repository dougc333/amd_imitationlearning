// app/api/ssh/session/[id]/input/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { sshSessions } from "@/lib/sshSessions";
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;                 // IMPORTANT: await
  const { data } = await req.json();

  const s = sshSessions.get(id);
  if (!s || !s.stream) {
    console.error("[/input] session not found:", id);
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const str = typeof data === "string" ? data : String(data ?? "");
  try {
    s.stream.write(str);
    return Response.json({ ok: true, len: str.length });
  } catch (e: any) {
    console.error("[/input] write failed:", e);
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}


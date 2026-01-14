export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { sshSessions } from "@/lib/sshSessions";
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;                     // 👈 await it
  const { cols, rows } = await req.json();
  const s = sshSessions.get(id);
  if (!s || !s.stream) return Response.json({ error: "Not found" }, { status: 404 });
  if (Number.isFinite(cols) && Number.isFinite(rows)) s.stream.setWindow(rows, cols, rows, cols);
  return Response.json({ ok: true });
}


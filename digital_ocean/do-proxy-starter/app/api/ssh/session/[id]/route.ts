export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { sshSessions } from "@/lib/sshSessions";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;                     // 👈 await it
  sshSessions.remove(id);
  return new Response(null, { status: 204 });
}


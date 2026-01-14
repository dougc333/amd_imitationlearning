// export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { sshSessions } from "@/lib/sshSessions";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const s = sshSessions.get(id);
  if (!s) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let sub: { write: (chunk: string) => void; close: () => void } | null = null;
  let hb: NodeJS.Timeout | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
          if (hb) clearInterval(hb);
        }
      };

      const write = (chunk: string) => {
        const payload = JSON.stringify(chunk);
        safeEnqueue(`data: ${payload}\n\n`);
      };

      const close = () => {
        if (!closed) {
          closed = true;
          if (hb) clearInterval(hb);
          try {
            controller.close();
          } catch {}
        }
      };

      sub = { write, close };
      if (!sshSessions.addSub(id, sub)) {
        close();
        return;
      }

      write("[connected]\r\n");

      hb = setInterval(() => {
        safeEnqueue(`: ping\n\n`);  // SSE comment heartbeat
      }, 15_000);
    },

    cancel() {
      closed = true;
      if (hb) {
        clearInterval(hb);
        hb = null;
      }
      if (sub) sshSessions.removeSub(id, sub);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
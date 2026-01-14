// app/api/ssh/session/route.ts
import { NextRequest } from "next/server";
import { sshSessions } from "@/lib/sshSessions";
import { Client } from "ssh2";
import fs from "node:fs";

export const runtime = "nodejs";

function loadKey(): string {
  const inline = process.env.DO_SSH_PRIVATE_KEY;
  if (inline && inline.trim()) return inline.replace(/\\n/g, "\n");
  const path = process.env.DO_SSH_PRIVATE_KEY_PATH;
  if (path) return fs.readFileSync(path, "utf8");
  throw new Error("Missing SSH key (DO_SSH_PRIVATE_KEY or DO_SSH_PRIVATE_KEY_PATH)");
}
const isIPv4 = (x: string) => /^\s*(\d{1,3}\.){3}\d{1,3}\s*$/.test(x);

export async function POST(req: NextRequest) {
  try {
    const { host, username = "root", cols = 120, rows = 32 } = await req.json();
    if (!host || !isIPv4(host)) return Response.json({ error: "Invalid IPv4" }, { status: 400 });

    const sess = sshSessions.create();
    const key = loadKey();

    await new Promise<void>((resolve, reject) => {
      sess.conn = new Client();
      sess.conn
        .on("ready", () => {
          sess.conn.shell({ cols, rows, term: "xterm-256color" }, (err, stream) => {
            if (err) return reject(err);
            sess.stream = stream;
            sess.alive = true;

            //stream.on("data", (b: Buffer) => sshSessions.broadcast(sess.id, b.toString("utf8")));
            stream.on("data", (b: Buffer) => {
              const text = b.toString("utf8");
            
              // existing behavior: send raw terminal output to the client(s)
              sshSessions.broadcast(sess.id, text);
            
              // NEW: detect vLLM verification success
              if (
                text.includes("Success! vLLM version:")
              ) {
                // you can store it on the session for later querying:
                (sess as any).vllmVerified = true;
            
                // and/or send a special marker line down the same channel:
                sshSessions.broadcast(sess.id, "\r\n[__VLLM_INSTALL_VERIFIED__]\r\n");
              }
            });
            
            stream.stderr.on("data", (b: Buffer) => {
              sshSessions.broadcast(sess.id, b.toString("utf8"));
            });
            stream.stderr.on("data", (b: Buffer) => sshSessions.broadcast(sess.id, b.toString("utf8")));
            stream.on("close", () => { sshSessions.broadcast(sess.id, "\r\n[session closed]\r\n"); sshSessions.remove(sess.id); });

            resolve();
          });
        })
        .on("error", (e) => reject(e))
        .connect({ host: host.trim(), port: 22, username: String(username || "root").trim(), privateKey: key, readyTimeout: 15000 });
    });

    return Response.json({ id: sess.id });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

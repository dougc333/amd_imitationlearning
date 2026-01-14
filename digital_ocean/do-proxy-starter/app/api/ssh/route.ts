// app/api/proxy/ssh/route.ts
import { NextRequest } from "next/server";
import { Client } from "ssh2";
import fs from "node:fs";

export const runtime = "nodejs";

// Configure how to load the private key:
// 1) DO_SSH_PRIVATE_KEY contains the key contents
// 2) or DO_SSH_PRIVATE_KEY_PATH is a file path on the server
function loadPrivateKey(): string {
  const keyFromEnv = process.env.DO_SSH_PRIVATE_KEY;
  if (keyFromEnv && keyFromEnv.trim()) {
    // Support escaped newlines if stored like \n
    return keyFromEnv.replace(/\\n/g, "\n");
  }
  const keyPath = process.env.DO_SSH_PRIVATE_KEY_PATH;
  if (keyPath) {
    return fs.readFileSync(keyPath, "utf8");
  }
  throw new Error("Missing SSH private key. Set DO_SSH_PRIVATE_KEY or DO_SSH_PRIVATE_KEY_PATH.");
}

// (Optional) Very light host validation
function isValidIPv4(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

// (Optional) command allowlist for safety. Expand as needed.
const ALLOWLIST = new Set([
  "uname -a",
  "whoami",
  "echo ok",
  "cloud-init status --wait",
  "uptime",
  "lsb_release -a",
  "cat /etc/os-release",
  "df -h",
  "free -m",
]);

function allowedCommand(cmd: string) {
  // You can loosen this by returning true or implement your own parser/guard.
  return ALLOWLIST.has(cmd.trim());
}

export async function POST(req: NextRequest) {
  try {
    const { host, user = "root", port = 22, command } = await req.json();

    if (!host || !command) {
      return new Response(JSON.stringify({ error: "host and command are required" }), { status: 400 });
    }
    if (!isValidIPv4(host)) {
      return new Response(JSON.stringify({ error: "host must be a public IPv4 address" }), { status: 400 });
    }
    if (!allowedCommand(command)) {
      return new Response(JSON.stringify({ error: "command not allowed (server allowlist)" }), { status: 403 });
    }

    const privateKey = loadPrivateKey();

    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const conn = new Client();
      let stdout = "";
      let stderr = "";

      conn
        .on("ready", () => {
          conn.exec(command, (err: any, stream: any) => {
            if (err) {  
              conn.end();
              return reject(err);
            }
            stream
              .on("close", (code: number) => {
                conn.end();
                resolve({ stdout, stderr, code });
              })
              .on("data", (data: Buffer) => {
                stdout += data.toString("utf8");
              })
              .stderr.on("data", (data: Buffer) => {
                stderr += data.toString("utf8");
              });
          });
        })
        .on("error", (err: any) => reject(err))
        .connect({
          host,
          port,
          username: user,
          privateKey,
          // Reasonable timeouts
          readyTimeout: 15000,
          // Optional: strict host key checking can be enforced via hostVerifier
          // hostVerifier: (hash) => { ... return true; }
        });
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500 });
  }
}
// app/api/ssh/build-vllm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This assumes buildvllm.sh is at the project root or scripts/buildvllm.sh.
// Adjust the path as needed.
const LOCAL_SCRIPT_PATH = path.join(process.cwd(), "buildvllm.sh");

export async function POST(req: NextRequest) {
  try {
    const { ip } = (await req.json()) as { ip?: string };
    if (!ip) {
      return NextResponse.json(
        { error: "Missing ip in request body" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(LOCAL_SCRIPT_PATH)) {
      return NextResponse.json(
        { error: `buildvllm.sh not found at ${LOCAL_SCRIPT_PATH}` },
        { status: 500 }
      );
    }

    // Read local script content and pipe it over SSH as user "amd"
    const script = fs.readFileSync(LOCAL_SCRIPT_PATH, "utf8");
    const sshTarget = `amd@${ip}`;

    return await new Promise<NextResponse>((resolve) => {
      const child = spawn(
        "ssh",
        [
          "-o",
          "StrictHostKeyChecking=no",
          sshTarget,
          "bash -s",
        ],
        { stdio: ["pipe", "pipe", "pipe"] }
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      // Write script to remote stdin
      child.stdin.write(script);
      child.stdin.end();

      child.on("close", (code) => {
        if (code === 0) {
          resolve(
            NextResponse.json({
              ok: true,
              exitCode: code,
              stdout,
              stderr,
            })
          );
        } else {
          resolve(
            NextResponse.json(
              {
                ok: false,
                exitCode: code,
                stdout,
                stderr,
              },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
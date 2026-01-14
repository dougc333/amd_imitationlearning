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

    const script = fs.readFileSync(LOCAL_SCRIPT_PATH, "utf8");
    const sshTarget = `amd@${ip}`;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
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

        // Pipe script into remote bash
        child.stdin.write(script);
        child.stdin.end();

        child.stdout.on("data", (chunk: Buffer) => {
          controller.enqueue(encoder.encode(chunk.toString()));
        });

        child.stderr.on("data", (chunk: Buffer) => {
          controller.enqueue(encoder.encode(chunk.toString()));
        });

        child.on("error", (err) => {
          controller.enqueue(
            encoder.encode(`SSH process error: ${err.message}\n`)
          );
          controller.enqueue(encoder.encode("\n[EXIT_CODE=255]\n"));
          controller.close();
        });

        child.on("close", (code) => {
          const exitCode = typeof code === "number" ? code : -1;
          controller.enqueue(
            encoder.encode(`\n[EXIT_CODE=${exitCode}]\n`)
          );
          controller.close();
        });
      },
      cancel(reason) {
        // Optional: you could kill the child process here if you track it outside
        console.log("Stream cancelled:", reason);
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
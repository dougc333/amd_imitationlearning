import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const ipRaw = typeof body.ip === "string" ? body.ip.trim() : "";
    
    console.log("scp-vllm ipRaw:", ipRaw);
    if (!ipRaw) {
      return NextResponse.json(
        { error: "Missing 'ip' in request body" },
        { status: 400 }
      );
    }

    const ipv4Regex =
      /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    if (!ipv4Regex.test(ipRaw)) {
      return NextResponse.json(
        { error: `Invalid IPv4 address: ${ipRaw}` },
        { status: 400 }
      );
    }
    
    const buildScriptPath = path.join(process.cwd(), "buildvllm.sh");
    if (!fs.existsSync(buildScriptPath)) {
      return NextResponse.json(
        {
          error: `buildvllm.sh not found at ${buildScriptPath}. Ensure it exists at project root.`,
        },
        { status: 500 }
      );
    }
    console.log("buildScriptPath:", buildScriptPath);

    const { stdout, stderr, exitCode } = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
    }>((resolve, reject) => {
      const args = [
        "-o",
        "StrictHostKeyChecking=no",
        buildScriptPath,
        `amd@${ipRaw}:/home/amd`,
      ];

      const child = spawn("scp", args, {
        env: process.env,
      });

      let out = "";
      let err = "";

      child.stdout.on("data", (d) => (out += d.toString()));
      child.stderr.on("data", (d) => (err += d.toString()));
     child.on("error", (e) => {
        reject(e);
      });
      child.on("close", (code) =>
        resolve({ stdout: out, stderr: err, exitCode: code ?? null })
      );
    });
    if (exitCode !== 0) {
      console.log("exit code not 0");
    }else{
      console.log("exit code 0");
    }
    console.log("scp-vllm exitCode:", exitCode);
    return NextResponse.json({
      stdout,
      stderr,
      exitCode,
    });
  } catch (err: any) {
    console.error("scp-vllm error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error running scp" },
      { status: 500 }
    );
  }
}
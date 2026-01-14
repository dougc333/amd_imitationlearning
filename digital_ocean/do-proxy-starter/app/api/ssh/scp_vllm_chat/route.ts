// app/api/ssh/scp_vllm_chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runCmd(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null }>(
    (resolve, reject) => {
      const child = spawn(cmd, args, { env: process.env });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", d => (stdout += d.toString()));
      child.stderr.on("data", d => (stderr += d.toString()));
      child.on("error", reject);
      child.on("close", code => resolve({ stdout, stderr, exitCode: code ?? null }));
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const ipRaw = typeof body.ip === "string" ? body.ip.trim() : "";

    console.log("scp_vllm_chat ipRaw:", ipRaw);
    if (!ipRaw)
      return NextResponse.json({ error: "Missing 'ip'" }, { status: 400 });

    const ipv4Regex =
      /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

    if (!ipv4Regex.test(ipRaw))
      return NextResponse.json(
        { error: `Invalid IPv4 address: ${ipRaw}` },
        { status: 400 }
      );

    const localDir = path.join(process.cwd(), "vllm_chat");
    if (!fs.existsSync(localDir))
      return NextResponse.json(
        { error: `vllm_chat directory not found at ${localDir}` },
        { status: 500 }
      );

    console.log("SCP starting…");

    // ---------- STEP 1: SCP ----------
    const scp = await runCmd("scp", [
      "-o",
      "StrictHostKeyChecking=no",
      "-r",
      localDir,
      `amd@${ipRaw}:/home/amd`
    ]);

    console.log("scp exit:", scp.exitCode);

    let installResult: any = null;

    // ---------- STEP 2: Run install script ----------
    if (scp.exitCode === 0) {
      console.log("Running vllm_chat_install.sh…");

      installResult = await runCmd("ssh", [
        "-o",
        "StrictHostKeyChecking=no",
        `amd@${ipRaw}`,
        "cd /home/amd/vllm_chat && bash vllm_chat_install.sh"
      ]);

      console.log("install script exit:", installResult.exitCode);
    }

    return NextResponse.json({
      scp,
      install: installResult
    });
  } catch (err: any) {
    console.error("scp_vllm_chat error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error running scp/install" },
      { status: 500 }
    );
  }
}
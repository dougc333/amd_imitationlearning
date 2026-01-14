// app/api/ssh/setup-amd/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATE_AMD_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

USERNAME="amd"
HOME_DIR="/home/$USERNAME"

if [[ "$EUID" -ne 0 ]]; then
  echo "must run as root" >&2
  exit 1
fi

if id "$USERNAME" &>/dev/null; then
  echo "user $USERNAME already exists"
else
  useradd -m -d "$HOME_DIR" -s /bin/bash "$USERNAME"
  echo "created user $USERNAME"
fi

mkdir -p "$HOME_DIR/.ssh"
chmod 700 "$HOME_DIR/.ssh"
chown "$USERNAME:$USERNAME" "$HOME_DIR/.ssh"

if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys "$HOME_DIR/.ssh/authorized_keys"
  chown "$USERNAME:$USERNAME" "$HOME_DIR/.ssh/authorized_keys"
  chmod 600 "$HOME_DIR/.ssh/authorized_keys"
fi

echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME
chmod 440 /etc/sudoers.d/$USERNAME

echo "OK: user $USERNAME configured"
`;

export async function POST(req: NextRequest) {
  try {
    const { ip } = (await req.json()) as { ip?: string };
    if (!ip) {
      return NextResponse.json(
        { error: "Missing ip in request body" },
        { status: 400 }
      );
    }

    // IMPORTANT: ssh key must already be configured on the Next.js host
    // e.g. via DO_SSH_PRIVATE_KEY or a file like /root/.ssh/id_ed25519
    const sshTarget = `root@${ip}`;

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

      // write script into stdin
      child.stdin.write(CREATE_AMD_SCRIPT);
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
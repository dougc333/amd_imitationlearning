"use client";
import React from "react";

type SshResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: string;
};

const PRESET_COMMANDS = [
  "echo ok",
  "whoami",
  "uname -a",
  "cloud-init status --wait",
  "cat /etc/os-release",
  "uptime",
  "df -h",
  "free -m",
];

export default function SshIntoDroplet({ initialIP }: { initialIP?: string }) {
  const [ip, setIp] = React.useState(initialIP ?? "");
  const [command, setCommand] = React.useState("echo ok");
  const [loading, setLoading] = React.useState(false);
  const [res, setRes] = React.useState<SshResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRes(null);

    if (!ip) {
      setError("Public IPv4 is required.");
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch("/api/proxy/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: ip, user: "root", command }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || JSON.stringify(data));
      }
      setRes(data);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, marginTop: 16 }}>
      <h3>SSH into Droplet</h3>
      <form onSubmit={runCommand} style={{ display: "grid", gap: 10 }}>
        <label>
          Droplet Public IPv4
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g., 203.0.113.42"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          Command
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., uname -a"
              style={{ flex: 1, padding: 8 }}
              list="ssh-presets"
            />
            <datalist id="ssh-presets">
              {PRESET_COMMANDS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: loading ? "#eee" : "#f7f7f7",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Running…" : "Run over SSH"}
            </button>
          </div>
        </label>
      </form>

      {error && (
        <pre style={{ background: "#fee", padding: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}

      {res && (
        <div style={{ background: "#f6f8fa", padding: 12, marginTop: 12 }}>
          <p>
            <strong>Exit code:</strong> {res.code ?? "null"}
          </p>
          <details open>
            <summary><strong>STDOUT</strong></summary>
            <pre style={{ overflow: "auto" }}>{res.stdout || "(empty)"}</pre>
          </details>
          <details>
            <summary><strong>STDERR</strong></summary>
            <pre style={{ overflow: "auto", color: "#b00" }}>{res.stderr || "(empty)"}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
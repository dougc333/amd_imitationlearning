"use client";
import React, { useMemo, useState } from "react";

type SSHResponse = {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: string;
};

const PRESET_COMMANDS = [
  { label: "Echo (smoke test)", value: "echo ok" },
  { label: "Who am I", value: "whoami" },
  { label: "Kernel / OS", value: "uname -a" },
  { label: "Cloud-init status (wait)", value: "cloud-init status --wait" },
  { label: "OS release", value: "cat /etc/os-release" },
  { label: "Uptime", value: "uptime" },
  { label: "Disk usage", value: "df -h" },
  { label: "Memory (MB)", value: "free -m" },
] as const;

export default function SSHCommandForm() {
  const [ip, setIp] = useState("64.23.219.132");
  const [user, setUser] = useState("amd");

  // command selection
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState(PRESET_COMMANDS[0].value);
  const [customCommand, setCustomCommand] = useState("uname -a");

  const commandToRun = useMemo(
    () => (mode === "preset" ? preset : customCommand),
    [mode, preset, customCommand]
  );

  const [result, setResult] = useState<SSHResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidIPv4 = (s: string) =>
    /^\s*(\d{1,3}\.){3}\d{1,3}\s*$/.test(s.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!ip.trim() || !isValidIPv4(ip)) {
      setError("Please enter a valid IPv4 address (e.g., 203.0.113.42).");
      return;
    }
    if (!commandToRun.trim()) {
      setError("Please provide a command to run.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: ip.trim(),
          user: user.trim() || "root",
          command: commandToRun,
        }),
      });

      const data = (await res.json()) as SSHResponse;
      if (!res.ok) {
        throw new Error(data?.error || JSON.stringify(data));
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
      <h2>SSH Command Runner</h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "0.9rem",
          background: "#fafafa",
          padding: "1rem",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          Droplet IP Address
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="203.0.113.42"
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
            disabled={loading}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Username
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="root"
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
            disabled={loading}
          />
        </label>

        {/* Command selector */}
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="cmdmode"
                checked={mode === "preset"}
                onChange={() => setMode("preset")}
                disabled={loading}
              />
              Preset command
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="cmdmode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
                disabled={loading}
              />
              Custom
            </label>
          </div>

          {mode === "preset" ? (
            <label style={{ display: "grid", gap: 6 }}>
              Choose a preset
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
                disabled={loading}
              >
                {PRESET_COMMANDS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} — {c.value}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={{ display: "grid", gap: 6 }}>
              Custom command
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="e.g. uname -a"
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db" }}
                disabled={loading}
              />
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            position: "relative",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: loading ? "#e5e7eb" : "#f3f4f6",
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "fit-content",
          }}
          aria-busy={loading}
          aria-live="polite"
        >
          {loading && (
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                border: "2px solid #6b7280",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
          {loading ? "Running SSH…" : "Run SSH Command"}
        </button>

        {/* Inline spinner CSS (scoped) */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </form>

      {error && (
        <pre
          role="alert"
          style={{
            marginTop: 16,
            background: "#fee",
            color: "#991b1b",
            padding: 12,
            borderRadius: 6,
            whiteSpace: "pre-wrap",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </pre>
      )}

      {result && (
        <div style={{ marginTop: 16, background: "#f6f8fa", padding: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}>
          <p style={{ marginTop: 0 }}>
            <strong>Exit code:</strong> {result.code ?? "unknown"}
          </p>

          <details open>
            <summary><strong>STDOUT</strong></summary>
            <pre style={{ background: "#fff", padding: 10, borderRadius: 6, overflowX: "auto" }}>
              {result.stdout || "(empty)"}
            </pre>
          </details>

          {!!result.stderr && (
            <details>
              <summary><strong>STDERR</strong></summary>
              <pre style={{ background: "#fff", padding: 10, borderRadius: 6, overflowX: "auto", color: "#b91c1c" }}>
                {result.stderr}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
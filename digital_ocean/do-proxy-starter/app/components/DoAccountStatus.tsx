// components/DoAccountStatus.tsx
"use client";

import React from "react";

export default function DoAccountStatus() {
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      // Calls your server proxy: BASE(https://api.digitalocean.com/v2) + /account
      const res = await fetch("/api/proxy?path=/account", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
      }
      // DO response shape: { account: { status: "active" | "locked" | ... } }
      const acctStatus = data?.account?.status ?? "(unknown)";
      setStatus(acctStatus);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <button
        onClick={fetchStatus}
        disabled={loading}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: loading ? "#eee" : "#f7f7f7",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Fetching…" : "Get DigitalOcean Account Status"}
      </button>

      {status && (
        <div style={{ padding: 12, background: "#f6f8fa", borderRadius: 8 }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      {error && (
        <pre style={{ padding: 12, background: "#fee", borderRadius: 8, whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}
    </div>
  );
}
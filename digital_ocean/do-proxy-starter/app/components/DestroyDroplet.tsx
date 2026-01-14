"use client";
import * as React from "react";

function Spinner({ size = 16 }: { size?: number }) {
  const s = size, c = s / 2, r = c - 2, len = Math.PI * r;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} role="status" aria-label="Loading"
         style={{ verticalAlign: "middle", marginRight: 8 }}>
      <circle cx={c} cy={c} r={r} stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
      <path d={`M ${c} ${c} m 0 -${r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 -${2 * r}`}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"
            strokeDasharray={Math.PI * r} strokeDashoffset={(Math.PI * r) / 2}>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${c} ${c}`}
                          to={`360 ${c} ${c}`} dur="0.9s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

export default function DestroyDroplet({
  selectedId = null,
  onDestroyed,
}: {
  selectedId?: number | null;
  onDestroyed?: (id: number) => void;
}) {
  const [dropletId, setDropletId] = React.useState<string>(selectedId ? String(selectedId) : "");
  const [confirmName, setConfirmName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);
  const [lastStatus, setLastStatus] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (selectedId) setDropletId(String(selectedId));
  }, [selectedId]);

  const canSubmit = dropletId.trim() !== "" && confirmName.trim().toLowerCase() === "destroy";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("DestroyDroplet onSubmit onSubmit:");
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLastStatus(null);

    try {
      const id = dropletId.trim();
      const res = await fetch(`/api/proxy/droplets/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      setLastStatus(res.status);
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        setError(typeof body === "string" ? body : JSON.stringify(body, null, 2));
        return;
      }

      setResult(
        body && typeof body === "object" ? body : { message: "Droplet destroy requested.", dropletId: id }
      );
      if (onDestroyed) onDestroyed(Number(id));
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Destroy Droplet</h3>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 8 }}>
        <label>
          Droplet ID
          <input
            value={dropletId}
            onChange={(e) => setDropletId(e.target.value)}
            placeholder="e.g., 123456789"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          Type <code>destroy</code> to confirm
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="destroy"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: loading ? "#eee" : "#f7f7f7",
            color: "#b00020",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {loading && <Spinner size={16} />}
          {loading ? "Destroying…" : "Destroy Droplet"}
        </button>
      </form>

      {(error || result) && (
        <div style={{ marginTop: 10 }}>
          {lastStatus !== null && <p style={{ color: "#555" }}>HTTP status: {lastStatus}</p>}
          {error && <pre style={{ background: "#fee", padding: 12, whiteSpace: "pre-wrap" }}>{error}</pre>}
          {result && <pre style={{ background: "#f6f8fa", padding: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}
"use client";
import React from "react";

type Resp = any;

function Spinner({ size = 16 }: { size?: number }) {
  const s = size;
  const c = s / 2;
  const r = c - 2;
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      role="status"
      aria-label="Loading"
      style={{ verticalAlign: "middle", marginRight: 8 }}
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.25"
      />
      <path
        d={`M ${c} ${c} m 0 -${r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 -${2 * r}`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={Math.PI * r}
        strokeDashoffset={(Math.PI * r) / 2}
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${c} ${c}`}
          to={`360 ${c} ${c}`}
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function extractPublicIPv4(networks?: any): string | null {
  try {
    const v4 = networks?.v4 ?? [];
    const pub = v4.find(
      (n: any) => (n?.type || "").toLowerCase() === "public" && n?.ip_address
    );
    return pub?.ip_address ?? null;
  } catch {
    return null;
  }
}

export default function DropletSpinner() {
  const [name, setName] = React.useState("ubuntu-s-2vpcu-4gb-sfo3-01");
  const [region, setRegion] = React.useState("sfo3");
  const [size, setSize] = React.useState("s-1vcpu-1gb-amd");
  const [image, setImage] = React.useState("ubuntu-22-04-x64");
  const [sshKeys, setSshKeys] = React.useState("51595224");
  const [tags, setTags] = React.useState("spinner");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [result, setResult] = React.useState<Resp | null>(null);
  const [dropletId, setDropletId] = React.useState<number | null>(null);
  const [publicIPv4, setPublicIPv4] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const [pollInfo, setPollInfo] = React.useState<string>("");

  // NEW: show spinner/message when API isn't ready yet
  const [apiNotReady, setApiNotReady] = React.useState(false);
  const [lastStatus, setLastStatus] = React.useState<number | null>(null);

  const pollAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      if (pollAbortRef.current) pollAbortRef.current.abort();
    };
  }, []);

  async function pollUntilIPv4(did: number) {
    if (pollAbortRef.current) pollAbortRef.current.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setPolling(true);
    setApiNotReady(false);
    setLastStatus(null);
    setPollInfo("Waiting for public IPv4…");

    const maxAttempts = 20;
    let delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (controller.signal.aborted) break;

      try {
        setPollInfo(`Checking droplet status (attempt ${attempt}/${maxAttempts})…`);
        const res = await fetch(`/api/proxy/droplets/${did}`, {
          method: "GET",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          cache: "no-store",
        });

        const ct = res.headers.get("content-type") || "";
        let data: any;
        if (ct.includes("application/json")) {
          data = await res.json();
        } else {
          const html = await res.text();
          setPolling(false);
          setApiNotReady(false);
          setLastStatus(res.status);
          setError(
            `Non-JSON response (status ${res.status}). Possible route mismatch.\n` +
              html.slice(0, 200)
          );
          return;
        }

        if (res.status === 404 || res.status === 410) {
          setPolling(false);
          setApiNotReady(false);
          setLastStatus(res.status);
          setError(`Droplet ${did} not found (${res.status}). Stopping.`);
          return;
        }

        if (!res.ok) {
          // API not ready → show spinner
          setApiNotReady(true);
          setLastStatus(res.status);
          setPollInfo(`API not ready (HTTP ${res.status}). Retrying…`);
        } else {
          setApiNotReady(false);
          setLastStatus(null);

          const droplet = data?.droplet ?? data?.droplets?.[0] ?? data;
          const networks = droplet?.networks;
          const status = (droplet?.status || "").toLowerCase();
          const ip = extractPublicIPv4(networks);

          setResult({ droplet });

          if (ip) {
            setPublicIPv4(ip);
            setPollInfo(`Public IPv4 acquired: ${ip}`);
            setPolling(false);
            return;
          }

          setPollInfo(
            `Status: ${status || "provisioning"} — waiting for public IPv4 (attempt ${attempt})…`
          );
        }
      } catch (err: any) {
        if (controller.signal.aborted) break;
        setApiNotReady(true);
        setLastStatus(null);
        setPollInfo(`Network error: ${err?.message ?? String(err)} — retrying…`);
      }

      await new Promise((r) => setTimeout(r, Math.min(delayMs, 10_000)));
      delayMs = Math.min(delayMs + 1000, 10_000);
    }

    setPolling(false);
    setApiNotReady(false);
    if (!publicIPv4) {
      setError(
        "Timed out waiting for a public IPv4. The droplet may still be provisioning; check the DO dashboard or try again."
      );
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setPublicIPv4(null);
    setDropletId(null);
    setPollInfo("");
    setApiNotReady(false);
    setLastStatus(null);

    try {
      const ssh_keys =
        sshKeys.trim() === "" ? [] : sshKeys.split(",").map((s) => s.trim()).filter(Boolean);

      const payload = {
        name,
        region,
        size,
        image,
        ssh_keys,
        backups: false,
        ipv6: false,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };

      const res = await fetch("/api/proxy/droplets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      let data: any;
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const html = await res.text();
        throw new Error(`Non-JSON response (status ${res.status}).\n${html.slice(0, 200)}`);
      }

      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
      }

      const droplet = data?.droplet ?? data;
      const id = droplet?.id;
      if (!id) throw new Error("Create succeeded but response is missing droplet.id");

      setResult(data);
      setDropletId(id);

      const immediateIP = extractPublicIPv4(droplet?.networks);
      if (immediateIP) {
        setPublicIPv4(immediateIP);
      } else {
        await pollUntilIPv4(id);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const networks = result?.droplet?.networks;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2>Create Droplet Poll for IP (via server proxy)</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Region
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="sfo3" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Size (GPU or CPU)
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g., g-2vcpu-8gb or s-1vcpu-1gb" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Image
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="ubuntu-22-04-x64" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          SSH Keys (IDs or fingerprints, comma-separated)
          <input value={sshKeys} onChange={(e) => setSshKeys(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Tags (comma-separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gpu,lab" style={{ width: "100%", padding: 8 }} />
        </label>

        <button
          type="submit"
          disabled={loading || polling}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", background: (loading || polling) ? "#eee" : "#f7f7f7", display: "inline-flex", alignItems: "center" }}
        >
          {(loading || polling) && <Spinner size={16} />}
          {loading ? "Creating…" : polling ? "Waiting for IPv4…" : "Droplet Spinner"}
        </button>
      </form>

      {(error || pollInfo || publicIPv4 || apiNotReady) && (
        <div style={{ marginTop: 12 }} aria-live="polite">
          {apiNotReady && (
            <p style={{ color: "#555", display: "flex", alignItems: "center" }}>
              <Spinner size={16} />
              <span>
                API not ready{lastStatus ? ` (HTTP ${lastStatus})` : ""}. Retrying…
              </span>
            </p>
          )}

          {!apiNotReady && pollInfo && <p style={{ color: "#555" }}>{pollInfo}</p>}

          {publicIPv4 && (
            <p>
              <strong>Public IPv4:</strong>{" "}
              <code>{publicIPv4}</code>
              <span style={{ marginLeft: 8 }}>
                Try: <code>ssh -o IdentitiesOnly=yes root@{publicIPv4}</code>
              </span>
            </p>
          )}

          {error && (
            <pre style={{ background: "#fee", padding: 12, whiteSpace: "pre-wrap" }}>
              {error}
            </pre>
          )}
        </div>
      )}

      {result && (
        <div style={{ background: "#f6f8fa", padding: 12, marginTop: 12 }}>
          <h3>Result</h3>
          {dropletId && <p><strong>Droplet ID:</strong> {dropletId}</p>}
          {networks && (
            <>
              <p><strong>Networks:</strong></p>
              <pre style={{ overflow: "auto" }}>{JSON.stringify(networks, null, 2)}</pre>
            </>
          )}
          <details>
            <summary>Full response</summary>
            <pre style={{ overflow: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
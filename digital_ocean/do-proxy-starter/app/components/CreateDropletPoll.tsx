"use client";
import React from "react";

type Resp = any;

function extractPublicIPv4(networks?: any): string | null {
  try {
    const v4 = networks?.v4 ?? [];
    const pub = v4.find((n: any) => (n?.type || "").toLowerCase() === "public" && n?.ip_address);
    console.log("CreateDropletPoll extractPublicIPv4 pub, :", pub);
    return pub?.ip_address ?? null;
  } catch {
    return null;
  }
}

export default function CreateDropletPoll() {
  const [name, setName] = React.useState("ubuntu-s-4vcpu-16gb-amd-sfo3-01");
  const [region, setRegion] = React.useState("sfo3");
  const [size, setSize] = React.useState("s-4vcpu-16gb-amd");
  const [image, setImage] = React.useState("ubuntu-22-04-x64");
  const [sshKeys, setSshKeys] = React.useState("51595224");
  const [tags, setTags] = React.useState("CreateDropletPoll");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [result, setResult] = React.useState<Resp | null>(null);
  const [dropletId, setDropletId] = React.useState<number | null>(null);
  const [publicIPv4, setPublicIPv4] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const [pollInfo, setPollInfo] = React.useState<string>("");

  const pollAbortRef = React.useRef<AbortController | null>(null);

  // Cleanup polling if component unmounts
  React.useEffect(() => {
    return () => {
      if (pollAbortRef.current) {
        pollAbortRef.current.abort();
      }
    };
  }, []);

  async function pollUntilIPv4(did: number) {
    // Cancel any previous poll
    console.log("CreateDropletPoll pollUntilIPv4 did:", did);
    if (pollAbortRef.current) pollAbortRef.current.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setPolling(true);
    setPollInfo("Waiting for public IPv4…");

    // Exponential backoff: 1s → 2s → 3s … up to 10s between polls (bounded)
    const maxAttempts = 20; // ~ a few minutes total
    let delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (controller.signal.aborted){
        console.log("CreateDropletPoll controller.signal.aborted");
        break;
      } 

      try {
        console.log("CreateDropletPoll checking droplet status (attempt ${attempt}/${maxAttempts})…");
        console.log("CreateDropletPoll did:", did);
        setPollInfo(`Checking droplet status (attempt ${attempt}/${maxAttempts})…`);
        const res = await fetch(`/api/proxy/droplets/${did}`, {
          method: "GET",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });

        const text = await res.text();
        console.log("CreateDropletPoll text:", text);
        let data: any;
        try {
          data = JSON.parse(text);
          console.log("CreateDropletPoll data:", data);
        } catch {
          data = text;
        }

        if (!res.ok) {
          // Non-fatal: continue polling unless it's clearly unrecoverable
          setPollInfo(`API not ready (HTTP ${res.status}). Retrying…`);
        } else {
          // Update UI with the latest droplet object
          console.log("CreateDropletPoll data:", data);
          const droplet = data?.droplet ?? data?.droplets?.[0] ?? data;
          const networks = droplet?.networks;
          const status = (droplet?.status || "").toLowerCase();
          const ip = extractPublicIPv4(networks);

          // Surface the latest payload
          setResult({ droplet });
          if (ip) {
            setPublicIPv4(ip);
            setPollInfo(`Public IPv4 acquired: ${ip}`); 
            setPolling(false);
            return;
          }

          // If active but still no IP, keep polling (DO may lag on networking)
          setPollInfo(
            `Status: ${status || "provisioning"} — waiting for public IPv4 (attempt ${attempt})…`
          );
        }
      } catch (err: any) {
        if (controller.signal.aborted) break;
        setPollInfo(`Network error: ${err?.message ?? String(err)} — retrying…`);
      }

      // Wait before next attempt (bounded backoff)
      await new Promise((r) => setTimeout(r, Math.min(delayMs, 10_000)));
      delayMs = Math.min(delayMs + 1000, 10_000);
    }

    setPolling(false);
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

    try {
      const ssh_keys =
        sshKeys.trim() === ""
          ? []
          : sshKeys.split(",").map((s) => s.trim()).filter(Boolean);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
      }

      const droplet = data?.droplet ?? data;
      const id = droplet?.id;
      console.log("CreateDropletPoll id:", id);
      if (!id) {
        throw new Error("Create succeeded but response is missing droplet.id");
      }

      setResult(data);
      setDropletId(id);

      // If we already have an IP, great; otherwise poll for it.
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
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g., s-4vcpu-16gb-amd" style={{ width: "100%", padding: 8 }} />
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
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", background: (loading || polling) ? "#eee" : "#f7f7f7" }}
        >
          {loading ? "Creating…" : polling ? "Waiting for IPv4…" : "Create Droplet Poll"}
        </button>
      </form>

      {(error || pollInfo || publicIPv4) && (
        <div style={{ marginTop: 12 }}>
          {pollInfo && <p style={{ color: "#555" }}>{pollInfo}</p>}
          {publicIPv4 && (
            <p>
              <strong>Public IPv4:</strong>{" "}
              <code>{publicIPv4}</code>
              {"  "}
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
"use client";
import React from "react";

type Resp = any;

export default function CreateDroplet() {
  const [name, setName] = React.useState("ubuntu-s-2vpcu-4gb-sfo3-01");
  // Choose a GPU-capable region and size your account supports
  const [region, setRegion] = React.useState("sfo3"); // example; ensure GPU availability on your account
  const [size, setSize] = React.useState("s-1vcpu-1gb-amd"); 
  const [image, setImage] = React.useState("ubuntu-22-04-x64");
  const [sshKeys, setSshKeys] = React.useState("51595224");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Resp | null>(null);
  const [tags, setTags] = React.useState("CreateDroplet");
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const ssh_keys =
        sshKeys.trim() === ""
          ? []
          : sshKeys.split(",").map((s) => s.trim()).filter(Boolean);

      const payload = {
        name,
        region,          // e.g., "nyc3", "sfo3" (ensure GPU availability for your account)
        size,            // e.g., "g-2vcpu-8gb", "g-4vcpu-16gb" (example GPU slugs)
        image,           // e.g., "ubuntu-22-04-x64"
        ssh_keys,        // array of IDs or fingerprints
        backups: false,
        ipv6: false,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
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
        console.log("id:", data.droplet.id);
      } 
      catch { 
        data = text; 
      }

      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
      }
      console.log("create droplet data:", data);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const dropletId = result?.droplet?.id;
  const networks = result?.droplet?.networks;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2>Create Droplet (Component CreateDroplet via server proxy)</h2>
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
          Size (GPU)
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g., g-2vcpu-8gb" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Image
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="ubuntu-22-04-x64" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          SSH Keys (IDs or fingerprints, comma-separated)
          <input value={sshKeys} onChange={(e) => setSshKeys(e.target.value)} placeholder="" style={{ width: "100%", padding: 8 }} />
        </label>
        <label>
          Tags (comma-separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gpu,lab" style={{ width: "100%", padding: 8 }} />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", background: loading ? "#eee" : "#f7f7f7" }}
        >
          {loading ? "Creating…" : "Create Droplet"}
        </button>
      </form>

      {error && (
        <pre style={{ background: "#fee", padding: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
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
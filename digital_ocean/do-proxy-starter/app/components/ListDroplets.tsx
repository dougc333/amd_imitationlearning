"use client";

import React from "react";

type Droplet = {
  id: number;
  name: string;
  status: string;
  networks?: {
    v4?: { ip_address: string; type: string }[];
  };
};

export default function ListDroplets({
  onSelect,
}: {
  onSelect?: (id: number | null) => void;
}) {
  const [droplets, setDroplets] = React.useState<Droplet[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function loadDroplets() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/proxy/droplets", { cache: "no-store" });
      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : JSON.stringify(data));
      }

      const list: Droplet[] =
        data?.droplets ??
        (Array.isArray(data) ? data : []);

      setDroplets(list);
      setSelectedId(null);
      if (onSelect) onSelect(null);
    } catch (err: any) {
      setError(err.message || "Failed to load droplets");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDroplets();
  }, []);

  function handleSelect(id: number) {
    setSelectedId(id);
    if (onSelect) onSelect(id);
  }

  async function handleDestroy() {
    if (selectedId == null) {
      alert("Please select a droplet to destroy.");
      return;
    }

    const sure = window.confirm(
      `Are you sure you want to destroy droplet ID ${selectedId}? This cannot be undone.`
    );
    if (!sure) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/proxy/droplets/${encodeURIComponent(String(selectedId))}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
      }

      // Remove destroyed droplet from local list
      setDroplets((prev) => prev.filter((d) => d.id !== selectedId));
      setSelectedId(null);
      if (onSelect) onSelect(null);
    } catch (err: any) {
      setError(err.message || "Failed to destroy droplet");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ padding: 16, background: "#fafafa", borderRadius: 8 }}>
      <h3>Available Droplets</h3>

      {loading && <p>Loading droplets…</p>}
      {error && <p style={{ color: "red", whiteSpace: "pre-wrap" }}>{error}</p>}

      {!loading && droplets.length === 0 && !error && (
        <p>No droplets found.</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
        {droplets.map((d) => {
          const ip =
            d.networks?.v4?.find((n) => n.type === "public")?.ip_address ||
            "—";

          return (
            <li
              key={d.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #ddd",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                type="radio"
                name="selectedDroplet"
                checked={selectedId === d.id}
                onChange={() => handleSelect(d.id)}
              />
              <div>
                <strong>{d.name}</strong> (ID: {d.id})
                <br />
                Status: <code>{d.status}</code>
                <br />
                IPv4: <code>{ip}</code>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={loadDroplets}
          disabled={loading || deleting}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#f7f7f7",
          }}
        >
          {loading ? "Reloading…" : "Reload Droplets"}
        </button>

        <button
          onClick={handleDestroy}
          disabled={selectedId == null || deleting}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #c00",
            background: selectedId == null || deleting ? "#f8d0d0" : "#ffd6d6",
            color: "#600",
          }}
        >
          {deleting ? "Destroying…" : "Destroy Selected Droplet"}
        </button>
      </div>
    </div>
  );
}
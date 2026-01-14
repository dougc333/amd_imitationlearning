"use client";
import * as React from "react";
import ListDroplets from "../components/ListDroplets";
import DestroyDroplet from "../components/DestroyDroplet";

export default function ManageDropletsPage() {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16, display: "grid", gap: 20 }}>
      <h2>Manage Droplets</h2>

      <ListDroplets
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        refreshKey={refreshKey}
      />

      <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
        <DestroyDroplet
          selectedId={selectedId}
          onDestroyed={() => {
            // Clear selection and refresh the list
            setSelectedId(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      </div>
    </div>
  );
}
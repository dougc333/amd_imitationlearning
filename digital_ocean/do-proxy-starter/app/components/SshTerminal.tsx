// components/SshTerminal.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";

type SshTerminalProps = {
  host?: string;
  username?: string;
  onVllmVerified?: () => void; // Added callback
};

export default function SshTerminal(
  { host: initialHost = "", username: initialUsername = "amd", onVllmVerified }: SshTerminalProps = {}
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [host, setHost] = useState(initialHost);
  const [username, setUsername] = useState(initialUsername);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [connecting, setConnecting] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const [buffer, setBuffer] = useState("");
  const [vllmVerified, setVllmVerified] = useState(false);
  //const [vllmVersion, setVllmVersion] = useState<string | null>(null);

  const stripAnsi = (s: string) =>
    s.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");

  // Inspect incoming SSH output for the vLLM success marker
  const handleIncoming = (chunk: string) => {
    const plain = stripAnsi(chunk);

    setBuffer((prev) => {
      const next = (prev + plain).slice(-8000); // keep some history
      // Match: Success! vLLM version: 0.1.dev11222+g52eadcec9
      const m = next.match(/Success!/);
      if (m) {
        console.log("vLLM found:", m);
        console.log(">>> SUCCESS DETECTED <<<");
        setVllmVerified(true);
        if (onVllmVerified) onVllmVerified(); // Trigger parent action
        //setVllmVersion(m[1]);
      }
      return next;
    });
  };




  // lazy load xterm in browser only
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("xterm"),
        import("xterm-addon-fit"),
      ]);
      // @ts-ignore
      await import("xterm/css/xterm.css");

      if (cancelled || !containerRef.current) return;

      const term = new Terminal({
        fontSize: 14,
        convertEol: true,
        cursorBlink: true,
        theme: { background: "#0b1220", foreground: "#e6edf3" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      termRef.current = term;
      fitRef.current = fit;

      term.open(containerRef.current);
      fit.fit();
      term.writeln("\x1b[36mTerminal ready. Enter IP and Connect.\x1b[0m");

      const onResize = () => {
        try {
          fit.fit();
          const id = sessionIdRef.current;
          if (id) {
            fetch(`/api/ssh/session/${id}/resize`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cols: term.cols, rows: term.rows }),
            }).catch(() => {});
          }
        } catch {}
      };

      window.addEventListener("resize", onResize);
      (term as any)._onResize = onResize;
    })();

    return () => {
      cancelled = true;

      try {
        const term = termRef.current;
        if (term && (term as any)._onResize) {
          window.removeEventListener("resize", (term as any)._onResize);
        }
        // Dispose xterm instance
        termRef.current?.dispose?.();
      } catch {}

      // Clear refs
      termRef.current = null;
      fitRef.current = null;

      // Clear DOM container so we don't get stacked terminals
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      // Close EventSource
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      // Best-effort delete SSH session
      const id = sessionIdRef.current;
      if (id) {
        fetch(`/api/ssh/session/${id}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  // rebind keyboard input whenever sessionId changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (!termRef.current) return;
    const term = termRef.current;

    let buf = "";
    let t: any = null;
    const flush = () => {
      const id = sessionIdRef.current;
      if (!id || !buf) return;
      const chunk = buf;
      buf = "";
      fetch(`/api/ssh/session/${id}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: chunk }),
        keepalive: true,
      }).catch(() => {});
    };

    const disp = term.onData((d: string) => {
      // normalize Enter -> CR
      const normalized = d.replace(/\r?\n/g, "\r");
      buf += normalized;
      if (!t) t = setTimeout(() => { t = null; flush(); }, 12);
    });

    return () => {
      try {
        disp.dispose();
      } catch {}
      if (t) clearTimeout(t);
      flush();
    };
  }, [sessionId]);

  async function connect() {
    if (!termRef.current) return;
    if (!/^\s*(\d{1,3}\.){3}\d{1,3}\s*$/.test(host)) {
      setStatus("Invalid IPv4 address");
      return;
    }
    setConnecting(true);
    setStatus("Connecting…");

    const cols = termRef.current.cols ?? 120;
    const rows = termRef.current.rows ?? 32;

    try {
      const r = await fetch("/api/ssh/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: host.trim(),
          username: username.trim() || "amd",
          cols,
          rows,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || JSON.stringify(j));

      setSessionId(j.id);

      const es = new EventSource(`/api/ssh/session/${j.id}/events`);
      esRef.current = es;

      es.onmessage = (ev) => {
        const chunk = JSON.parse(ev.data) //as string;
        handleIncoming(chunk);
        termRef.current?.write(chunk); // raw PTY stream, no extra newline
      };

      es.onerror = () => {
        setStatus("Stream error/closed");
        es.close();
      };

      // kick the PTY to show a prompt
      await fetch(`/api/ssh/session/${j.id}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "\r" }),
      });

      setStatus(`Connected to ${host} as ${username}`);
      setConnecting(false);
      termRef.current?.focus();
    } catch (e: any) {
      setStatus(`Error: ${e?.message || String(e)}`);
      setConnecting(false);
    }
  }

  function disconnect() {
    const id = sessionIdRef.current;
    if (!id) return;
    fetch(`/api/ssh/session/${id}`, { method: "DELETE" })
      .finally(() => {
        esRef.current?.close();
        esRef.current = null;
        setSessionId(null);
        setStatus("Disconnected");
      });
  }

  // quick test button to send a command directly
  //this doesnt copy the script over. only runs it. 
  async function runSCP() {
    const id = sessionIdRef.current;
    if (!id) return;
    await fetch(`/api/ssh/session/${id}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "source buildvllm.sh\r" }),
    });
  }


  return (
    <div
      style={{
        maxWidth: 900,
        margin: "2rem auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2>SSH Terminal (xterm)</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          connect();
        }}
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr 1fr auto auto",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <input
          placeholder="Droplet IPv4 (e.g., 203.0.113.42)"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          disabled={!!sessionId || connecting}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
          }}
        />
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={!!sessionId || connecting}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
          }}
        />
        {!sessionId ? (
          <button
            type="submit"
            disabled={connecting}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: connecting ? "#e5e7eb" : "#f3f4f6",
            }}
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fee2e2",
            }}
          >
            Disconnect
          </button>
        )}
        <button
          type="button"
          onClick={runSCP}
          disabled={!sessionId}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#e0f2fe",
          }}
        >
          Run: source buildvllm.sh
        </button>
      </form>
      <div style={{ marginBottom: 6, color: "#64748b" }}>{status}</div>


      <div
        ref={containerRef}
        style={{
          height: 480,
          width: "100%",
          background: "#0b1220",
          borderRadius: 8,
          border: "1px solid #0f172a",
          padding: 6,
        }}
      />
    </div>
  );
}
"use client";
import React from "react";
import SshTerminal from "./SshTerminal";

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

export default function CD2() {
  const [name, setName] = React.useState("ubuntu-s-4vcpu-16gb-amd-sfo3-01");
  const [region, setRegion] = React.useState("sfo3");
  const [size, setSize] = React.useState("s-4vcpu-16gb-amd");
  const [image, setImage] = React.useState("ubuntu-22-04-x64");
  const [sshKeys, setSshKeys] = React.useState("51595224");
  const [tags, setTags] = React.useState("components/cd2");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [result, setResult] = React.useState<Resp | null>(null);
  const [dropletId, setDropletId] = React.useState<number | null>(null);
  const [publicIPv4, setPublicIPv4] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const [pollInfo, setPollInfo] = React.useState<string>("");

  const [setupStatus, setSetupStatus] = React.useState<string>("");
  const [setupSuccess, setSetupSuccess] = React.useState(false); // Tracks if setup-amd succeeded

  //const [buildStatus, setBuildStatus] = React.useState<string>(""); // Tracks build-vllm status
  const [scpStatus, setSCPStatus] = React.useState<string>(""); // Tracks scp-vllm status
  const [scpSuccess, setSCPSuccess] = React.useState(false); // Tracks if scp-vllm succeeded
  const [scpError, setSCPError] = React.useState<string | null>(null); // Tracks if scp-vllm failed
  
  const pollAbortRef = React.useRef<AbortController | null>(null);



  const [vllmVerified, setVllmVerified] = React.useState(false);
  const [scpVllmChatStatus, setScpVllmChatStatus] = React.useState<string>("not started");


  React.useEffect(() => {
    return () => {
      if (pollAbortRef.current) {
        pollAbortRef.current.abort();
      }
    };
  }, []);

  async function pollUntilIPv4(did: number) {
    console.log("CreateDropletPoll pollUntilIPv4 did:", did);
    if (pollAbortRef.current) pollAbortRef.current.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setPolling(true);
    setPollInfo("Waiting for public IPv4…");

    const maxAttempts = 20;
    let delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (controller.signal.aborted) {
        console.log("CreateDropletPoll controller.signal.aborted");
        break;
      }

      try {
        console.log(
          `CreateDropletPoll checking droplet status (attempt ${attempt}/${maxAttempts})…`
        );
        setPollInfo(`Checking droplet status (attempt ${attempt}/${maxAttempts})…`);

        const res = await fetch(`/api/proxy/droplets/${did}`, {
          method: "GET",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });

        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        if (!res.ok) {
          setPollInfo(`API not ready (HTTP ${res.status}). Retrying…`);
        } else {
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
        setPollInfo(`Network error: ${err?.message ?? String(err)} — retrying…`);
      }

      await new Promise((r) => setTimeout(r, Math.min(delayMs, 10_000)));
      delayMs = Math.min(delayMs + 1000, 10_000);
    }

    setPolling(false);
    if (!publicIPv4) {
      setError(
        "Timed out waiting for a public IPv4. The droplet may still be provisioning; check the DO dashboard or try again."
      );
    }else{
      setPollInfo("Public IPv4 acquired: " + publicIPv4+"polling:{}");
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
    setSetupStatus("");
    setSetupSuccess(false);
    //setBuildStatus("");

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
        throw new Error(
          typeof data === "string" ? data : JSON.stringify(data, null, 2)
        );
      }

      const droplet = data?.droplet ?? data;
      const id = droplet?.id;
      if (!id) {
        throw new Error("Create succeeded but response is missing droplet.id");
      }

      setResult(data);
      setDropletId(id);

      const immediateIP = extractPublicIPv4(droplet?.networks);
      if (immediateIP) {
        setPublicIPv4(immediateIP);
        setPollInfo(`Public IPv4 acquired: ${immediateIP}`);
      } else {
        await pollUntilIPv4(id);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };


  const runSCPScript = async () => {
    if (!publicIPv4) return;
    setSCPSuccess(false);
    try {
      console.log("runSCPScript publicIPv4:", publicIPv4);
      setSCPStatus("Running SCP script…");
      const res = await fetch("/api/ssh/scp-vllm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: publicIPv4 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSCPStatus(
          `SCP failed (HTTP ${res.status}): ${
            data.error || JSON.stringify(data)
          }`
        );
      } else {
        console.log("setting SCP status:SCP OK: data.stdout:", data.stdout);
        setSCPStatus(
          `SCP OK (exitCode=${data.exitCode ?? "?"}). stdout:\n${data.stdout ?? ""}`
        );
        setSCPSuccess(true);
        setSCPError(null);
      }
    }catch(err: any) {
      setSCPStatus(`SCP error: ${err?.message || String(err)}`);
    }
  }
  
  const runSetupScript = async () => {
    if (!publicIPv4) return;
    setSetupSuccess(false);
    try {
      setSetupStatus("Running add user AMD script…");
      const res = await fetch("/api/ssh/setup-amd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: publicIPv4 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupStatus(
          `Setup failed (HTTP ${res.status}): ${
            data.error || JSON.stringify(data)
          }`
        );
      } else {
        setSetupStatus(
          `Create user AMD OK (exitCode=${data.exitCode ?? "?"}). stdout:\n${data.stdout ?? ""}`
        );
        // Only mark success if exitCode is 0
        if (data.exitCode === 0) {
          setSetupSuccess(true);
        }
      }
    } catch (err: any) {
      setSetupStatus(`Setup error: ${err?.message || String(err)}`);
    }
  };


  const runScpVllmChat = async () => {
    if (!publicIPv4) {
      setScpVllmChatStatus("Missing droplet IP, cannot scp vllm_chat.");
      return;
    }
  
    setScpVllmChatStatus("Running scp vllm_chat…");
    try {
      const res = await fetch("/api/ssh/scp_vllm_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: publicIPv4 }),
      });
  
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScpVllmChatStatus(
          `scp_vllm_chat failed (HTTP ${res.status}): ${
            data.error || JSON.stringify(data)
          }`
        );
      } else {
        setScpVllmChatStatus(
          `scp_vllm_chat OK.\n` +
          `scp exitCode=${data.scp?.exitCode ?? "?"}\n` +
          (data.install
            ? `install exitCode=${data.install.exitCode ?? "?"}\n\n${data.install.stdout ?? ""}`
            : `${data.scp?.stdout ?? ""}`)
        );
      }
    } catch (err: any) {
      setScpVllmChatStatus(
        `scp_vllm_chat error: ${err?.message || String(err)}`
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded shadow border">
        <h2 className="text-xl font-bold mb-4">Create Droplet & Setup vLLM</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Name</span>
            <input
              className="mt-1 block w-full border rounded px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Region</span>
            <input
              className="mt-1 block w-full border rounded px-2 py-1"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Size</span>
            <input
              className="mt-1 block w-full border rounded px-2 py-1"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Image</span>
            <input
              className="mt-1 block w-full border rounded px-2 py-1"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </label>
          <div className="md:col-span-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                SSH Key IDs (comma sep)
              </span>
              <input
                className="mt-1 block w-full border rounded px-2 py-1"
                value={sshKeys}
                onChange={(e) => setSshKeys(e.target.value)}
              />
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Droplet"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
            {error}
          </div>
        )}

        {(polling || pollInfo) && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded border border-blue-200 text-sm">
            {pollInfo}
          </div>
        )}
      </div>

      {publicIPv4 && (
        <div className="bg-white p-6 rounded shadow border space-y-4">
          <h3 className="text-lg font-bold">Droplet Actions</h3>
          <p className="text-sm text-gray-600">
            Droplet Created. IP: <span className="font-mono font-bold text-black">{publicIPv4}</span>
          </p>
          
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">1. System Setup (User & Base Libs)</h4>
            <div className="flex gap-2 items-center">
               <button
                onClick={runSetupScript}
                className="bg-indigo-600 text-white py-1 px-4 rounded text-sm hover:bg-indigo-700"
              >
                Run Setup (setup-amd)
              </button>
            </div>
            {setupStatus && (
              <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto max-h-40 rounded">
                {setupStatus}
              </pre>
            )}
          </div>

          {setupSuccess && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">2. Build vLLM</h4>
              <p className="text-xs text-gray-500 mb-2">
                SSH connection verified. Click below to install vLLM dependencies and build.
              </p>
              <button
                onClick={runSCPScript}
                className="bg-emerald-600 text-white py-1 px-4 rounded text-sm hover:bg-emerald-700"
              >
                Run Scp 
              </button>
              {scpStatus && (
                <pre className="mt-2 p-2 bg-gray-900 text-green-400 text-xs overflow-auto max-h-64 rounded">
                  {scpStatus}
                </pre>
              )}
            </div>
          )}
          {scpSuccess && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">3. Build vLLM</h4>
              <p className="text-xs text-gray-500 mb-2">
                SSH connection verified. Click below to install vLLM dependencies and build.
              </p>

            <SshTerminal 
                host={publicIPv4} 
                username="amd" 
                onVllmVerified={() => setVllmVerified(true)    } />
            </div>
          )}
          {
            vllmVerified && (
              <div className="border-t pt-4">
              <h2 className="text-lg font-bold mb-2">4. scp vllm_chat</h2>
              <button
                onClick={runScpVllmChat}
                className="bg-purple-600 text-white py-1 px-4 rounded text-sm hover:bg-purple-700"
              >
                SCP vllm_chat → /home/amd
              </button>
              {scpVllmChatStatus && (
                <pre className="mt-2 p-2 bg-gray-900 text-green-400 text-xs overflow-auto max-h-64 rounded">
                  {scpVllmChatStatus}
                </pre>
              )}
              </div>
          
          )}
        </div>
      )}

      {result && (
        <div className="bg-gray-50 p-4 rounded border text-xs overflow-auto max-h-60">
          <h4 className="font-bold mb-2">Create API Response:</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
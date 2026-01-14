// lib/sshSessions.ts
import { Client } from "ssh2";
import { randomUUID } from "crypto";

type Sub = { write: (chunk: string) => void; close: () => void };

export type SshSession = {
  id: string;
  conn: Client;
  stream: any | null;
  subs: Set<Sub>;
  alive: boolean;
};

class Store {
  private map = new Map<string, SshSession>();

  create() {
    const id = randomUUID();
    const sess: SshSession = { id, conn: new Client(), stream: null, subs: new Set(), alive: false };
    this.map.set(id, sess);
    return sess;
  }
  get(id: string) { return this.map.get(id) || null; }
  remove(id: string) {
    const s = this.map.get(id);
    if (!s) return;
    try { s.stream?.end(); } catch {}
    try { s.conn?.end(); } catch {}
    for (const sub of s.subs) { try { sub.close(); } catch {} }
    this.map.delete(id);
  }
  addSub(id: string, sub: Sub) { const s = this.map.get(id); if (!s) return false; s.subs.add(sub); return true; }
  removeSub(id: string, sub: Sub) { this.map.get(id)?.subs.delete(sub); }
  broadcast(id: string, data: string) { this.map.get(id)?.subs.forEach(sub => sub.write(data)); }
}

export const sshSessions: Store = (global as any).__sshStore || new Store();
if (!(global as any).__sshStore) (global as any).__sshStore = sshSessions;

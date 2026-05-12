"use client";

export interface AgentInfo {
  name: string;
  description: string;
  provider: string;
  model: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const agentsCache: { entry: CacheEntry<AgentInfo[]> | null } = { entry: null };

export async function fetchAgentsList(): Promise<AgentInfo[]> {
  const now = Date.now();
  if (agentsCache.entry && now - agentsCache.entry.timestamp < CACHE_TTL_MS) {
    return agentsCache.entry.data;
  }
  try {
    const res = await fetch("/api/agents/list");
    if (res.ok) {
      const data = await res.json();
      const agents: AgentInfo[] = Array.isArray(data) ? data : [];
      agentsCache.entry = { data: agents, timestamp: now };
      return agents;
    }
  } catch { /* non-critical */ }
  return agentsCache.entry?.data ?? [];
}

export function invalidateAgentsCache() {
  agentsCache.entry = null;
}

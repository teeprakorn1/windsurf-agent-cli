"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Search, Bot, Cpu, Wrench, BookOpen, X } from "lucide-react";

interface AgentInfo {
  name: string;
  description: string;
  provider: string;
  model: string;
}

interface AgentSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function AgentSelect({ value, onChange }: AgentSelectProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AgentInfo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch("/api/agents/list");
        if (res.ok) {
          const data = await res.json();
          setAgents(Array.isArray(data) ? data : []);
        } else if (res.status === 401 || res.status === 403) {
          setAgents([]);
        }
      } catch { /* non-critical */ }
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (value && agents.length > 0) {
      const idx = agents.findIndex(a => a.name === value);
      setSelected(idx >= 0 ? agents[idx] : null);
      setSelectedIndex(idx >= 0 ? idx + 1 : 0);
    } else {
      setSelected(null);
      setSelectedIndex(0);
    }
  }, [value, agents]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
      setSearch("");
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = search
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase())
      )
    : agents;

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onChange("");
    setSelected(null);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div className="input-field flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between gap-2 text-left cursor-pointer flex-1 min-w-0"
          aria-label="Select agent"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Bot className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            {selected ? (
              <span className="truncate text-sm">{selected.name}</span>
            ) : (
              <span className="text-gray-400 dark:text-zinc-500 text-sm">Default Agent</span>
            )}
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
            aria-label="Clear selection"
          >
            <X className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full dropdown-panel overflow-hidden animate-slide-in" style={{ maxHeight: "360px" }}>
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-zinc-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
                aria-label="Search agents"
                className="w-full pl-8 pr-3 py-2 text-xs bg-transparent outline-none text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Agent list */}
          <ul ref={listRef} className="overflow-y-auto" style={{ maxHeight: "260px" }}>
            {/* Default option */}
            <li>
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors
                  ${!value ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300"}`}
              >
                <Bot className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <span className="font-medium">Default Agent</span>
                <span className="text-gray-400 dark:text-zinc-500 ml-1">(auto-detect)</span>
              </button>
            </li>
            {filtered.map((agent) => (
              <li key={agent.name}>
                <button
                  type="button"
                  onClick={() => handleSelect(agent.name)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors
                    ${value === agent.name ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                >
                  <div className="flex items-center gap-2">
                    <Bot className={`h-3.5 w-3.5 shrink-0 ${value === agent.name ? "text-blue-500" : "text-gray-400 dark:text-zinc-500"}`} />
                    <span className={`font-medium truncate ${value === agent.name ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-zinc-100"}`}>
                      {agent.name}
                    </span>
                    {agent.provider && agent.provider !== "inherit" && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                        {agent.provider}
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="mt-0.5 pl-[22px] text-gray-500 dark:text-zinc-500 line-clamp-1 text-[10px]">
                      {agent.description}
                    </p>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && search && (
              <li className="px-3 py-4 text-xs text-center text-gray-400 dark:text-zinc-500">
                No agents matching &quot;{search}&quot;
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Live Detail Preview */}
      {selected && !open && (
        <div className="mt-2 glass-card p-3 animate-slide-in">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20">
                <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{selected.name}</h3>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500 line-clamp-1">{selected.description}</p>
              </div>
            </div>
            <button onClick={handleClear} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Deselect agent">
              <X className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
              <Cpu className="h-3 w-3 text-cyan-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Provider</p>
                <p className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate">{selected.provider === "inherit" ? "Auto" : selected.provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
              <Wrench className="h-3 w-3 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Model</p>
                <p className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate">{selected.model === "inherit" ? "Auto" : selected.model}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
              <BookOpen className="h-3 w-3 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Agent #</p>
                <p className="text-[10px] font-medium text-gray-700 dark:text-zinc-300">{selectedIndex}/{agents.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

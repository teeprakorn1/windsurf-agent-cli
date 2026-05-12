"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Search, Bot, X } from "lucide-react";
import { fetchAgentsList, type AgentInfo } from "@/lib/agents-cache";

interface AgentSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function AgentSelect({ value, onChange }: AgentSelectProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AgentInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const loadAgents = async () => {
      const data = await fetchAgentsList();
      setAgents(data);
    };
    loadAgents();
    const interval = setInterval(loadAgents, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (value && agents.length > 0) {
      const idx = agents.findIndex(a => a.name === value);
      setSelected(idx >= 0 ? agents[idx] : null);
    } else {
      setSelected(null);
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
              <span className="truncate text-xs">{selected.name}</span>
            ) : (
              <span className="text-gray-400 dark:text-zinc-500 text-xs">Default Agent</span>
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
        <div className="absolute z-[999] mt-1.5 w-full dropdown-panel overflow-hidden animate-slide-in" style={{ maxHeight: "360px" }}>
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
            {filtered.map((agent) => {
              const isSelected = value === agent.name;
              return (
                <li key={agent.name}>
                  <button
                    type="button"
                    onClick={() => handleSelect(agent.name)}
                    className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 transition-colors
                      ${isSelected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                  >
                    <Bot className={`h-4 w-4 shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400 dark:text-zinc-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium truncate ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-zinc-100"}`}>
                          {agent.name}
                        </span>
                        {agent.provider && agent.provider !== "inherit" && (
                          <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                            {agent.provider}
                          </span>
                        )}
                        {isSelected && (
                          <div className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      {agent.description && (
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 line-clamp-1 mt-0.5">
                          {agent.description}
                        </p>
                      )}
                      {(agent.model && agent.model !== "inherit") && (
                        <p className="text-[9px] text-gray-400 dark:text-zinc-600 mt-0.5">
                          {agent.model}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && search && (
              <li className="px-3 py-4 text-xs text-center text-gray-400 dark:text-zinc-500">
                No agents matching &quot;{search}&quot;
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

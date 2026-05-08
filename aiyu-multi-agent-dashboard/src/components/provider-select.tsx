"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Cpu, Zap, Server, TestTube } from "lucide-react";

interface ProviderOption {
  value: string;
  label: string;
  description: string;
  icon: "cpu" | "zap" | "server" | "test";
}

const PROVIDERS: ProviderOption[] = [
  { value: "mock", label: "Test / Mock", description: "No API key required", icon: "test" },
  { value: "openai", label: "OpenAI", description: "GPT-4o, GPT-4, GPT-3.5", icon: "zap" },
  { value: "claude", label: "Claude", description: "Anthropic — Sonnet, Haiku, Opus", icon: "cpu" },
  { value: "local", label: "Ollama", description: "Local / Free — Llama, Mistral", icon: "server" },
];

const ICON_MAP: Record<string, typeof TestTube> = {
  test: TestTube,
  zap: Zap,
  cpu: Cpu,
  server: Server,
};

interface ProviderSelectProps {
  value: string;
  onChange: (value: string) => void;
  availableProviders?: string[];
}

export function ProviderSelect({ value, onChange, availableProviders }: ProviderSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = PROVIDERS.find(p => p.value === value) || PROVIDERS[0];
  const Icon = ICON_MAP[selected.icon];

  const isAvailable = useCallback((provider: string) => {
    if (!availableProviders || availableProviders.length === 0) return true;
    return availableProviders.includes(provider);
  }, [availableProviders]);

  // Auto-switch to mock if selected provider is no longer available
  useEffect(() => {
    if (availableProviders && availableProviders.length > 0 && !availableProviders.includes(value)) {
      onChange("mock");
    }
  }, [availableProviders, value, onChange]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-field flex items-center justify-between gap-1.5 text-xs py-2 cursor-pointer"
        aria-label="Select LLM provider"
        aria-expanded={open}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="truncate">{selected.label}</span>
        </div>
        <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-[999] mt-1.5 w-full dropdown-panel overflow-hidden animate-slide-in" style={{ maxHeight: "240px" }}>
          <ul className="overflow-y-auto">
            {PROVIDERS.filter(p => isAvailable(p.value)).map((p) => {
              const PIcon = ICON_MAP[p.icon];
              const isSelected = value === p.value;
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => { onChange(p.value); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 transition-colors
                      ${isSelected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                  >
                    <PIcon className={`h-4 w-4 shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400 dark:text-zinc-500"}`} />
                    <div className="min-w-0">
                      <div className={`font-medium ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-zinc-100"}`}>{p.label}</div>
                      <div className="text-[10px] text-gray-500 dark:text-zinc-500">{p.description}</div>
                    </div>
                    {isSelected && (
                      <div className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

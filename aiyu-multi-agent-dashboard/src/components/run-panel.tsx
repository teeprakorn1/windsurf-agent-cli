"use client";

import { Play, Sparkles } from "lucide-react";
import { AgentSelect } from "@/components/agent-select";
import { ProviderSelect } from "@/components/provider-select";

type Provider = "openai" | "claude" | "local" | "mock";

interface RunPanelProps {
  agentName: string;
  setAgentName: (v: string) => void;
  input: string;
  setInput: (v: string) => void;
  provider: Provider;
  setProvider: (v: Provider) => void;
  onRun: () => void;
  agentCount: number;
  activeRunCount: number;
  availableProviders?: string[];
}

export function RunPanel({
  agentName,
  setAgentName,
  input,
  setInput,
  provider,
  setProvider,
  onRun,
  agentCount,
  activeRunCount,
  availableProviders,
}: RunPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun();
    }
  };

  return (
    <>
      <div className="glass-card p-4 relative z-20 overflow-visible">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <h2 className="section-title mb-0">New Run</h2>
        </div>
        <div className="space-y-2.5">
          <AgentSelect value={agentName} onChange={setAgentName} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the task... (Ctrl+Enter to run, Esc to clear)"
            rows={3}
            aria-label="Task description"
            className="input-field resize-none"
          />
          <div className="flex gap-2">
            <ProviderSelect value={provider} onChange={(v) => setProvider(v as Provider)} availableProviders={availableProviders} />
            <button onClick={onRun} disabled={!input.trim()} className="btn-primary flex-[2] py-2.5 text-sm">
              <Play className="h-4 w-4" />
              Run Agent
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-3 text-center glow-blue">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{agentCount}</p>
          <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Agents</p>
        </div>
        <div className="glass-card p-3 text-center glow-cyan">
          <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{activeRunCount}</p>
          <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Active Runs</p>
        </div>
      </div>
    </>
  );
}

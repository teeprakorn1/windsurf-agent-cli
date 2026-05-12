"use client";

import { Bot, Zap, Loader2, History, StopCircle, Download } from "lucide-react";
import { fetchAgentsList, type AgentInfo } from "@/lib/agents-cache";
import { AgentSelect } from "@/components/agent-select";
import { ProviderSelect } from "@/components/provider-select";

interface SessionHeaderProps {
  activeSession: { agentName: string; provider: string; model: string } | null;
  setAvatarPopupRole: (role: "assistant" | "user" | null) => void;
  setAvatarDialogOpen: (v: boolean) => void;
  setAgentInfoData: (data: AgentInfo | { name: string; description: string; provider: string; model: string } | null) => void;
  selectedAgent: string;
  setSelectedAgent: (v: string) => void;
  selectedProvider: string;
  setSelectedProvider: (v: string) => void;
  availableProviders: string[];
  sessionTokenUsage: { total: number };
  isStreaming: boolean;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  showIntervention: boolean;
  setShowIntervention: (v: boolean) => void;
  handleExport: (sessionId: string) => void;
  activeSessionId: string;
}

export function SessionHeader({
  activeSession, setAvatarPopupRole, setAvatarDialogOpen, setAgentInfoData,
  selectedAgent, setSelectedAgent, selectedProvider, setSelectedProvider,
  availableProviders, sessionTokenUsage, isStreaming,
  showHistory, setShowHistory, showIntervention, setShowIntervention,
  handleExport, activeSessionId,
}: SessionHeaderProps) {
  return (
    <div className="px-4 py-2.5 border-b border-gray-200 dark:border-zinc-700/60 flex items-center justify-between">
      <div className="flex items-center gap-2 relative">
        <button
          onClick={async () => {
            if (!activeSession?.agentName) return;
            setAvatarPopupRole("assistant");
            setAvatarDialogOpen(true);
            try {
              const list = await fetchAgentsList();
              const found = Array.isArray(list) ? list.find((a: { name: string }) => a.name === activeSession.agentName) : null;
              setAgentInfoData(found || { name: activeSession.agentName, description: "No description available", provider: activeSession.provider || "inherit", model: activeSession.model || "inherit" });
            } catch { /* ignore */ }
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          title="Agent details"
        >
          <Bot className="h-4 w-4 text-cyan-500" />
          <span className="text-sm font-medium">{activeSession?.agentName || "Agent"}</span>
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{activeSession?.provider}/{activeSession?.model}</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-32 sm:w-36" title="For next session"><AgentSelect value={selectedAgent} onChange={setSelectedAgent} /></div>
        <div className="w-24 sm:w-28" title="For next session"><ProviderSelect value={selectedProvider} onChange={(v) => setSelectedProvider(v as string)} availableProviders={availableProviders} /></div>
        {sessionTokenUsage.total > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
            <Zap className="h-2.5 w-2.5" />{sessionTokenUsage.total.toLocaleString()}
          </span>
        )}
        {isStreaming && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 animate-pulse">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />Thinking
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setShowHistory(!showHistory)} className={`btn-ghost text-[10px] flex items-center gap-1 ${showHistory ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" : ""}`} title="Chat History">
          <History className="h-3 w-3" /><span className="hidden sm:inline">History</span>
        </button>
        <button onClick={() => setShowIntervention(!showIntervention)} className="btn-ghost text-[10px] flex items-center gap-1" title="Intervene">
          <StopCircle className="h-3 w-3" /><span className="hidden sm:inline">Intervene</span>
        </button>
        <button onClick={() => handleExport(activeSessionId)} className="btn-ghost text-[10px] flex items-center gap-1" title="Export">
          <Download className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { MessageSquare, Activity, Search, Plus, Trash2, Bot, Sparkles, Download, ChevronRight } from "lucide-react";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { InterventionPanel } from "@/components/intervention-panel";
import { InteractionMap } from "@/components/interaction-map";
import { MemoryViewer } from "@/components/memory-viewer";
import { LogsViewer } from "@/components/logs-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import type { InspectedItem, InteractionInspectData, LogInspectData } from "@/lib/types";

interface SessionInfo {
  sessionId: string;
  agentName: string;
  provider: string;
  model: string;
}

interface ChatSidebarProps {
  sidebarTab: "chat" | "monitor";
  setSidebarTab: (tab: "chat" | "monitor") => void;
  showSidebar: boolean;
  setShowSidebar: (v: boolean) => void;
  sessionSearch: string;
  setSessionSearch: (v: string) => void;
  filteredSessions: SessionInfo[];
  sessions: SessionInfo[];
  chatUserMsgs: { sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  setInspectedItem: (item: InspectedItem | null) => void;
  connected: boolean;
  setShowNewChat: (v: boolean) => void;
  setClearAllConfirm: (v: boolean) => void;
  setDeleteConfirmId: (id: string | null) => void;
  handleEditSession: (sessionId: string) => void;
  handleExport: (sessionId: string) => void;
  handleInspectAgent: (name: string | null) => void;
  handleInspectActivity: (id: string | null) => void;
  handleInspectInteraction: (data: InteractionInspectData | null) => void;
  handleInspectLog: (data: LogInspectData | null) => void;
  inspectedItem: InspectedItem | null;
  collapsedSections: Set<string>;
  toggleSection: (id: string) => void;
}

export function ChatSidebar({
  sidebarTab, setSidebarTab, showSidebar, setShowSidebar,
  sessionSearch, setSessionSearch, filteredSessions, sessions,
  chatUserMsgs, activeSessionId, setActiveSessionId, setInspectedItem,
  connected, setShowNewChat, setClearAllConfirm, setDeleteConfirmId,
  handleEditSession, handleExport,
  handleInspectAgent, handleInspectActivity, handleInspectInteraction, handleInspectLog,
  inspectedItem, collapsedSections, toggleSection,
}: ChatSidebarProps) {
  return (
    <>
      {/* Mobile sidebar overlay */}
      {showSidebar && <div className="lg:hidden fixed inset-0 bg-black/30 z-[998]" onClick={() => setShowSidebar(false)} />}

      {/* Session Sidebar */}
      <div className={`w-[280px] shrink-0 border-r border-gray-200 dark:border-zinc-700/60 flex flex-col overflow-hidden transition-transform duration-300 ${showSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:relative inset-y-0 left-0 z-[999] bg-white dark:bg-zinc-900 lg:z-auto`}>
        {/* Sidebar Tabs */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center border-b border-gray-200 dark:border-zinc-700/60">
            <button
              onClick={() => setSidebarTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-all border-b-2 ${sidebarTab === "chat" ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"}`}
            >
              <MessageSquare className="h-3 w-3" />Chat
            </button>
            <button
              onClick={() => setSidebarTab("monitor")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-all border-b-2 ${sidebarTab === "monitor" ? "border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"}`}
            >
              <Activity className="h-3 w-3" />Monitor
            </button>
          </div>
        </div>

        {sidebarTab === "chat" ? (
        <>
        {/* Chat Tab Content */}
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700/50 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600"
            />
          </div>
          <button onClick={() => setShowNewChat(true)} disabled={!connected} className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="New chat">
            <Plus className="h-3.5 w-3.5" />
          </button>
          {sessions.length > 0 && (
            <button onClick={() => setClearAllConfirm(true)} className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Clear all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {filteredSessions.map(s => {
            const msgCount = chatUserMsgs.filter(m => m.sessionId === s.sessionId).length;
            const isActive = s.sessionId === activeSessionId;
            return (
            <div key={s.sessionId}
              className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all mb-0.5 ${isActive ? "bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-200 dark:ring-blue-500/20" : "hover:bg-gray-100 dark:hover:bg-zinc-800/60"}`}
              onClick={() => { setActiveSessionId(s.sessionId); setInspectedItem(null); setShowSidebar(false); }}
            >
              <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${isActive ? "bg-blue-100 dark:bg-blue-500/15" : "bg-gray-100 dark:bg-zinc-800"}`}>
                <Bot className={`h-3.5 w-3.5 ${isActive ? "text-blue-500" : "text-gray-400 dark:text-zinc-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-medium truncate ${isActive ? "text-blue-700 dark:text-blue-300" : ""}`}>{s.agentName}</p>
                <div className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-zinc-500">
                  <span className="inline-flex items-center rounded px-1 py-0 bg-gray-100 dark:bg-zinc-800 text-[8px]">{s.provider}</span>
                  <span>{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button onClick={e => { e.stopPropagation(); handleEditSession(s.sessionId); }} className="p-0.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10" title="Details">
                  <Sparkles className="h-2.5 w-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); handleExport(s.sessionId); }} className="p-0.5 rounded text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10" title="Export">
                  <Download className="h-2.5 w-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(s.sessionId); }} className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          );
          })}
          {sessions.length === 0 && (
            <div className="px-3 py-6 text-center">
              <Bot className="h-6 w-6 mx-auto text-gray-300 dark:text-zinc-600 mb-2" />
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">No sessions yet</p>
            </div>
          )}
        </div>
        </>
        ) : (
        /* Monitor Tab Content */
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
          {[
            { id: "status", comp: <AgentStatusPanel onAgentSelect={handleInspectAgent} activeAgent={inspectedItem?.type === "agent" ? inspectedItem.name : null} /> },
            { id: "metrics", comp: <MetricsPanel /> },
            { id: "intervene", comp: <InterventionPanel /> },
            { id: "timeline", comp: <ExecutionTimeline onInspectActivity={handleInspectActivity} activeActivity={inspectedItem?.type === "activity" ? inspectedItem.id : null} /> },
            { id: "interact", comp: <InteractionMap onAgentSelect={handleInspectAgent} activeAgent={inspectedItem?.type === "agent" ? inspectedItem.name : null} /> },
            { id: "memory", comp: <MemoryViewer onInspectInteraction={handleInspectInteraction} /> },
            { id: "logs", comp: <LogsViewer onInspectLog={handleInspectLog} /> },
          ].map(section => (
            <div key={section.id} className="shrink-0">
              <div className="flex items-center justify-between px-1 py-0.5">
                <span className="text-[9px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{section.id}</span>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="p-0.5 rounded text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  title={collapsedSections.has(section.id) ? "Expand" : "Collapse"}
                >
                  <ChevronRight className={`h-2.5 w-2.5 transition-transform ${collapsedSections.has(section.id) ? "" : "rotate-90"}`} />
                </button>
              </div>
              {!collapsedSections.has(section.id) && section.comp}
            </div>
          ))}
        </div>
        )}
      </div>
    </>
  );
}

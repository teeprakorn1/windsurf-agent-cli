"use client";

import { useWs } from "@/lib/ws-context";
import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from "react";
import { AgentSelect } from "@/components/agent-select";
import { ProviderSelect } from "@/components/provider-select";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  Send, Bot, User, Loader2, MessageSquare, Copy, Check,
  Zap, Wrench, Plus, Trash2, Download, Pencil, ArrowRight,
  AlertTriangle, StopCircle, ChevronRight, X, Search, ArrowDown, History,
  Activity, Sparkles,
} from "lucide-react";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { InterventionPanel } from "@/components/intervention-panel";
import { InteractionMap } from "@/components/interaction-map";
import { MemoryViewer } from "@/components/memory-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import { LogsViewer } from "@/components/logs-viewer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  steps?: { thought: string | null; toolCalls: { tool: string }[] | null; duration_ms: number | null; error: string | null }[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  isStreaming?: boolean;
  handoff?: { from: string; to: string } | null;
}

export function ChatPanel() {
  const {
    connected, chatSessions, chatSteps, chatCompletions, chatUserMsgs, addChatUserMsg, clearChatHistory,
    sendChatCreate, sendChatSend, sendIntervene, handoffs, deleteChatSession,
  } = useWs();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("mock");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [interventionText, setInterventionText] = useState("");
  const [showIntervention, setShowIntervention] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [showAgentInfo, setShowAgentInfo] = useState(false);
  const [agentInfoData, setAgentInfoData] = useState<{ name: string; description: string; provider: string; model: string } | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarPopupRole, setAvatarPopupRole] = useState<"user" | "assistant" | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "monitor">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const turnCounterRef = useRef(0);
  const pendingMsgRef = useRef<string | null>(null);
  const pendingCreateRef = useRef(false);

  // Fetch available providers from health endpoint
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          const llm = data?.checks?.llmProviders;
          if (llm && typeof llm === "object") {
            const enabled = Object.entries(llm as Record<string, string>)
              .filter(([, v]) => v === "enabled" || v === "available" || v === "configured" || v === "ok")
              .map(([k]) => k);
            setAvailableProviders(enabled.length > 0 ? enabled : ["mock"]);
          }
        }
      } catch { /* ignore */ }
    };
    fetchProviders();
    const interval = setInterval(fetchProviders, 30000);
    return () => clearInterval(interval);
  }, []);

  const sessions = useMemo(() => Object.values(chatSessions).sort((a, b) => a.sessionId.localeCompare(b.sessionId)), [chatSessions]);

  useEffect(() => {
    if (sessions.length > 0) {
      const latestId = sessions[sessions.length - 1].sessionId;
      if (!activeSessionId || !chatSessions[activeSessionId]) setActiveSessionId(latestId);
    }
  }, [sessions, activeSessionId, chatSessions]);

  // Auto-send pending message when session becomes active after creation
  useEffect(() => {
    if (pendingCreateRef.current) {
      const sessions = Object.values(chatSessions);
      const latest = sessions[sessions.length - 1];
      if (latest && latest.sessionId !== activeSessionId) {
        pendingCreateRef.current = false;
        setActiveSessionId(latest.sessionId);
      }
    }
    if (activeSessionId && pendingMsgRef.current) {
      const msg = pendingMsgRef.current;
      pendingMsgRef.current = null;
      const now = Date.now();
      const turnKey = `${activeSessionId}-turn-${++turnCounterRef.current}-${now}`;
      const turnId = `${activeSessionId}:turn:${turnCounterRef.current}`;
      addChatUserMsg({ sessionId: activeSessionId, input: msg, timestamp: now, turnKey, turnId });
      sendChatSend(activeSessionId, msg, { turnId });
    }
  }, [activeSessionId, chatSessions, sendChatSend, addChatUserMsg]);

  const activeSession = activeSessionId ? chatSessions[activeSessionId] : null;

  const sessionHandoffs = useMemo(() => {
    if (!activeSession) return [];
    return handoffs.filter(h => h.fromAgent === activeSession.agentName || h.toAgent === activeSession.agentName);
  }, [handoffs, activeSession]);

  const messages = useMemo<ChatMessage[]>(() => {
    if (!activeSessionId) return [];
    const sessionSteps = chatSteps.filter(s => s.sessionId === activeSessionId);
    const completions = chatCompletions[activeSessionId] || [];
    const sessionUserMsgs = chatUserMsgs.filter(m => m.sessionId === activeSessionId);
    const msgs: ChatMessage[] = [];

    for (let i = 0; i < sessionUserMsgs.length; i++) {
      const um = sessionUserMsgs[i];
      msgs.push({ id: um.turnKey + "-user", role: "user", content: um.input, timestamp: um.timestamp });

      const nextUserTimestamp = sessionUserMsgs[i + 1]?.timestamp ?? Infinity;
      const stepsForTurn = sessionSteps.filter(s => s.turnId && s.turnId === um.turnId);
      const stepsAfterUser = stepsForTurn.length > 0 ? stepsForTurn : sessionSteps.filter(s => s.timestamp >= um.timestamp && s.timestamp < nextUserTimestamp);
      const completionForTurn = completions.find(c => c.turnId && c.turnId === um.turnId) || completions.find(c => c.completedAt >= um.timestamp && c.completedAt < nextUserTimestamp) || null;
      const isComplete = !!completionForTurn;

      // Check for handoff in this turn
      const turnHandoff = sessionHandoffs.find(h => h.timestamp >= um.timestamp && h.timestamp < nextUserTimestamp);

      if (stepsAfterUser.length > 0 || isComplete) {
        const assistantSteps = stepsAfterUser.map(s => ({ thought: s.thought, toolCalls: s.toolCalls, duration_ms: s.duration_ms, error: s.error }));
        msgs.push({
          id: um.turnKey + "-assistant", role: "assistant",
          content: isComplete ? (completionForTurn?.content || "") : "",
          timestamp: stepsAfterUser.length > 0 ? stepsAfterUser[0].timestamp : um.timestamp,
          steps: assistantSteps.length > 0 ? assistantSteps : undefined,
          usage: isComplete ? (completionForTurn?.usage ?? null) : null,
          isStreaming: !isComplete,
          handoff: turnHandoff ? { from: turnHandoff.fromAgent, to: turnHandoff.toAgent } : null,
        });
      } else {
        msgs.push({ id: um.turnKey + "-assistant", role: "assistant", content: "", timestamp: Date.now(), isStreaming: true });
      }
    }
    return msgs;
  }, [activeSessionId, chatSteps, chatCompletions, chatUserMsgs, sessionHandoffs]);

  const handleCreateSession = useCallback(() => {
    if (!connected) return;
    sendChatCreate({ agentName: selectedAgent || undefined, provider: selectedProvider });
  }, [connected, selectedAgent, selectedProvider, sendChatCreate]);

  const handleSend = useCallback(() => {
    if (!chatInput.trim() || !connected) return;
    if (!activeSessionId) {
      sendChatCreate({ agentName: selectedAgent || undefined, provider: selectedProvider });
      // Queue the message to be sent once session is created
      pendingMsgRef.current = chatInput.trim();
      setChatInput("");
      if (inputRef.current) { inputRef.current.style.height = "auto"; }
      return;
    }
    const now = Date.now();
    const turnKey = `${activeSessionId}-turn-${++turnCounterRef.current}-${now}`;
    const turnId = `${activeSessionId}:turn:${turnCounterRef.current}`;
    addChatUserMsg({ sessionId: activeSessionId!, input: chatInput.trim(), timestamp: now, turnKey, turnId });
    sendChatSend(activeSessionId, chatInput.trim(), { turnId });
    setChatInput("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
  }, [chatInput, activeSessionId, connected, sendChatSend, sendChatCreate, selectedAgent, selectedProvider, addChatUserMsg]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleIntervene = useCallback(() => {
    if (!activeSessionId || !interventionText.trim()) return;
    sendIntervene(activeSessionId, interventionText.trim());
    setInterventionText("");
    setShowIntervention(false);
  }, [activeSessionId, interventionText, sendIntervene]);

  const prevMsgCountRef = useRef(0);
  const prevSessionRef = useRef<string | null>(null);

  // Only auto-scroll when NEW messages arrive (not when switching sessions)
  useEffect(() => {
    const sessionChanged = activeSessionId !== prevSessionRef.current;
    prevSessionRef.current = activeSessionId;
    if (sessionChanged) {
      // Session changed — scroll to bottom once after render
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }));
      prevMsgCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, activeSessionId]);

  // Detect scroll position for scroll-to-bottom button
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeSessionId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Session token usage
  const sessionTokenUsage = useMemo(() => {
    if (!activeSessionId) return { total: 0, turns: 0 };
    const completions = chatCompletions[activeSessionId];
    if (!completions || completions.length === 0) return { total: 0, turns: 0 };
    return { total: completions.reduce((sum, c) => sum + (c.usage?.totalTokens ?? 0), 0), turns: completions.length };
  }, [activeSessionId, chatCompletions]);

  // Filtered sessions for search
  const filteredSessions = useMemo(() => {
    if (!sessionSearch) return sessions;
    const q = sessionSearch.toLowerCase();
    return sessions.filter(s => s.agentName.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q) || s.sessionId.toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  // Close avatar dialog on Escape
  useEffect(() => {
    if (!avatarDialogOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setAvatarDialogOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [avatarDialogOpen]);

  // Clear expanded steps when switching sessions
  useEffect(() => {
    setExpandedSteps(new Set());
  }, [activeSessionId]);

  const handleAvatarClick = useCallback(async (msg: ChatMessage) => {
    setAvatarPopupRole(msg.role);
    setAvatarDialogOpen(true);
    if (msg.role === "assistant" && activeSession?.agentName) {
      try {
        const res = await fetch("/api/agents/list");
        if (res.ok) {
          const list = await res.json();
          const found = Array.isArray(list) ? list.find((a: { name: string }) => a.name === activeSession.agentName) : null;
          setAgentInfoData(found || { name: activeSession.agentName, description: "No description available", provider: activeSession.provider || "inherit", model: activeSession.model || "inherit" });
        }
      } catch { /* ignore */ }
    } else {
      setAgentInfoData(null);
    }
  }, [activeSession]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
  }, []);

  const handleExport = useCallback((sessionId: string) => {
    const session = chatSessions[sessionId];
    if (!session) return;
    const msgs = chatUserMsgs.filter(m => m.sessionId === sessionId);
    const exportData = { session, messages: msgs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `chat-${sessionId.slice(0, 8)}.json`; a.click(); URL.revokeObjectURL(url);
  }, [chatSessions, chatUserMsgs]);

  const handleEditSession = useCallback((sessionId: string) => {
    const s = chatSessions[sessionId];
    if (!s) return;
    setEditingSessionId(sessionId);
    setEditName(s.agentName);
    setEditDialogOpen(true);
  }, [chatSessions]);

  const handleSaveEdit = useCallback(() => {
    // Note: session rename requires a setter in the WS context; currently a no-op visually
    setEditingSessionId(null);
    setEditDialogOpen(false);
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    if (activeSessionId === sessionId) setActiveSessionId(null);
    deleteChatSession(sessionId);
  }, [activeSessionId, deleteChatSession]);

  const toggleSteps = useCallback((msgId: string) => {
    setExpandedSteps(prev => { const next = new Set(prev); if (next.has(msgId)) next.delete(msgId); else next.add(msgId); return next; });
  }, []);

  const isStreaming = messages.some(m => m.isStreaming);

  return (
    <div className="glass-card flex h-full relative">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="lg:hidden fixed top-20 left-3 z-[9999] h-9 w-9 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all"
        aria-label="Toggle sidebar"
      >
        {showSidebar ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      </button>

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
              onClick={() => { setActiveSessionId(s.sessionId); setShowSidebar(false); }}
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
                <button onClick={e => { e.stopPropagation(); handleEditSession(s.sessionId); }} className="p-0.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10" title="Edit">
                  <Pencil className="h-2.5 w-2.5" />
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
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          <AgentStatusPanel />
          <MetricsPanel />
          <InterventionPanel />
          <ExecutionTimeline />
          <InteractionMap />
          <MemoryViewer />
          <LogsViewer />
        </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeSessionId ? (
          /* New Session Setup */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <Bot className="h-12 w-12 text-gray-300 dark:text-zinc-600" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">Start a chat session to talk with an agent</p>
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <AgentSelect value={selectedAgent} onChange={setSelectedAgent} />
              <ProviderSelect value={selectedProvider} onChange={(v) => setSelectedProvider(v as string)} availableProviders={availableProviders} />
              <button onClick={handleCreateSession} disabled={!connected} className="btn-primary px-4 py-2.5 text-xs w-full flex items-center justify-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" /> Start Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Session Header */}
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2 relative" data-agent-info>
                <button
                  onClick={async () => {
                    if (!activeSession?.agentName) return;
                    if (showAgentInfo) { setShowAgentInfo(false); return; }
                    try {
                      const res = await fetch("/api/agents/list");
                      if (res.ok) {
                        const list = await res.json();
                        const found = Array.isArray(list) ? list.find((a: { name: string }) => a.name === activeSession.agentName) : null;
                        setAgentInfoData(found || { name: activeSession.agentName, description: "No description available", provider: activeSession.provider || "inherit", model: activeSession.model || "inherit" });
                        setShowAgentInfo(true);
                      }
                    } catch { /* ignore */ }
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  title="Agent details"
                >
                  <Bot className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm font-medium">{activeSession?.agentName || "Agent"}</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{activeSession?.provider}/{activeSession?.model}</span>
                </button>
                {showAgentInfo && agentInfoData && (
                  <div className="absolute left-0 top-full z-[999] mt-1.5 w-64 dropdown-panel animate-slide-in p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-cyan-100 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/20">
                        <Bot className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-zinc-100 truncate">{agentInfoData.name}</h3>
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 line-clamp-2">{agentInfoData.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                        <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Provider</p>
                        <p className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate">{activeSession?.provider || (agentInfoData.provider === "inherit" ? "Auto" : agentInfoData.provider)}</p>
                      </div>
                      <div className="flex-1 rounded-md px-2 py-1.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                        <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Model</p>
                        <p className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate">{activeSession?.model || (agentInfoData.model === "inherit" ? "Auto" : agentInfoData.model)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-32 sm:w-36"><AgentSelect value={selectedAgent} onChange={setSelectedAgent} /></div>
                <div className="w-24 sm:w-28"><ProviderSelect value={selectedProvider} onChange={(v) => setSelectedProvider(v as string)} availableProviders={availableProviders} /></div>
                {sessionTokenUsage.total > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                    <Zap className="h-2.5 w-2.5" />{sessionTokenUsage.total}
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

            {/* Intervention Bar */}
            {showIntervention && (
              <div className="px-4 py-2 border-b border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/5 flex items-center gap-2 animate-slide-in">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <input value={interventionText} onChange={e => setInterventionText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleIntervene(); }}
                  placeholder="Send intervention message..."
                  className="flex-1 text-xs bg-transparent outline-none placeholder:text-orange-300 dark:placeholder:text-orange-400/50" />
                <button onClick={handleIntervene} disabled={!interventionText.trim()} className="btn-ghost text-[10px] text-orange-600 dark:text-orange-400">Send</button>
                <button onClick={() => setShowIntervention(false)} className="btn-ghost p-0.5"><X className="h-3 w-3" /></button>
              </div>
            )}

            {/* Chat History or Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto relative">
              {showHistory ? (
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">Chat History</span>
                    </div>
                    <button onClick={() => setShowHistory(false)} className="btn-ghost p-1 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700"><X className="h-3.5 w-3.5" /></button>
                  </div>

                  {/* Stats bar */}
                  {sessions.length > 0 && (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/50">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-blue-400" />
                        <span className="text-[10px] text-gray-600 dark:text-zinc-400">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-blue-400" />
                        <span className="text-[10px] text-gray-600 dark:text-zinc-400">{chatUserMsgs.length} messages</span>
                      </div>
                      {(() => {
                        const total = Object.values(chatCompletions).flat().reduce((s, c) => s + (c.usage?.totalTokens ?? 0), 0);
                        return total > 0 ? (
                          <div className="flex items-center gap-1">
                            <Zap className="h-3 w-3 text-yellow-500" />
                            <span className="text-[10px] text-gray-600 dark:text-zinc-400">{total.toLocaleString()} tokens</span>
                          </div>
                        ) : null;
                      })()}
                      <div className="ml-auto">
                        <button onClick={clearChatHistory} className="text-[9px] text-red-400 hover:text-red-500 transition-colors flex items-center gap-0.5">
                          <Trash2 className="h-2.5 w-2.5" /> Clear All
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search */}
                  {sessions.length > 3 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <input
                        type="text"
                        value={sessionSearch}
                        onChange={e => setSessionSearch(e.target.value)}
                        placeholder="Search history..."
                        className="w-full pl-8 pr-3 py-1.5 text-[10px] bg-gray-50 dark:bg-zinc-800/50 rounded-md border border-gray-200 dark:border-zinc-700/50 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors text-gray-900 dark:text-zinc-100"
                      />
                    </div>
                  )}

                  {sessions.length === 0 ? (
                    <div className="py-12 text-center">
                      <MessageSquare className="h-8 w-8 mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
                      <p className="text-xs text-gray-400 dark:text-zinc-500">No chat history yet</p>
                      <p className="text-[10px] text-gray-300 dark:text-zinc-600 mt-1">Start a conversation to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        // Group sessions by date
                        const groups: { label: string; sessions: typeof filteredSessions }[] = [];
                        const today = new Date().toDateString();
                        const yesterday = new Date(Date.now() - 86400000).toDateString();
                        for (const s of filteredSessions) {
                          const msgs = chatUserMsgs.filter(m => m.sessionId === s.sessionId);
                          const ts = msgs.length > 0 ? msgs[msgs.length - 1].timestamp : Date.now();
                          const d = new Date(ts).toDateString();
                          const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(ts).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
                          let g = groups.find(g => g.label === label);
                          if (!g) { g = { label, sessions: [] }; groups.push(g); }
                          g.sessions.push(s);
                        }
                        return groups.map(g => (
                          <div key={g.label}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{g.label}</span>
                              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700/50" />
                            </div>
                            {g.sessions.map(s => {
                              const sessionMsgs = chatUserMsgs.filter(m => m.sessionId === s.sessionId);
                              const completions = chatCompletions[s.sessionId] || [];
                              const lastMsg = sessionMsgs.length > 0 ? sessionMsgs[sessionMsgs.length - 1] : null;
                              const totalTokens = completions.reduce((sum, c) => sum + (c.usage?.totalTokens ?? 0), 0);
                              const isActive = s.sessionId === activeSessionId;
                              const isExpanded = expandedSession === s.sessionId;
                              return (
                                <div key={s.sessionId}
                                  className={`mb-1 rounded-lg border transition-all ${isActive ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" : "border-gray-200 dark:border-zinc-700/50 hover:border-gray-300 dark:hover:border-zinc-600"}`}
                                >
                                  {/* Session header - click to expand/collapse */}
                                  <div
                                    className="px-3 py-2 cursor-pointer"
                                    onClick={() => setExpandedSession(isExpanded ? null : s.sessionId)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${isActive ? "bg-blue-100 dark:bg-blue-500/20" : "bg-gray-100 dark:bg-zinc-800"}`}>
                                          <Bot className={`h-3 w-3 ${isActive ? "text-blue-500" : "text-cyan-500"}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11px] font-semibold truncate">{s.agentName}</p>
                                          <div className="flex items-center gap-1.5 text-[9px] text-gray-400 dark:text-zinc-500">
                                            <span className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{s.provider}</span>
                                            <span>·</span>
                                            <span>{sessionMsgs.length} msg{sessionMsgs.length !== 1 ? "s" : ""}</span>
                                            {totalTokens > 0 && <><span>·</span><span className="flex items-center gap-0.5"><Zap className="h-2 w-2" />{totalTokens}</span></>}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <span className="text-[9px] text-gray-400 dark:text-zinc-500">
                                          {new Date(lastMsg?.timestamp ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        <button
                                          onClick={e => { e.stopPropagation(); setExpandedSession(isExpanded ? null : s.sessionId); }}
                                          className={`p-1 rounded transition-colors ${isExpanded ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-blue-500"}`}
                                          title={isExpanded ? "Collapse" : "View messages"}
                                        >
                                          <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); setDeleteConfirmId(s.sessionId); }}
                                          className="p-1 rounded text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                          title="Delete session"
                                        >
                                          <Trash2 className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                    {lastMsg && !isExpanded && (
                                      <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate mt-1 ml-8">
                                        {lastMsg.input}
                                      </p>
                                    )}
                                  </div>
                                  {/* Expanded messages */}
                                  {isExpanded && (
                                    <div className="px-3 pb-3 ml-8 space-y-2 border-t border-gray-200 dark:border-zinc-700/40 pt-2">
                                      {sessionMsgs.length === 0 ? (
                                        <p className="text-[10px] text-gray-400 dark:text-zinc-500">No messages</p>
                                      ) : sessionMsgs.map((m) => {
                                        const completion = completions.find(c => c.turnId === m.turnId);
                                        return (
                                          <div key={m.turnKey} className="space-y-1">
                                            {/* User message */}
                                            <div
                                              className="flex items-start gap-1.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/5 rounded p-1 -m-1 transition-colors"
                                              onClick={() => { setActiveSessionId(s.sessionId); setShowHistory(false); setTimeout(() => { const el = document.getElementById(`msg-${m.turnKey}-user`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100); }}
                                              title="Go to this message"
                                            >
                                              <div className="shrink-0 h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
                                                <User className="h-2 w-2 text-blue-500" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <p className="text-[10px] text-gray-700 dark:text-zinc-300">{m.input}</p>
                                                <span className="text-[8px] text-gray-400 dark:text-zinc-500">{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                              </div>
                                            </div>
                                            {/* Assistant response */}
                                            {completion?.content && (
                                              <div
                                                className="flex items-start gap-1.5 ml-0 cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-500/5 rounded p-1 -m-1 transition-colors"
                                                onClick={() => { setActiveSessionId(s.sessionId); setShowHistory(false); setTimeout(() => { const el = document.getElementById(`msg-${m.turnKey}-assistant`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100); }}
                                                title="Go to this message"
                                              >
                                                <div className="shrink-0 h-4 w-4 rounded-full bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
                                                  <Bot className="h-2 w-2 text-cyan-500" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 line-clamp-3">{completion.content.slice(0, 200)}{completion.content.length > 200 ? "..." : ""}</p>
                                                  {completion.usage && (
                                                    <span className="text-[8px] text-gray-400 dark:text-zinc-500 flex items-center gap-0.5 mt-0.5">
                                                      <Zap className="h-1.5 w-1.5" />{completion.usage.totalTokens} tokens
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {totalTokens > 0 && (
                                        <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100 dark:border-zinc-800/30">
                                          <Zap className="h-2.5 w-2.5 text-yellow-500" />
                                          <span className="text-[9px] text-gray-500 dark:text-zinc-400 font-medium">{totalTokens.toLocaleString()} tokens total</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              ) : (
              <div className="px-4 py-3 space-y-4">
              {messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateSep = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
                return (
                <Fragment key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700/50" />
                      <span className="text-[9px] text-gray-400 dark:text-zinc-500 font-medium">{new Date(msg.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700/50" />
                    </div>
                  )}
                <div id={`msg-${msg.id}`} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    onClick={() => handleAvatarClick(msg)}
                    className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-500/50 transition-all shadow-sm ${msg.role === "user" ? "bg-gradient-to-br from-blue-400 to-blue-600" : "bg-gradient-to-br from-cyan-400 to-cyan-600"}`}
                    title={msg.role === "assistant" ? "Agent details" : "User info"}
                  >
                    {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                  </div>
                  <div className={`max-w-[80%] ${msg.role === "user" ? "ml-auto text-right" : ""}`}>
                    {/* Sender name + timestamp */}
                    <div className={`flex items-center gap-1.5 mb-1 ${msg.role === "user" ? "justify-end" : ""}`}>
                      <span className="text-[10px] font-semibold text-gray-600 dark:text-zinc-400">{msg.role === "assistant" ? (activeSession?.agentName || "Agent") : "You"}</span>
                      <span className="text-[9px] text-gray-400 dark:text-zinc-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.role === "user" ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
                        : "bg-white dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/50 text-gray-900 dark:text-zinc-200 rounded-bl-sm"
                    }`}>
                      {msg.role === "assistant" && msg.isStreaming && !msg.content ? (
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400">Thinking...</span>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <div className="relative group/msg">
                          <MarkdownRenderer content={msg.content || (msg.isStreaming ? "..." : "")} />
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="absolute -top-1 -right-1 opacity-0 group-hover/msg:opacity-100 transition-all p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 shadow-sm border border-gray-200 dark:border-zinc-600"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-gray-500 dark:text-zinc-400" />}
                          </button>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      )}
                    </div>

                    {/* Handoff visualization */}
                    {msg.handoff && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-lg px-2.5 py-1.5 border border-purple-200 dark:border-purple-500/20">
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span>Handoff: <strong>{msg.handoff.from}</strong> → <strong>{msg.handoff.to}</strong></span>
                      </div>
                    )}

                    {/* Inline Steps (collapsible) */}
                    {msg.role === "assistant" && msg.steps && msg.steps.length > 0 && (
                      <div className="mt-1.5">
                        <button onClick={() => toggleSteps(msg.id)} className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors bg-gray-50 dark:bg-zinc-800/50 rounded-md px-2 py-0.5 border border-gray-200 dark:border-zinc-700/50">
                          <ChevronRight className={`h-2.5 w-2.5 transition-transform ${expandedSteps.has(msg.id) ? "rotate-90" : ""}`} />
                          <span>{msg.steps.length} step{msg.steps.length > 1 ? "s" : ""}</span>
                        </button>
                        {expandedSteps.has(msg.id) && (
                          <div className="mt-1 space-y-1 pl-3 border-l-2 border-cyan-300 dark:border-cyan-500/30">
                            {msg.steps.map((step, i) => (
                              <div key={i} className="text-[10px]">
                                {step.error ? (
                                  <div className="flex items-center gap-1.5 text-red-400">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    <span>Step {i + 1}: {step.error}</span>
                                  </div>
                                ) : step.toolCalls && step.toolCalls.length > 0 ? (
                                  <div className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400">
                                    <Wrench className="h-2.5 w-2.5" />
                                    <span className="font-mono">{step.toolCalls.map(tc => tc.tool).join(", ")}</span>
                                    {step.duration_ms != null && <span className="text-gray-400 dark:text-zinc-500 ml-auto">{step.duration_ms}ms</span>}
                                  </div>
                                ) : step.thought ? (
                                  <div className="flex items-start gap-1.5 text-cyan-600 dark:text-cyan-400">
                                    <Zap className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                    <span className="truncate">{step.thought.slice(0, 120)}{step.thought.length > 120 ? "..." : ""}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Step {i + 1}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Usage + Copy */}
                    <div className="mt-1 flex items-center gap-3">
                      {msg.role === "assistant" && msg.usage && (
                        <span className="text-[9px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5 text-yellow-500" /> {msg.usage.totalTokens} tokens
                        </span>
                      )}
                      {msg.role === "assistant" && msg.content && (
                        <button onClick={() => handleCopy(msg.id, msg.content)} className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                          {copiedId === msg.id ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                          {copiedId === msg.id ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>

                    <p className={`text-[9px] text-gray-300 dark:text-zinc-600 mt-0.5 ${msg.role === "user" ? "text-right" : ""}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>
                </div>
                </Fragment>
              );
              })}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/10 dark:to-cyan-500/10 flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-blue-400 dark:text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Start a conversation</p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">Type a message below to chat with the agent</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700/50">
                      <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-[8px] font-mono">Enter</kbd> to send
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-2.5 py-1.5 border border-gray-200 dark:border-zinc-700/50">
                      <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-[8px] font-mono">⇧Enter</kbd> for newline
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />

              {/* Scroll to bottom button */}
              {showScrollBtn && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-all animate-slide-in"
                  title="Scroll to bottom"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              )}
              </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900">
              <div className="px-4 pt-3 pb-1">
                <div className="relative flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={chatInput}
                      onChange={e => {
                        setChatInput(e.target.value);
                        if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"; }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      aria-label="Chat message"
                      rows={1}
                      className="w-full resize-none rounded-xl border border-gray-200 dark:border-zinc-700/60 bg-gray-50 dark:bg-zinc-800/50 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all"
                      style={{ maxHeight: 120 }}
                    />
                    {chatInput && (
                      <button
                        onClick={() => { setChatInput(""); if (inputRef.current) { inputRef.current.style.height = "auto"; } }}
                        className="absolute right-2.5 top-2.5 p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        title="Clear input"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!chatInput.trim() || !connected}
                    className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                      chatInput.trim() && connected
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/30"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed"
                    }`}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] text-gray-400 dark:text-zinc-500">
                  <span className="flex items-center gap-0.5"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[8px] font-mono">Enter</kbd> send</span>
                  <span className="flex items-center gap-0.5"><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[8px] font-mono">⇧Enter</kbd> newline</span>
                </div>
                {chatInput.length > 0 && (
                  <span className={`text-[9px] ${chatInput.length > 500 ? "text-orange-400" : "text-gray-400 dark:text-zinc-500"}`}>{chatInput.length}</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Avatar Detail Dialog */}
      {avatarDialogOpen && avatarPopupRole && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setAvatarDialogOpen(false)}>
          <div
            className="w-80 dropdown-panel animate-slide-in p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">
                {avatarPopupRole === "assistant" ? "Agent Details" : "User Info"}
              </h3>
              <button onClick={() => setAvatarDialogOpen(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                <X className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
              </button>
            </div>

            {avatarPopupRole === "assistant" && agentInfoData ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-100 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/20">
                    <Bot className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{agentInfoData.name}</h4>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-500 line-clamp-3">{agentInfoData.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Provider</p>
                    <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 truncate">{activeSession?.provider || (agentInfoData.provider === "inherit" ? "Auto" : agentInfoData.provider)}</p>
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Model</p>
                    <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 truncate">{activeSession?.model || (agentInfoData.model === "inherit" ? "Auto" : agentInfoData.model)}</p>
                  </div>
                </div>
              </>
            ) : avatarPopupRole === "user" ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">You</h4>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-500">Chat participant</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Session</p>
                    <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 font-mono">{activeSessionId?.slice(0, 16)}</p>
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Messages Sent</p>
                    <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300">{chatUserMsgs.filter(m => m.sessionId === activeSessionId).length}</p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Session Edit Dialog */}
      {editDialogOpen && editingSessionId && chatSessions[editingSessionId] && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditDialogOpen(false)}>
          <div
            className="w-80 dropdown-panel animate-slide-in p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">Edit Session</h3>
              <button onClick={() => setEditDialogOpen(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                <X className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Agent</label>
                <div className="mt-1">
                  <AgentSelect value={editName} onChange={setEditName} />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Provider</label>
                <div className="mt-1">
                  <ProviderSelect value={chatSessions[editingSessionId]?.provider || "mock"} onChange={() => {}} availableProviders={availableProviders} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                  <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Model</p>
                  <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 truncate">{chatSessions[editingSessionId]?.model}</p>
                </div>
                <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                  <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Session ID</p>
                  <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 font-mono">{editingSessionId.slice(0, 16)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleSaveEdit} className="btn-primary px-3 py-1.5 text-[11px] flex-1">Save</button>
              <button onClick={() => setEditDialogOpen(false)} className="btn-ghost px-3 py-1.5 text-[11px] flex-1">Cancel</button>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-zinc-700/50">
              <button
                onClick={() => { setDeleteConfirmId(editingSessionId); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Delete Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && chatSessions[deleteConfirmId] && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}>
          <div
            className="w-72 dropdown-panel animate-slide-in p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20">
                <AlertTriangle className="h-[18px] w-[18px] text-red-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-zinc-100">Delete Session?</h3>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
              <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 truncate">{chatSessions[deleteConfirmId].agentName}</p>
              <p className="text-[9px] text-gray-400 dark:text-zinc-500 font-mono">{deleteConfirmId.slice(0, 16)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { handleDeleteSession(deleteConfirmId); setDeleteConfirmId(null); setEditDialogOpen(false); }}
                className="flex-1 px-3 py-1.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-3 py-1.5 text-[11px] font-medium text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Dialog */}
      {showNewChat && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewChat(false)}>
          <div
            className="w-80 dropdown-panel animate-slide-in p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-500/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-zinc-100">New Chat</h3>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500">Start a conversation with an agent</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <AgentSelect value={selectedAgent} onChange={setSelectedAgent} />
              <ProviderSelect value={selectedProvider} onChange={(v) => setSelectedProvider(v as string)} availableProviders={availableProviders} />
              <button
                onClick={() => { handleCreateSession(); setShowNewChat(false); }}
                disabled={!connected}
                className="btn-primary px-3 py-2 text-[11px] w-full flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Create Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All History Confirmation Dialog */}
      {clearAllConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setClearAllConfirm(false)}>
          <div
            className="w-72 dropdown-panel animate-slide-in p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20">
                <AlertTriangle className="h-[18px] w-[18px] text-red-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-zinc-100">Clear All History?</h3>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500">This will delete all chat sessions.</p>
              </div>
            </div>
            <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
              <p className="text-[11px] text-gray-600 dark:text-zinc-400">{sessions.length} session{sessions.length !== 1 ? "s" : ""} will be deleted</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { clearChatHistory(); setClearAllConfirm(false); }}
                className="flex-1 px-3 py-1.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setClearAllConfirm(false)}
                className="flex-1 px-3 py-1.5 text-[11px] font-medium text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

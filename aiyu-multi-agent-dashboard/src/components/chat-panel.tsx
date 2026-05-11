"use client";

import { useWs } from "@/lib/ws-context";
import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from "react";
import type { ChatMessage } from "@/lib/types";
import { useChatMessages } from "@/lib/use-chat-messages";
import { AgentSelect } from "@/components/agent-select";
import { ProviderSelect } from "@/components/provider-select";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  Send, Bot, User, Loader2, MessageSquare, Copy, Check,
  Zap, Wrench, Plus, Trash2, Download, ArrowRight,
  AlertTriangle, StopCircle, ChevronRight, X, Search, ArrowDown, History,
  Activity, Sparkles, Clock, CheckCircle, ChevronDown, FileText, Brain,
} from "lucide-react";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { InterventionPanel } from "@/components/intervention-panel";
import { InteractionMap } from "@/components/interaction-map";
import { MemoryViewer } from "@/components/memory-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import { LogsViewer } from "@/components/logs-viewer";

export function ChatPanel() {
  const connected = useWs(s => s.connected);
  const activities = useWs(s => s.activities);
  const agentStatuses = useWs(s => s.agentStatuses);
  const mergedAgentStatuses = useMemo(() => {
    const map: Record<string, { status: string; runId: string | null; since: number }> = { ...agentStatuses };
    for (const [id, activity] of Object.entries(activities ?? {})) {
      const name = activity.agentName;
      if (!name) continue;
      if (!map[name] || (activity.completedAt ?? activity.createdAt) > (map[name].since ?? 0)) {
        map[name] = {
          status: activity.status === "idle" ? "idle" : activity.status === "running" ? "running" : activity.status === "error" || activity.status === "max_steps" ? "error" : "completed",
          runId: id,
          since: activity.completedAt ?? activity.createdAt,
        };
      }
    }
    return map;
  }, [agentStatuses, activities]);
  const sendChatCreate = useWs(s => s.sendChatCreate);
  const sendChatSend = useWs(s => s.sendChatSend);
  const sendIntervene = useWs(s => s.sendIntervene);
  const handoffs = useWs(s => s.handoffs);
  const addChatUserMsg = useWs(s => s.addChatUserMsg);
  const clearChatHistory = useWs(s => s.clearChatHistory);
  const deleteChatSession = useWs(s => s.deleteChatSession);

  // Derive chat-specific data from unified activities
  const safeActivities = useMemo(() => activities ?? {}, [activities]);
  const chatSessions = useMemo(() => {
    const result: Record<string, { sessionId: string; agentName: string; provider: string; model: string }> = {};
    for (const [id, activity] of Object.entries(safeActivities)) {
      if (activity.mode === "chat") {
        result[id] = { sessionId: id, agentName: activity.agentName, provider: activity.provider, model: activity.model };
      }
    }
    return result;
  }, [safeActivities]);
  const chatSteps = useMemo(() => {
    const result: { sessionId: string; turnId?: string; step: number; thought: string | null; toolCalls: { tool: string; error?: string | null }[] | null; duration_ms: number | null; error: string | null; timestamp: number }[] = [];
    for (const [id, activity] of Object.entries(safeActivities)) {
      if (activity.mode === "chat") {
        for (const step of activity.steps) {
          result.push({ sessionId: id, turnId: step.turnId, step: step.step, thought: step.thought, toolCalls: step.toolCalls, duration_ms: step.duration_ms, error: step.error, timestamp: step.timestamp });
        }
      }
    }
    return result;
  }, [safeActivities]);
  const chatCompletions = useMemo(() => {
    const result: Record<string, { sessionId: string; turnId?: string; content: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null; completedAt: number }[]> = {};
    for (const [id, activity] of Object.entries(safeActivities)) {
      if (activity.mode === "chat" && activity.completions.length > 0) {
        result[id] = activity.completions.map(c => ({ sessionId: id, turnId: c.turnId, content: c.content, usage: c.usage, completedAt: c.completedAt }));
      }
    }
    return result;
  }, [safeActivities]);
  const chatUserMsgs = useMemo(() => {
    const result: { sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }[] = [];
    for (const [id, activity] of Object.entries(safeActivities)) {
      if (activity.mode === "chat") {
        for (const msg of activity.userMessages) {
          result.push({ sessionId: id, input: msg.input, timestamp: msg.timestamp, turnKey: msg.turnKey, turnId: msg.turnId });
        }
      }
    }
    return result;
  }, [safeActivities]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("mock");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [interventionText, setInterventionText] = useState("");
  const [showIntervention, setShowIntervention] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showNewChat, setShowNewChat] = useState(false);
  const [inspectedAgent, setInspectedAgent] = useState<string | null>(null);
  const [inspectedActivity, setInspectedActivity] = useState<string | null>(null);
  const [inspectedInteraction, setInspectedInteraction] = useState<{ key: string; type: string; detail: string; status: string; time: number; raw: Record<string, unknown> } | null>(null);
  const [inspectedLog, setInspectedLog] = useState<{ id: string; time: number; displayTime: string; type: string; runId?: string; message: string; raw: Record<string, unknown> } | null>(null);
  const handleInspectAgent = useCallback((v: string | null) => {
    setInspectedAgent(v);
    if (v) { setInspectedActivity(null); setInspectedInteraction(null); setInspectedLog(null); }
  }, []);
  const handleInspectActivity = useCallback((v: string | null) => {
    setInspectedActivity(v);
    if (v) { setInspectedAgent(null); setInspectedInteraction(null); setInspectedLog(null); }
  }, []);
  const handleInspectInteraction = useCallback((v: { key: string; type: string; detail: string; status: string; time: number; raw: Record<string, unknown> } | null) => {
    setInspectedInteraction(v);
    if (v) { setInspectedAgent(null); setInspectedActivity(null); setInspectedLog(null); }
  }, []);
  const handleInspectLog = useCallback((v: { id: string; time: number; displayTime: string; type: string; runId?: string; message: string; raw: Record<string, unknown> } | null) => {
    setInspectedLog(v);
    if (v) { setInspectedAgent(null); setInspectedActivity(null); setInspectedInteraction(null); }
  }, []);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [agentInfoData, setAgentInfoData] = useState<{ name: string; description: string; provider: string; model: string } | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarPopupRole, setAvatarPopupRole] = useState<"user" | "assistant" | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "monitor">("chat");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const toggleSection = useCallback((id: string) => {
    setCollapsedSections(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  function formatAgentSince(since: number): string {
    const diff = Math.max(0, Date.now() - since);
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  }
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
      addChatUserMsg(activeSessionId, { input: msg, timestamp: now, turnKey, turnId });
      sendChatSend(activeSessionId, msg, { turnId });
    }
  }, [activeSessionId, chatSessions, sendChatSend, addChatUserMsg]);

  const activeSession = activeSessionId ? chatSessions[activeSessionId] : null;

  const sessionHandoffs = useMemo(() => {
    if (!activeSession) return [];
    return handoffs.filter(h => h.fromAgent === activeSession.agentName || h.toAgent === activeSession.agentName);
  }, [handoffs, activeSession]);

  const messages = useChatMessages(activeSessionId, chatSteps, chatCompletions, chatUserMsgs, sessionHandoffs);

  const handleCreateSession = useCallback(() => {
    if (!connected) return;
    sendChatCreate({ agentName: selectedAgent || undefined, provider: selectedProvider });
  }, [connected, selectedAgent, selectedProvider, sendChatCreate]);

  const handleSend = useCallback(() => {
    if (!chatInput.trim() || !connected) return;
    if (!activeSessionId) {
      sendChatCreate({ agentName: selectedAgent || undefined, provider: selectedProvider });
      // Queue the message to be sent once session is created
      pendingCreateRef.current = true;
      pendingMsgRef.current = chatInput.trim();
      setChatInput("");
      if (inputRef.current) { inputRef.current.style.height = "auto"; }
      return;
    }
    const now = Date.now();
    const turnKey = `${activeSessionId}-turn-${++turnCounterRef.current}-${now}`;
    const turnId = `${activeSessionId}:turn:${turnCounterRef.current}`;
    addChatUserMsg(activeSessionId!, { input: chatInput.trim(), timestamp: now, turnKey, turnId });
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

  // Filtered sessions for sidebar search
  const filteredSessions = useMemo(() => {
    if (!sessionSearch) return sessions;
    const q = sessionSearch.toLowerCase();
    return sessions.filter(s => s.agentName.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q) || s.sessionId.toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  // Filtered sessions for history search
  const historyFilteredSessions = useMemo(() => {
    if (!historySearch) return sessions;
    const q = historySearch.toLowerCase();
    return sessions.filter(s => s.agentName.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q) || s.sessionId.toLowerCase().includes(q));
  }, [sessions, historySearch]);

  // Close any open modal on Escape
  useEffect(() => {
    const anyModalOpen = avatarDialogOpen || editDialogOpen || !!deleteConfirmId || showNewChat || clearAllConfirm;
    if (!anyModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteConfirmId) setDeleteConfirmId(null);
        else if (clearAllConfirm) setClearAllConfirm(false);
        else if (editDialogOpen) setEditDialogOpen(false);
        else if (showNewChat) setShowNewChat(false);
        else if (avatarDialogOpen) setAvatarDialogOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [avatarDialogOpen, editDialogOpen, deleteConfirmId, showNewChat, clearAllConfirm]);

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
    setEditDialogOpen(true);
  }, [chatSessions]);

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
              onClick={() => { setActiveSessionId(s.sessionId); setInspectedAgent(null); setInspectedActivity(null); setInspectedInteraction(null); setInspectedLog(null); setShowSidebar(false); }}
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
            { id: "status", comp: <AgentStatusPanel onAgentSelect={handleInspectAgent} activeAgent={inspectedAgent} /> },
            { id: "metrics", comp: <MetricsPanel /> },
            { id: "intervene", comp: <InterventionPanel /> },
            { id: "timeline", comp: <ExecutionTimeline onInspectActivity={handleInspectActivity} activeActivity={inspectedActivity} /> },
            { id: "interact", comp: <InteractionMap onAgentSelect={handleInspectAgent} activeAgent={inspectedAgent} /> },
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {inspectedInteraction && (() => {
          const entry = inspectedInteraction;
          const isHandoff = entry.type === "handoff";
          const cfg = isHandoff ? { icon: ArrowRight, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", gradient: "from-cyan-500/5 to-blue-500/5", label: "Handoff" } : { icon: ArrowRight, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gradient: "from-amber-500/5 to-orange-500/5", label: "Delegate" };
          const II = cfg.icon;
          const r = entry.raw;
          return (
            <div className="flex-1 overflow-y-auto">
              <div className={`bg-gradient-to-br ${cfg.gradient} border-b ${cfg.border} px-6 py-5`}>
                <div className="max-w-xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-sm`}>
                      <II className={`h-6 w-6 ${cfg.color}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{cfg.label}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                          {entry.status}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-zinc-500">{new Date(entry.time).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setInspectedInteraction(null)} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="max-w-xl mx-auto p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{isHandoff ? "From" : "Parent"}</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(isHandoff ? r.fromAgent ?? "—" : r.parentAgent ?? "—")}</p>
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{isHandoff ? "To" : "Child"}</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(isHandoff ? r.toAgent ?? "—" : r.childAgent ?? "—")}</p>
                  </div>
                </div>
                {isHandoff ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Artifacts</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.artifacts ?? 0)}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Pending</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.pendingTasks ?? 0)}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.status ?? "—")}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Depth</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.depth ?? "—")}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.status ?? "—")}</p>
                    </div>
                  </div>
                )}
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors">
                    <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Raw Data</span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <pre className="mt-2 text-[11px] text-gray-600 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-48 border border-gray-200 dark:border-zinc-700/40">{JSON.stringify(r, null, 2)}</pre>
                </details>
              </div>
            </div>
          );
        })()}
        {inspectedLog && (() => {
          const log = inspectedLog;
          const typeCfg: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
            step: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-500/5 to-indigo-500/5" },
            complete: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-500/5 to-green-500/5" },
            error: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-500/5 to-orange-500/5" },
            handoff: { color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", gradient: "from-cyan-500/5 to-blue-500/5" },
            delegate: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gradient: "from-amber-500/5 to-orange-500/5" },
          };
          const cfg = typeCfg[log.type] || typeCfg.step;
          const r = log.raw;
          return (
            <div className="flex-1 overflow-y-auto">
              <div className={`bg-gradient-to-br ${cfg.gradient} border-b ${cfg.border} px-6 py-5`}>
                <div className="max-w-xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-sm`}>
                      <FileText className={`h-6 w-6 ${cfg.color}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 capitalize">{log.type}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                          {log.type}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-zinc-500">{log.displayTime}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setInspectedLog(null)} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="max-w-xl mx-auto p-6 space-y-5">
                {log.runId && (
                  <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Run ID</p>
                    <p className="font-mono text-xs text-gray-800 dark:text-zinc-300 truncate">{log.runId}</p>
                  </div>
                )}
                {log.type === "step" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                        <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Step</p>
                        <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">#{String(r.step ?? "—")}</p>
                      </div>
                      <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                        <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Duration</p>
                        <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</p>
                      </div>
                    </div>
                    {r.thought && (
                      <div className="rounded-xl border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-500/5 px-4 py-3">
                        <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><span className="text-[11px] text-cyan-700 dark:text-cyan-400 uppercase tracking-wider font-semibold">Thought</span></div>
                        <MarkdownRenderer content={String(r.thought)} className="text-sm text-gray-800 dark:text-zinc-300 leading-relaxed" />
                      </div>
                    )}
                    {r.result && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Result</span>
                        </div>
                        <MarkdownRenderer content={String(r.result)} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-52 border border-gray-200 dark:border-zinc-700/40" />
                      </div>
                    )}
                    {r.error && (
                      <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 px-4 py-3">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1"><AlertTriangle className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider font-semibold">Error</span></div>
                        <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{String(r.error)}</p>
                      </div>
                    )}
                  </>
                )}
                {log.type === "complete" && (
                  <>
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.status ?? "—")}</p>
                    </div>
                    {r.output && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Output</span>
                        </div>
                        <MarkdownRenderer content={String(r.output)} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-52 border border-gray-200 dark:border-zinc-700/40" />
                      </div>
                    )}
                  </>
                )}
                {log.type === "error" && (
                  <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 px-4 py-3">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2"><AlertTriangle className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider font-semibold">Error</span></div>
                    <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap leading-relaxed">{String(r.message ?? "")}</p>
                  </div>
                )}
                {(log.type === "handoff" || log.type === "delegate") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{log.type === "handoff" ? "From" : "Parent"}</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(log.type === "handoff" ? r.fromAgent ?? "—" : r.parentAgent ?? "—")}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                      <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{log.type === "handoff" ? "To" : "Child"}</p>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(log.type === "handoff" ? r.toAgent ?? "—" : r.childAgent ?? "—")}</p>
                    </div>
                  </div>
                )}
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors">
                    <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Raw Data</span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <pre className="mt-2 text-[11px] text-gray-600 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-48 border border-gray-200 dark:border-zinc-700/40">{JSON.stringify(r, null, 2)}</pre>
                </details>
              </div>
            </div>
          );
        })()}
        {inspectedActivity && (() => {
          const activity = activities[inspectedActivity];
          if (!activity) { setInspectedActivity(null); return null; }
          const steps = activity.steps;
          const completion = activity.completions[activity.completions.length - 1];
          const usage = activity.usage;
          const isActive = activity.status === "running" || activity.status === "idle";
          const statusCfg = isActive ? { icon: Activity, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-500/5 to-cyan-500/5", label: "Running" } : activity.status === "completed" ? { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-500/5 to-green-500/5", label: "Completed" } : (activity.status === "error" || activity.status === "max_steps") ? { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-500/5 to-orange-500/5", label: activity.status === "max_steps" ? "Max Steps" : "Error" } : { icon: Clock, color: "text-gray-600 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", gradient: "from-zinc-500/5 to-gray-500/5", label: activity.status };
          const SI = statusCfg.icon;
          return (
            <div className="flex-1 overflow-y-auto">
              <div className={`bg-gradient-to-br ${statusCfg.gradient} border-b ${statusCfg.border} px-6 py-5`}>
                <div className="max-w-xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${statusCfg.bg} border ${statusCfg.border} shadow-sm`}>
                      <SI className={`h-6 w-6 ${statusCfg.color}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{activity.mode === "chat" ? "Chat" : "Run"}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} border`}>
                          <span className={`h-1.5 w-1.5 rounded-full bg-current ${isActive ? "animate-pulse" : ""}`} />
                          {statusCfg.label}
                        </span>
                        {activity.mode === "chat" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">chat</span>}
                        <span className="text-[10px] text-gray-500 dark:text-zinc-500">{steps.length} steps</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setInspectedActivity(null)} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="max-w-xl mx-auto p-6 space-y-5">
                <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                  <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Activity ID</p>
                  <p className="font-mono text-xs text-gray-800 dark:text-zinc-300 break-all">{inspectedActivity}</p>
                </div>
                {steps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Steps ({steps.length})</p>
                    </div>
                    <div className="space-y-1.5">
                      {steps.slice(-8).map((s: { step: number; thought: string | null; error: string | null; duration_ms: number | null }, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                          <span className="font-mono text-[11px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">#{s.step}</span>
                          <span className="text-xs text-gray-800 dark:text-zinc-300 flex-1 break-words">{s.thought ? s.thought.slice(0, 120) : s.error ? <span className="text-red-500">Error: {s.error.slice(0, 60)}</span> : `Step ${s.step}`}</span>
                          {s.duration_ms != null && <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0">{formatAgentSince(s.duration_ms)}</span>}
                        </div>
                      ))}
                      {steps.length > 8 && <p className="text-[11px] text-gray-400 dark:text-zinc-600 text-center">+{steps.length - 8} more steps</p>}
                    </div>
                  </div>
                )}
                {completion?.content && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Output</p>
                    </div>
                    <MarkdownRenderer content={completion.content} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-64 border border-gray-200 dark:border-zinc-700/40" />
                  </div>
                )}
                {usage && (
                  <div className="rounded-xl px-4 py-3 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10 dark:border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Token Usage</p>
                    </div>
                    <div className="flex items-baseline gap-5">
                      {usage.promptTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Prompt</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{usage.promptTokens.toLocaleString()}</span></div>}
                      {usage.completionTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Comp</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{usage.completionTokens.toLocaleString()}</span></div>}
                      {usage.totalTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Total</span><span className="text-sm font-bold text-blue-600 dark:text-blue-400">{usage.totalTokens.toLocaleString()}</span></div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {inspectedAgent && (() => {
          const status = mergedAgentStatuses?.[inspectedAgent];
          if (!status) { setInspectedAgent(null); return null; }
          const runId = status.runId;
          const activity = runId ? activities[runId] : undefined;
          const steps = activity?.steps;
          const completion = activity?.completions[activity.completions.length - 1];
          const cfg = { running: { icon: Activity, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-500/5 to-cyan-500/5", label: "Running" }, completed: { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-500/5 to-green-500/5", label: "Completed" }, error: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-500/5 to-orange-500/5", label: "Error" }, idle: { icon: Clock, color: "text-gray-600 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", gradient: "from-zinc-500/5 to-gray-500/5", label: "Idle" } }[status.status] ?? { icon: Clock, color: "text-gray-600 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", gradient: "from-zinc-500/5 to-gray-500/5", label: status.status };
          const I = cfg.icon;
          return (
            <div className="flex-1 overflow-y-auto">
              {/* Hero Header */}
              <div className={`bg-gradient-to-br ${cfg.gradient} border-b ${cfg.border} px-6 py-5`}>
                <div className="max-w-xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-sm`}>
                      <I className={`h-6 w-6 ${cfg.color}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{inspectedAgent}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                          {cfg.label}
                        </span>
                        {status.since && (
                          <span className="text-[10px] text-gray-500 dark:text-zinc-500">{formatAgentSince(status.since)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setInspectedAgent(null)} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="max-w-xl mx-auto p-6 space-y-5">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-300 capitalize">{status.status}</p>
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Since</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-300">{status.since ? new Date(status.since).toLocaleTimeString() : "—"}</p>
                  </div>
                </div>
                {runId && (
                  <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Run ID</p>
                    <p className="font-mono text-xs text-gray-800 dark:text-zinc-300 truncate" title={runId}>{runId.length > 24 ? `${runId.slice(0, 12)}…${runId.slice(-8)}` : runId}</p>
                  </div>
                )}

                {/* Steps */}
                {steps && steps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Steps ({steps.length})</p>
                    </div>
                    <div className="space-y-1.5">
                      {steps.slice(-5).map((s: { step: number; thought: string | null; error: string | null }, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                          <span className="font-mono text-[11px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">#{s.step}</span>
                          <span className="text-xs text-gray-800 dark:text-zinc-300 flex-1 break-words">{s.thought ? s.thought.slice(0, 120) : s.error ? <span className="text-red-500">Error: {s.error.slice(0, 60)}</span> : `Step ${s.step}`}</span>
                        </div>
                      ))}
                      {steps.length > 5 && <p className="text-[11px] text-gray-400 dark:text-zinc-600 text-center">+{steps.length - 5} more steps</p>}
                    </div>
                  </div>
                )}

                {/* Output */}
                {completion?.content && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Output</p>
                    </div>
                    <MarkdownRenderer content={completion.content} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-64 border border-gray-200 dark:border-zinc-700/40" />
                  </div>
                )}

                {/* Token Usage */}
                {completion?.usage && (
                  <div className="rounded-xl px-4 py-3 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10 dark:border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Token Usage</p>
                    </div>
                    <div className="flex items-baseline gap-5">
                      {completion.usage.promptTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Prompt</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{completion.usage.promptTokens.toLocaleString()}</span></div>}
                      {completion.usage.completionTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Comp</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{completion.usage.completionTokens.toLocaleString()}</span></div>}
                      {completion.usage.totalTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Total</span><span className="text-sm font-bold text-blue-600 dark:text-blue-400">{completion.usage.totalTokens.toLocaleString()}</span></div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {(inspectedAgent || inspectedActivity || inspectedInteraction || inspectedLog) ? null : !activeSessionId ? (
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
        ) : (inspectedAgent || inspectedActivity || inspectedInteraction || inspectedLog) ? null : (
          <>
            {/* Session Header */}
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={async () => {
                    if (!activeSession?.agentName) return;
                    setAvatarPopupRole("assistant");
                    setAvatarDialogOpen(true);
                    try {
                      const res = await fetch("/api/agents/list");
                      if (res.ok) {
                        const list = await res.json();
                        const found = Array.isArray(list) ? list.find((a: { name: string }) => a.name === activeSession.agentName) : null;
                        setAgentInfoData(found || { name: activeSession.agentName, description: "No description available", provider: activeSession.provider || "inherit", model: activeSession.model || "inherit" });
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
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
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
                        const groups: { label: string; sessions: typeof historyFilteredSessions }[] = [];
                        const today = new Date().toDateString();
                        const yesterday = new Date(Date.now() - 86400000).toDateString();
                        for (const s of historyFilteredSessions) {
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

                    {/* Usage */}
                    <div className="mt-1 flex items-center gap-3">
                      {msg.role === "assistant" && msg.usage && (
                        <span className="text-[9px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5 text-yellow-500" /> {msg.usage.totalTokens.toLocaleString()} tokens
                        </span>
                      )}
                    </div>

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
        <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setAvatarDialogOpen(false)} role="dialog" aria-modal="true" aria-label="Avatar details">
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

      {/* Session Details Dialog */}
      {editDialogOpen && editingSessionId && chatSessions[editingSessionId] && (() => {
        const s = chatSessions[editingSessionId];
        const sessionMsgs = chatUserMsgs.filter(m => m.sessionId === editingSessionId);
        const completions = chatCompletions[editingSessionId] || [];
        const totalTokens = completions.reduce((sum, c) => sum + (c.usage?.totalTokens ?? 0), 0);
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditDialogOpen(false)} role="dialog" aria-modal="true" aria-label="Session details">
            <div
              className="w-80 dropdown-panel animate-slide-in p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wider">Session Details</h3>
                <button onClick={() => setEditDialogOpen(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                  <X className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/20">
                  <Bot className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{s.agentName}</h4>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">{sessionMsgs.length} msg{sessionMsgs.length !== 1 ? "s" : ""}{totalTokens > 0 ? ` · ${totalTokens.toLocaleString()} tokens` : ""}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                  <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Provider</p>
                  <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 truncate">{s.provider}</p>
                </div>
                <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                  <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Model</p>
                  <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 truncate">{s.model}</p>
                </div>
              </div>
              <div className="rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50">
                <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase">Session ID</p>
                <p className="text-[11px] font-medium text-gray-700 dark:text-zinc-300 font-mono truncate" title={editingSessionId}>{editingSessionId.length > 24 ? `${editingSessionId.slice(0, 12)}…${editingSessionId.slice(-8)}` : editingSessionId}</p>
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
        );
      })()}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && chatSessions[deleteConfirmId] && (
        <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} role="dialog" aria-modal="true" aria-label="Delete confirmation">
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
        <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewChat(false)} role="dialog" aria-modal="true" aria-label="New chat">
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
                <p className="text-[10px] text-gray-500 dark:text-zinc-500">Choose agent & provider</p>
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
        <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setClearAllConfirm(false)} role="dialog" aria-modal="true" aria-label="Clear all confirmation">
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

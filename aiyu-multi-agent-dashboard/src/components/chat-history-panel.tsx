"use client";

import { History as HistoryIcon, X, MessageSquare, User, Bot, Zap, Trash2, Search, ChevronRight } from "lucide-react";

interface SessionInfo {
  sessionId: string;
  agentName: string;
  provider: string;
  model: string;
}

interface UserMsg {
  sessionId: string;
  input: string;
  timestamp: number;
  turnKey: string;
  turnId: string;
}

interface Completion {
  sessionId: string;
  turnId?: string;
  content: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  completedAt: number;
}

interface HistoryGroup {
  label: string;
  sessions: SessionInfo[];
}

interface ChatHistoryPanelProps {
  sessions: SessionInfo[];
  chatUserMsgs: UserMsg[];
  chatCompletions: Record<string, Completion[]>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  setShowHistory: (v: boolean) => void;
  setDeleteConfirmId: (id: string | null) => void;
  clearChatHistory: () => void;
  historySearch: string;
  setHistorySearch: (v: string) => void;
  historyGroups: HistoryGroup[];
  expandedSession: string | null;
  setExpandedSession: (id: string | null) => void;
}

export function ChatHistoryPanel({
  sessions, chatUserMsgs, chatCompletions, activeSessionId,
  setActiveSessionId, setShowHistory, setDeleteConfirmId,
  clearChatHistory, historySearch, setHistorySearch,
  historyGroups, expandedSession, setExpandedSession,
}: ChatHistoryPanelProps) {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-blue-500" />
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
          {Object.values(chatCompletions).flat().reduce((s, c) => s + (c.usage?.totalTokens ?? 0), 0) > 0 && (
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span className="text-[10px] text-gray-600 dark:text-zinc-400">{Object.values(chatCompletions).flat().reduce((s, c) => s + (c.usage?.totalTokens ?? 0), 0).toLocaleString()} tokens</span>
            </div>
          )}
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
          {historyGroups.map(g => (
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
                            const hasContent = completion && completion.content;
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
                                {hasContent && (
                                  <div
                                    className="flex items-start gap-1.5 ml-0 cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-500/5 rounded p-1 -m-1 transition-colors"
                                    onClick={() => { setActiveSessionId(s.sessionId); setShowHistory(false); setTimeout(() => { const el = document.getElementById(`msg-${m.turnKey}-assistant`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100); }}
                                    title="Go to this message"
                                  >
                                    <div className="shrink-0 h-4 w-4 rounded-full bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
                                      <Bot className="h-2 w-2 text-cyan-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 line-clamp-3">{completion!.content!.slice(0, 200)}{completion!.content!.length > 200 ? "..." : ""}</p>
                                      {completion!.usage && (
                                        <span className="text-[8px] text-gray-400 dark:text-zinc-500 flex items-center gap-0.5 mt-0.5">
                                          <Zap className="h-1.5 w-1.5" />{completion!.usage.totalTokens} tokens
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
          ))}
        </div>
      )}
    </div>
  );
}

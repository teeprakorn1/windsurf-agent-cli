"use client";

import { useWs } from "@/lib/ws-context";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { AgentSelect } from "@/components/agent-select";
import { ProviderSelect } from "@/components/provider-select";
import { Send, Bot, User, Loader2, ChevronDown, MessageSquare, Copy, Check, Clock, Zap, Wrench, Plus } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  steps?: { thought: string | null; toolCalls: { tool: string }[] | null; duration_ms: number | null; error: string | null }[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  isStreaming?: boolean;
}

interface UserMsgRecord {
  sessionId: string;
  input: string;
  timestamp: number;
  turnKey: string;
  turnId: string;
}

export function ChatPanel() {
  const { connected, chatSessions, chatSteps, chatCompletions, sendChatCreate, sendChatSend } = useWs();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("mock");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [userMsgs, setUserMsgs] = useState<UserMsgRecord[]>([]);
  const sessionListRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnCounterRef = useRef(0);

  const sessions = useMemo(() => Object.values(chatSessions).sort((a, b) => a.sessionId.localeCompare(b.sessionId)), [chatSessions]);

  useEffect(() => {
    if (sessions.length > 0) {
      // Auto-select latest session if none selected, or if a new session was just created
      const latestId = sessions[sessions.length - 1].sessionId;
      if (!activeSessionId || !chatSessions[activeSessionId]) {
        setActiveSessionId(latestId);
      }
    }
  }, [sessions, activeSessionId, chatSessions]);

  const activeSession = activeSessionId ? chatSessions[activeSessionId] : null;

  const messages = useMemo<ChatMessage[]>(() => {
    if (!activeSessionId) return [];
    const sessionSteps = chatSteps.filter(s => s.sessionId === activeSessionId);
    const completion = chatCompletions[activeSessionId];
    const sessionUserMsgs = userMsgs.filter(m => m.sessionId === activeSessionId);

    const msgs: ChatMessage[] = [];

    for (let i = 0; i < sessionUserMsgs.length; i++) {
      const um = sessionUserMsgs[i];
      msgs.push({
        id: um.turnKey + "-user",
        role: "user",
        content: um.input,
        timestamp: um.timestamp,
      });

      const nextUserTimestamp = sessionUserMsgs[i + 1]?.timestamp ?? Infinity;
      const stepsForTurn = sessionSteps.filter(s => s.turnId && s.turnId === um.turnId);
      const stepsAfterUser = stepsForTurn.length > 0
        ? stepsForTurn
        : sessionSteps.filter(s => s.timestamp >= um.timestamp && s.timestamp < nextUserTimestamp);

      const completionForTurn = completion && completion.turnId && completion.turnId === um.turnId
        ? completion
        : (completion && completion.completedAt >= um.timestamp && completion.completedAt < nextUserTimestamp ? completion : null);

      const isComplete = !!completionForTurn;

      if (stepsAfterUser.length > 0 || isComplete) {
        const assistantSteps = stepsAfterUser.map(s => ({
          thought: s.thought,
          toolCalls: s.toolCalls,
          duration_ms: s.duration_ms,
          error: s.error,
        }));

        const assistantContent = isComplete ? (completionForTurn?.content || "") : "";
        msgs.push({
          id: um.turnKey + "-assistant",
          role: "assistant",
          content: assistantContent,
          timestamp: stepsAfterUser.length > 0 ? stepsAfterUser[0].timestamp : um.timestamp,
          steps: assistantSteps.length > 0 ? assistantSteps : undefined,
          usage: isComplete ? (completionForTurn?.usage ?? null) : null,
          isStreaming: !isComplete,
        });
      } else {
        msgs.push({
          id: um.turnKey + "-assistant",
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        });
      }
    }

    return msgs;
  }, [activeSessionId, chatSteps, chatCompletions, userMsgs]);

  const handleCreateSession = useCallback(() => {
    if (!connected) return;
    sendChatCreate({ agentName: selectedAgent || undefined, provider: selectedProvider });
  }, [connected, selectedAgent, selectedProvider, sendChatCreate]);

  const handleSend = useCallback(() => {
    if (!chatInput.trim() || !activeSessionId || !connected) return;
    const turnKey = `${activeSessionId}-turn-${++turnCounterRef.current}`;
    const turnId = `${activeSessionId}:turn:${turnCounterRef.current}`;
    const now = Date.now();
    setUserMsgs(prev => [...prev, { sessionId: activeSessionId, input: chatInput.trim(), timestamp: now, turnKey, turnId }]);
    sendChatSend(activeSessionId, chatInput.trim(), { turnId });
    setChatInput("");
  }, [chatInput, activeSessionId, connected, sendChatSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatSteps]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target as Node)) setShowSessionList(false);
    };
    if (showSessionList) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSessionList]);

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  return (
    <div className="glass-card flex flex-col overflow-hidden" style={{ height: "520px" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
          <h2 className="section-title mb-0">Chat</h2>
        </div>
        <div className="flex items-center gap-2">
          <div ref={sessionListRef} className="relative">
            <button
              onClick={() => setShowSessionList(!showSessionList)}
              className="btn-ghost text-[10px] flex items-center gap-1"
              aria-label="Select session"
            >
              <span className="max-w-[80px] truncate">{activeSession?.agentName || "No session"}</span>
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showSessionList ? "rotate-180" : ""}`} />
            </button>
            {showSessionList && (
              <div className="absolute right-0 z-50 mt-1 w-56 dropdown-panel overflow-hidden animate-slide-in">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700/60">
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-bold">Sessions</p>
                </div>
                <ul className="py-1 max-h-48 overflow-y-auto">
                  {sessions.map(s => (
                    <li key={s.sessionId}>
                      <button
                        onClick={() => { setActiveSessionId(s.sessionId); setShowSessionList(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${s.sessionId === activeSessionId ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                      >
                        <span className="font-medium">{s.agentName}</span>
                        <span className="text-[9px] text-gray-400 dark:text-zinc-500 ml-2">{s.provider}/{s.model}</span>
                      </button>
                    </li>
                  ))}
                  {sessions.length === 0 && (
                    <li className="px-3 py-2 text-[10px] text-gray-400 dark:text-zinc-500">No sessions yet</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <button onClick={() => setActiveSessionId(null)} className="btn-ghost text-[10px] flex items-center gap-1" title="New chat session">
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
      </div>

      {!activeSessionId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <Bot className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
          <p className="text-xs text-gray-500 dark:text-zinc-400 text-center">Start a chat session to talk with an agent</p>
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            <div className="w-full"><AgentSelect value={selectedAgent} onChange={setSelectedAgent} /></div>
            <div className="w-full"><ProviderSelect value={selectedProvider} onChange={(v) => setSelectedProvider(v as string)} /></div>
            <button onClick={handleCreateSession} disabled={!connected} className="btn-primary px-4 py-2 text-xs w-full">
              Start Chat
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-blue-100 dark:bg-blue-500/15" : "bg-cyan-100 dark:bg-cyan-500/15"}`}>
                  {msg.role === "user" ? <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> : <Bot className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
                </div>
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-200 rounded-bl-md"
                  }`}>
                    {msg.role === "assistant" && msg.isStreaming && !msg.content ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
                        <span className="text-[11px] text-gray-500 dark:text-zinc-400">Thinking...</span>
                      </div>
                    ) : msg.role === "assistant" ? (
                      <MarkdownRenderer content={msg.content || (msg.isStreaming ? "..." : "")} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{msg.content || (msg.isStreaming ? "..." : "")}</div>
                    )}
                  </div>

                  {msg.role === "assistant" && msg.steps && msg.steps.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {msg.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-zinc-500">
                          {step.error ? (
                            <span className="text-red-400">Step {i + 1}: error</span>
                          ) : step.toolCalls && step.toolCalls.length > 0 ? (
                            <>
                              <Wrench className="h-2.5 w-2.5" />
                              <span>Step {i + 1}: {step.toolCalls.map(tc => tc.tool).join(", ")}</span>
                            </>
                          ) : step.thought ? (
                            <>
                              <Zap className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[200px]">Step {i + 1}: {step.thought.slice(0, 60)}{step.thought.length > 60 ? "..." : ""}</span>
                            </>
                          ) : (
                            <span>Step {i + 1}</span>
                          )}
                          {step.duration_ms != null && <span className="ml-auto">{step.duration_ms}ms</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === "assistant" && msg.usage && (
                    <div className="mt-1 flex items-center gap-2 text-[9px] text-gray-400 dark:text-zinc-500">
                      <Clock className="h-2.5 w-2.5" />
                      <span>Tokens: {msg.usage.totalTokens}</span>
                      <span>(P:{msg.usage.promptTokens} C:{msg.usage.completionTokens})</span>
                    </div>
                  )}

                  {msg.role === "assistant" && msg.content && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="mt-1 flex items-center gap-1 text-[9px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                      {copiedId === msg.id ? "Copied" : "Copy"}
                    </button>
                  )}

                  <p className={`text-[9px] text-gray-400 dark:text-zinc-500 mt-0.5 ${msg.role === "user" ? "text-right" : ""}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-400 dark:text-zinc-500">Send a message to start chatting</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-zinc-700/60">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={e => {
                  setChatInput(e.target.value);
                  if (inputRef.current) inputRef.current.style.height = "auto";
                  if (inputRef.current) inputRef.current.style.height = inputRef.current.scrollHeight + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                aria-label="Chat message"
                rows={1}
                className="input-field resize-none flex-1"
              />
              <button
                onClick={handleSend}
                disabled={!chatInput.trim() || !connected}
                className="btn-primary px-3 py-2"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

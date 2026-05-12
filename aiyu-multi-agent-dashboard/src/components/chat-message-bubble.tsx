"use client";

import { Fragment } from "react";
import { Bot, User, Copy, Check, Zap, Wrench, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { ChatMessage } from "@/lib/types";

interface ChatMessageBubbleProps {
  msg: ChatMessage;
  showDateSep: boolean;
  agentName: string;
  copiedId: string | null;
  expandedSteps: Set<string>;
  onAvatarClick: (msg: ChatMessage) => void;
  onCopy: (id: string, text: string) => void;
  onToggleSteps: (msgId: string) => void;
}

export function ChatMessageBubble({
  msg,
  showDateSep,
  agentName,
  copiedId,
  expandedSteps,
  onAvatarClick,
  onCopy,
  onToggleSteps,
}: ChatMessageBubbleProps) {
  return (
    <Fragment>
      {showDateSep && (
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700/50" />
          <span className="text-[9px] text-gray-400 dark:text-zinc-500 font-medium">{new Date(msg.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700/50" />
        </div>
      )}
      <div id={`msg-${msg.id}`} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
        <div
          onClick={() => onAvatarClick(msg)}
          className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-500/50 transition-all shadow-sm ${msg.role === "user" ? "bg-gradient-to-br from-blue-400 to-blue-600" : "bg-gradient-to-br from-cyan-400 to-cyan-600"}`}
          title={msg.role === "assistant" ? "Agent details" : "User info"}
        >
          {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
        </div>
        <div className={`max-w-[80%] ${msg.role === "user" ? "ml-auto text-right" : ""}`}>
          {/* Sender name + timestamp */}
          <div className={`flex items-center gap-1.5 mb-1 ${msg.role === "user" ? "justify-end" : ""}`}>
            <span className="text-[10px] font-semibold text-gray-600 dark:text-zinc-400">{msg.role === "assistant" ? (agentName || "Agent") : "You"}</span>
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
                  onClick={() => onCopy(msg.id, msg.content)}
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
              <button onClick={() => onToggleSteps(msg.id)} className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors bg-gray-50 dark:bg-zinc-800/50 rounded-md px-2 py-0.5 border border-gray-200 dark:border-zinc-700/50">
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
}

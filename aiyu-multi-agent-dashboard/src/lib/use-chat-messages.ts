"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatStepLike {
  sessionId: string;
  turnId?: string;
  step: number;
  thought: string | null;
  toolCalls: { tool: string; error?: string | null }[] | null;
  duration_ms: number | null;
  error: string | null;
  timestamp: number;
}

interface ChatCompletionLike {
  sessionId: string;
  turnId?: string;
  content: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  completedAt: number;
}

interface HandoffLike {
  fromAgent: string;
  toAgent: string;
  timestamp: number;
}

interface UserMsgLike {
  sessionId: string;
  input: string;
  timestamp: number;
  turnKey: string;
  turnId: string;
}

export function computeChatMessages(
  activeSessionId: string | null,
  chatSteps: ChatStepLike[],
  chatCompletions: Record<string, ChatCompletionLike[]>,
  chatUserMsgs: UserMsgLike[],
  sessionHandoffs: HandoffLike[],
): ChatMessage[] {
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
    const stepsAfterUser = stepsForTurn.length > 0 ? stepsForTurn : sessionSteps.filter(s => !s.turnId && s.timestamp >= um.timestamp && s.timestamp < nextUserTimestamp);
    const completionForTurn = completions.find(c => c.turnId && c.turnId === um.turnId) || completions.find(c => !c.turnId && c.completedAt >= um.timestamp && c.completedAt < nextUserTimestamp) || null;
    const isComplete = !!completionForTurn;

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
}

export function useChatMessages(
  activeSessionId: string | null,
  chatSteps: ChatStepLike[],
  chatCompletions: Record<string, ChatCompletionLike[]>,
  chatUserMsgs: UserMsgLike[],
  sessionHandoffs: HandoffLike[],
): ChatMessage[] {
  return useMemo<ChatMessage[]>(() =>
    computeChatMessages(activeSessionId, chatSteps, chatCompletions, chatUserMsgs, sessionHandoffs),
  [activeSessionId, chatSteps, chatCompletions, chatUserMsgs, sessionHandoffs]);
}

"use client";

import { memo } from "react";
import { Activity } from "lucide-react";

interface StreamingIndicatorProps {
  isStreaming: boolean;
  content?: string;
}

export const StreamingIndicator = memo(function StreamingIndicator({
  isStreaming, content,
}: StreamingIndicatorProps) {
  if (!isStreaming) return null;

  return (
    <div className="flex items-start gap-2 p-3 animate-slide-in">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
        <Activity className="h-3 w-3 text-blue-500 dark:text-blue-400 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1 flex items-center gap-1.5">
          <span className="font-medium">Assistant</span>
          <span className="text-[9px] px-1.5 py-0 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse">streaming</span>
        </div>
        {content && (
          <div className="text-sm text-gray-800 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
            {content}
            <span className="inline-block w-1.5 h-4 bg-blue-500 dark:bg-blue-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
          </div>
        )}
        {!content && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-600">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
});

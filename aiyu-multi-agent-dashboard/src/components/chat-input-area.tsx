"use client";

import { Send, X } from "lucide-react";

interface ChatInputAreaProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  chatInput: string;
  setChatInput: (v: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSend: () => void;
  connected: boolean;
}

export function ChatInputArea({
  inputRef,
  chatInput,
  setChatInput,
  handleKeyDown,
  handleSend,
  connected,
}: ChatInputAreaProps) {
  return (
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
  );
}

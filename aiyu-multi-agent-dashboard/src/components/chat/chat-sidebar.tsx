"use client";

import { memo, useState, useMemo } from "react";
import { useWs } from "@/lib/ws-context";
import { MessageSquare, Plus, Trash2, Search, X } from "lucide-react";

interface ChatSidebarProps {
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  showSidebar: boolean;
  onCloseSidebar: () => void;
}

export const ChatSidebar = memo(function ChatSidebar({
  activeSessionId, onSelectSession, onNewChat, onDeleteSession, onClearHistory,
  showSidebar, onCloseSidebar,
}: ChatSidebarProps) {
  const activities = useWs(s => s.activities);
  const [search, setSearch] = useState("");

  const chatActivities = useMemo(() => {
    return Object.entries(activities ?? {})
      .filter(([, a]) => a.mode === "chat")
      .filter(([id, a]) => !search || id.includes(search) || a.agentName.includes(search))
      .sort(([, a], [, b]) => b.createdAt - a.createdAt);
  }, [activities, search]);

  return (
    <>
      {/* Mobile overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onCloseSidebar} />
      )}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto top-0 left-0 h-full w-72 lg:w-64
        bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800
        flex flex-col transition-transform duration-200
        ${showSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xs font-bold text-gray-900 dark:text-zinc-200 uppercase tracking-wider">Chats</h2>
          <div className="flex items-center gap-1">
            <button onClick={onNewChat} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400" title="New chat">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button onClick={onCloseSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 lg:hidden">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sessions..." className="input-field pl-7 py-1.5 text-xs" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chatActivities.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-gray-400 dark:text-zinc-600">
              <MessageSquare className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">No chat sessions</p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {chatActivities.map(([id, activity]) => {
                const isActive = id === activeSessionId;
                const lastMsg = activity.userMessages[activity.userMessages.length - 1];
                return (
                  <button
                    key={id}
                    onClick={() => onSelectSession(id)}
                    className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                      isActive ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" : "hover:bg-gray-50 dark:hover:bg-zinc-800/50 text-gray-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate flex-1">{activity.agentName || id.slice(0, 16)}</span>
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteSession(id); }}
                        className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:hover:text-red-400 shrink-0"
                        title="Delete session"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    {lastMsg && (
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate mt-0.5">{lastMsg.input}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] px-1.5 py-0 rounded-full ${
                        activity.status === "running" ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                        activity.status === "completed" ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        activity.status === "error" ? "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
                        "bg-gray-100 dark:bg-zinc-700/30 text-gray-500 dark:text-zinc-500"
                      }`}>{activity.status}</span>
                      <span className="text-[9px] text-gray-400 dark:text-zinc-600">{new Date(activity.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={onClearHistory}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Clear All
          </button>
        </div>
      </aside>
    </>
  );
});

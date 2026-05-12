"use client";

import { Bot, User, X, AlertTriangle, Trash2, Sparkles, MessageSquare } from "lucide-react";
import { AgentSelect } from "@/components/agent-select";
import { ProviderSelect } from "@/components/provider-select";

interface UserMsgLike {
  sessionId: string;
  input: string;
  timestamp: number;
  turnKey: string;
  turnId: string;
}

interface ChatSession {
  sessionId: string;
  agentName: string;
  provider: string;
  model: string;
}

interface ChatDialogsProps {
  avatarDialogOpen: boolean;
  avatarPopupRole: "user" | "assistant" | null;
  agentInfoData: { name: string; description: string; provider: string; model: string } | null;
  activeSession: ChatSession | null;
  activeSessionId: string | null;
  chatUserMsgs: UserMsgLike[];
  setAvatarDialogOpen: (v: boolean) => void;

  editDialogOpen: boolean;
  editingSessionId: string | null;
  chatSessions: Record<string, ChatSession>;
  chatCompletions: Record<string, { usage?: { totalTokens: number } | null }[]>;
  setEditDialogOpen: (v: boolean) => void;
  setDeleteConfirmId: (v: string | null) => void;

  deleteConfirmId: string | null;
  handleDeleteSession: (id: string) => void;

  showNewChat: boolean;
  setShowNewChat: (v: boolean) => void;
  selectedAgent: string;
  setSelectedAgent: (v: string) => void;
  selectedProvider: string;
  setSelectedProvider: (v: string) => void;
  availableProviders: string[];
  connected: boolean;
  handleCreateSession: () => void;

  clearAllConfirm: boolean;
  setClearAllConfirm: (v: boolean) => void;
  sessions: ChatSession[];
  clearChatHistory: () => void;
}

export function ChatDialogs(props: ChatDialogsProps) {
  const {
    avatarDialogOpen, avatarPopupRole, agentInfoData, activeSession, activeSessionId,
    chatUserMsgs, setAvatarDialogOpen,
    editDialogOpen, editingSessionId, chatSessions, chatCompletions, setEditDialogOpen, setDeleteConfirmId,
    deleteConfirmId, handleDeleteSession,
    showNewChat, setShowNewChat, selectedAgent, setSelectedAgent, selectedProvider, setSelectedProvider,
    availableProviders, connected, handleCreateSession,
    clearAllConfirm, setClearAllConfirm, sessions, clearChatHistory,
  } = props;

  return (
    <>
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
    </>
  );
}

"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useWs } from "@/lib/ws-context";
import { Send, Square, MessageSquare, ChevronDown, Zap } from "lucide-react";

export const InterventionPanel = memo(function InterventionPanel() {
  const activities = useWs(s => s.activities);
  const sendIntervene = useWs(s => s.sendIntervene);
  const [selectedRun, setSelectedRun] = useState("");
  const [message, setMessage] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeEntries = Object.entries(activities ?? {})
    .filter(([, a]) => a.status === "running" || a.status === "idle");

  const selectedActivity = selectedRun ? activities?.[selectedRun] : null;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, handleClickOutside]);

  const handleSend = () => {
    if (!selectedRun || !message.trim()) return;
    sendIntervene(selectedRun, message.trim());
    setMessage("");
  };

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Intervene</h2>
          {activeEntries.length > 0 && <span className="flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />{activeEntries.length}</span>}
        </div>
      </div>

      {activeEntries.length === 0 ? (
        <div className="flex flex-col items-center py-3 text-gray-500 dark:text-zinc-600">
          <MessageSquare className="h-5 w-5 mb-1 opacity-30" />
          <p className="text-[10px]">No active runs</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 border text-left cursor-pointer transition-all ${dropdownOpen ? "ring-1 ring-blue-500/30 border-transparent" : "border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
            >
              {selectedActivity ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${selectedActivity.status === "running" ? "bg-blue-500 animate-pulse" : "bg-zinc-400"}`} />
                  <span className="truncate text-[10px] font-medium text-gray-900 dark:text-zinc-200">{selectedActivity.agentName || selectedRun.slice(0, 20)}</span>
                  <span className="text-[8px] text-gray-400 dark:text-zinc-600">{selectedActivity.steps.length} steps</span>
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">Select activity...</span>
              )}
              <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 dropdown-panel overflow-hidden animate-slide-in p-1.5 space-y-1">
                {activeEntries.map(([id, activity]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setSelectedRun(id); setDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border transition-all cursor-pointer text-left ${id === selectedRun ? "border-blue-500/30 bg-blue-500/5 ring-1 ring-blue-500/20" : "border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${activity.status === "running" ? "bg-blue-500 animate-pulse" : "bg-zinc-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-gray-900 dark:text-zinc-200 truncate">{activity.agentName || id.slice(0, 20)}</p>
                      <span className="text-[8px] text-gray-400 dark:text-zinc-600">{activity.steps.length} steps · {activity.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Stop after this step" rows={2} maxLength={10000} className="w-full text-[10px] bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700/50 px-2 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-500 resize-none text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600" />
            <p className="text-[8px] text-gray-400 dark:text-zinc-600 mt-0.5">{message.length}/10000</p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleSend} disabled={!selectedRun || !message.trim()} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Send className="h-3 w-3" /> Send
            </button>
            <button onClick={() => setConfirmStop(true)} disabled={!selectedRun}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Square className="h-2.5 w-2.5" /> Stop
            </button>
          </div>
        </div>
      )}
      {confirmStop && (
        <div className="mt-2 p-2 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5">
          <p className="text-[10px] text-red-700 dark:text-red-400 mb-1.5">Force-stop? Cannot be undone.</p>
          <div className="flex gap-1.5">
            <button onClick={() => setConfirmStop(false)} className="flex-1 rounded-lg px-2 py-1 text-[9px] font-medium text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
            <button onClick={() => { sendIntervene(selectedRun, JSON.stringify({ action: "stop", reason: "user-requested" })); setSelectedRun(""); setConfirmStop(false); }} className="flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[9px] font-medium text-white bg-red-600 hover:bg-red-500 transition-colors">
              <Square className="h-2.5 w-2.5" /> Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
})

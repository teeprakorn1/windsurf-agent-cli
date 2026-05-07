"use client";

import { memo, useState } from "react";
import { useWs } from "@/lib/ws-context";
import { Send, Square, MessageSquare } from "lucide-react";

export const InterventionPanel = memo(function InterventionPanel() {
  const { runs, completedRuns, sendIntervene } = useWs();
  const [selectedRun, setSelectedRun] = useState("");
  const [message, setMessage] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);

  const activeRuns = Object.keys(runs).filter(id => !completedRuns[id]);

  const handleSend = () => {
    if (!selectedRun || !message.trim()) return;
    sendIntervene(selectedRun, message.trim());
    setMessage("");
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <h2 className="section-title mb-0">Intervention</h2>
      </div>

      {activeRuns.length === 0 ? (
        <div className="flex flex-col items-center py-4 text-gray-500 dark:text-zinc-600">
          <MessageSquare className="h-6 w-6 mb-1.5 opacity-30" />
          <p className="text-xs">No active runs to intervene</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-600 dark:text-zinc-500 uppercase tracking-wider block mb-1">Target Run</label>
            <select value={selectedRun} onChange={(e) => setSelectedRun(e.target.value)} className="input-field">
              <option value="">Select run...</option>
              {activeRuns.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-600 dark:text-zinc-500 uppercase tracking-wider block mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Stop after this step" rows={2} maxLength={10000} className="input-field resize-none" />
            <p className="text-[10px] text-gray-500 dark:text-zinc-700 mt-0.5">{message.length}/10000</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSend} disabled={!selectedRun || !message.trim()} className="btn-primary flex-1 py-2 text-xs">
              <Send className="h-3.5 w-3.5" /> Send
            </button>
            <button onClick={() => setConfirmStop(true)} disabled={!selectedRun}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Square className="h-3 w-3" /> Stop
            </button>
          </div>
        </div>
      )}
      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmStop(false)} role="dialog" aria-modal="true" aria-label="Confirm stop">
          <div className="glass-card p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-200 mb-2">Stop Agent</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">Force-stop this run after the current step? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmStop(false)} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
              <button onClick={() => { sendIntervene(selectedRun, "STOP: Terminate after current step"); setSelectedRun(""); setConfirmStop(false); }} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-colors">
                <Square className="h-3 w-3" /> Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
})

"use client";

import { RotateCcw } from "lucide-react";

interface ResetDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetDialog({ open, onClose, onConfirm }: ResetDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm reset"
    >
      <div className="glass-card p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-200 mb-2">Reset Dashboard</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
          Clear all dashboard data and reload? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

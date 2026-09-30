import { AlertTriangle, Trash2 } from 'lucide-react';
import Dialog from './Dialog';

export default function ConfirmDialog({ title, confirmLabel, onCancel, onConfirm, children }) {
  return (
    <Dialog icon={AlertTriangle} title={title} onClose={onCancel}>
      <p className="text-sm text-crimson-300 leading-relaxed">{children}</p>
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-crimson-900/60 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 transition-all active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson-600 text-white text-xs font-black uppercase tracking-widest hover:bg-crimson-500 shadow-[0_8px_20px_rgba(255,0,60,0.3)] transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

import { AlertTriangle, Trash2 } from 'lucide-react';
import { listLabel } from './watchlists';

const DeleteListDialog = ({ name, onCancel, onConfirm }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    onClick={onCancel}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md bg-crimson-950 border border-crimson-900/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-7 space-y-5 animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-crimson-500/10 border border-crimson-500/30">
          <AlertTriangle className="w-6 h-6 text-crimson-400" />
        </div>
        <h3 className="text-xl font-black text-crimson-50 uppercase tracking-tight">Delete this list?</h3>
      </div>
      <p className="text-sm text-crimson-300 leading-relaxed">
        The <span className="font-black text-crimson-100">"{listLabel(name)}"</span> list will be removed and its shows unbound from it. The shows themselves stay in any other lists. This cannot be undone.
      </p>
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
          Delete List
        </button>
      </div>
    </div>
  </div>
);

export default DeleteListDialog;

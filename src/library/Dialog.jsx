import { useId } from 'react';

export default function Dialog({ icon: Icon, title, subtitle, onClose, children }) {
  const titleId = useId();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-crimson-950 border border-crimson-900/70 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-7 space-y-5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-crimson-500/10 border border-crimson-500/30">
            <Icon className="w-6 h-6 text-crimson-400" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-xl font-black text-crimson-50 uppercase tracking-tight leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-crimson-500 font-bold truncate">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

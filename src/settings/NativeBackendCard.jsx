import { Server, ArrowLeftRight } from 'lucide-react';
import { API_BASE_URL } from '../api/config';

export default function NativeBackendCard() {
  if (!window.CrimsonNative) return null;
  return (
    <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>
      <div className="space-y-3 relative z-10">
        <div className="flex items-center gap-3 text-crimson-500">
          <Server className="w-6 h-6" />
          <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Your Haven</h3>
        </div>
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
          This app is bound to <span className="text-crimson-300 font-bold break-all">{API_BASE_URL}</span>.
          Each haven keeps its own login, settings and downloads, so wandering to another
          one and back loses nothing.
        </p>
      </div>
      <button
        onClick={() => window.CrimsonNative.backends.manage()}
        className="relative z-10 px-7 py-4 rounded-2xl bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
      >
        <ArrowLeftRight className="w-4 h-4" /> Switch Haven
      </button>
    </div>
  );
}

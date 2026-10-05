import { ArrowLeftRight } from 'lucide-react';
import { API_BASE_URL } from '../api/config';

// Only the desktop app can change backends at runtime; the web build has its URL baked in.
export default function SwitchBackendLink() {
  if (!window.CrimsonNative) return null;
  return (
    <button
      onClick={() => window.CrimsonNative.backends.manage()}
      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-crimson-500 hover:text-crimson-300 transition-colors"
    >
      <ArrowLeftRight className="w-3.5 h-3.5" />
      {new URL(API_BASE_URL).host} · switch haven
    </button>
  );
}

export default function PlayerTitle({ title, visible }) {
  return (
    <div className={`absolute top-0 inset-x-0 px-4 sm:px-6 pt-5 pb-14 bg-gradient-to-b from-crimson-950/90 via-crimson-950/40 to-transparent flex items-center transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
      <div className="flex items-center gap-2.5 min-w-0 px-3.5 py-2 rounded-2xl bg-crimson-950/50 border border-crimson-500/20 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <span className="relative flex w-2 h-2 shrink-0">
          <span className="absolute inline-flex w-full h-full rounded-full bg-crimson-500 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c]" />
        </span>
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-crimson-50 truncate drop-shadow-lg">
          {title || 'Crimson Haven Manifest'}
        </span>
      </div>
    </div>
  );
}

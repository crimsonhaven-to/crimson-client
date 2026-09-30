export default function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-5">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
        <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600 animate-pulse">Summoning manifest</p>
    </div>
  );
}

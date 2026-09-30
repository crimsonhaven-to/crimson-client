const StatCard = ({ icon: Icon, value, label, detail }) => (
  <div className="relative overflow-hidden bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-7 rounded-[2rem] shadow-2xl">
    <div className="absolute -top-16 -right-16 w-40 h-40 bg-crimson-500/5 blur-[70px] rounded-full"></div>
    <div className="relative z-10 space-y-2">
      <Icon className="w-6 h-6 text-crimson-500" />
      <div className="text-4xl font-black text-crimson-50 tracking-tighter tabular-nums">{value}</div>
      <div className="text-[10px] font-black text-crimson-400 uppercase tracking-[0.2em]">{label}</div>
      {detail && (
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed pt-1">{detail}</p>
      )}
    </div>
  </div>
);

export default StatCard;

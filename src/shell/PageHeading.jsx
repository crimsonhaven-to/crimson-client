// The heading of a reading page (account, settings, info, admin). Hubs use the
// larger HubHeading from hubKit instead.
export default function PageHeading({ icon: Icon, title, accent, subtitle, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <h1 className={`text-4xl sm:text-5xl font-black text-crimson-50 uppercase tracking-tighter leading-none ${Icon ? 'flex items-center gap-4' : ''}`}>
        {Icon && <Icon className="w-10 h-10 shrink-0 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]" />}
        <span>{title}{accent && <> <span className="text-crimson-500">{accent}</span></>}</span>
      </h1>
      {subtitle && <p className="text-xs text-crimson-400 font-black uppercase tracking-[0.2em]">{subtitle}</p>}
    </div>
  );
}

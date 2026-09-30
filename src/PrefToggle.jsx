const PrefToggle = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    role="switch"
    aria-checked={active}
    aria-label={label}
    className={`relative w-16 h-9 rounded-full border transition-all duration-300 active:scale-95 shrink-0 ${
      active
        ? 'bg-crimson-600 border-crimson-400 shadow-[0_8px_20px_rgba(255,0,60,0.3)]'
        : 'bg-crimson-950/60 border-crimson-900/60'
    }`}
  >
    <span
      className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-md transition-all duration-300 ${
        active ? 'left-8' : 'left-1'
      }`}
    />
  </button>
);

export default PrefToggle;

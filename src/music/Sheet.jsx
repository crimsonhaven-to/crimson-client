// A bottom sheet on phones and a centred card from sm up; a click outside closes it.
export default function Sheet({ as: Panel = 'div', label, onClose, className = '', ...rest }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <Panel
        {...rest}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-crimson-950 border border-crimson-900/60 rounded-t-3xl sm:rounded-3xl shadow-2xl ${className}`}
      />
    </div>
  );
}

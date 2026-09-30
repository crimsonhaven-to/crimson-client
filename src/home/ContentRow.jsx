import { PosterCard } from '../browse/hubKit';

// A fixed tile width keeps each row one horizontal track instead of wrapping into a grid.
const ROW_TILE = 'shrink-0 snap-start w-32 sm:w-40 lg:w-44';
// Negative margins let the row bleed to the screen edge on mobile.
const ROW_TRACK = 'flex items-start gap-4 sm:gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

function RowSkeleton() {
  return (
    <div className={`${ROW_TRACK} animate-pulse`}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
        <div key={n} className={`${ROW_TILE} h-48 sm:h-60 lg:h-[16.5rem] bg-crimson-950/40 rounded-2xl border border-dashed border-crimson-900/50`}></div>
      ))}
    </div>
  );
}

export default function ContentRow({ icon, title, accent, subtitle, items, loading, onSelect, cta }) {
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-crimson-50 uppercase flex items-center gap-3">
            <span className="text-crimson-500 shrink-0">{icon}</span>
            <span className="truncate">{title} {accent && <span className="text-crimson-500">{accent}</span>}</span>
          </h2>
          {subtitle && (
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-crimson-600 truncate">{subtitle}</p>
          )}
        </div>
        {cta}
      </div>
      {loading ? (
        <RowSkeleton />
      ) : (
        <div className={ROW_TRACK}>
          {items.map((item, i) => (
            <div key={`${item.kind}-${item.tmdb_id ?? item.anilist_id}-${i}`} className={ROW_TILE}>
              <PosterCard item={item} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

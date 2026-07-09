// --- Live TV browse hub -------------------------------------------------------
// The browse home for the Live TV surface: the iptv-org catalogue of free-to-air
// broadcasts, served by the backend's iptv_engine. Channels aren't poster-shaped
// (logos are landscape marks on transparent PNGs), so this hub renders its own
// channel tile instead of PosterGrid — everything else (shell, chips, states)
// comes from the shared hubKit so it reads as one surface with the others.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tv, Radio, Globe2, Tag, ChevronDown } from 'lucide-react';
import { useLiveTvBrowse, useLiveTvChannels, useDebouncedValue, useTitle } from './hooks';
import {
  HubShell, ChipRow, Chip, SectionHeader, ArchiveSpinner, ArchiveError, EmptyState,
} from './hubKit';

// How many countries get a chip before the row collapses behind "More Realms"
// (the catalogue spans ~180 countries — the full row would swallow the page).
const COUNTRY_CHIP_LIMIT = 14;

// One channel tile: the broadcaster's mark on a glass slab (logos are landscape
// and often transparent, so object-contain on padding — never a cropped cover).
function ChannelCard({ channel, onSelect }) {
  return (
    <button onClick={() => onSelect(channel)} className="group text-left flex flex-col gap-2.5 w-full focus:outline-none">
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-crimson-900/10 border border-crimson-900/40 transition-[border-color,box-shadow,transform] duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_18px_40px_rgba(255,0,60,0.28)] group-hover:-translate-y-1">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={`${channel.name} logo`}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain p-5 transform-gpu transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-crimson-800">
            <Tv className="w-10 h-10 opacity-30" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-crimson-950/80 via-transparent to-transparent opacity-60" />

        {/* Live pulse — every tile here is a live broadcast. */}
        <span className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-crimson-950/70 backdrop-blur-sm border border-crimson-800/60">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-crimson-500 opacity-60 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-crimson-500" />
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-crimson-200">Live</span>
        </span>

        {channel.best_quality && (
          <span className="absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-crimson-950/70 backdrop-blur-sm border border-crimson-800/60 text-crimson-200 uppercase">
            {channel.best_quality}
          </span>
        )}

        {channel.country && (
          <span className="absolute bottom-2 left-2.5 text-[10px] font-black text-crimson-100/80 tracking-[0.18em] uppercase">
            {channel.country}
          </span>
        )}
      </div>
      <h4 className="text-xs sm:text-sm font-bold text-crimson-50 line-clamp-2 group-hover:text-crimson-400 transition-colors tracking-tight leading-snug px-0.5">
        {channel.name}
      </h4>
    </button>
  );
}

export default function LiveTvHub() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState(null);
  const [country, setCountry] = useState(null);
  const [allCountries, setAllCountries] = useState(false);
  useTitle('Live TV');

  // Search is server-side over the full catalogue — debounce the keystrokes so
  // we query once per pause, not once per letter.
  const q = useDebouncedValue(searchTerm.trim(), 300);

  const { facets, error: facetsError } = useLiveTvBrowse();
  const { channels, total, ready, loading, loadingMore, error, hasMore, loadMore } =
    useLiveTvChannels({ category, country, q });

  const categoryOptions = useMemo(
    () => (facets.categories || []).map((c) => ({ value: c.id, label: c.name, count: c.count })),
    [facets.categories],
  );
  // Countries arrive count-sorted from the backend; keep the selected one visible
  // even when the row is collapsed so the active chip never vanishes.
  const countryOptions = useMemo(() => {
    const all = (facets.countries || []).map((c) => ({
      value: c.code, label: `${c.flag ? `${c.flag} ` : ''}${c.name}`, count: c.count,
    }));
    if (allCountries) return all;
    const top = all.slice(0, COUNTRY_CHIP_LIMIT);
    if (country && !top.some((c) => c.value === country)) {
      const selected = all.find((c) => c.value === country);
      if (selected) top.push(selected);
    }
    return top;
  }, [facets.countries, allCountries, country]);

  const warming = !ready && !error;
  const subtitle = warming
    ? 'Tuning the crimson airwaves…'
    : facets.total
      ? `${facets.total.toLocaleString()} channels haunting the airwaves`
      : 'The world’s free-to-air broadcasts, on Lumi’s command';

  const controls = (
    <div className="space-y-6">
      <ChipRow
        icon={<Tag className="w-3.5 h-3.5" />} label="Rite"
        options={categoryOptions} value={category} onChange={setCategory}
      />
      {countryOptions.length > 0 && (
        <div className="pt-6 border-t border-crimson-900/20 flex flex-wrap items-center gap-2">
          <ChipRow
            icon={<Globe2 className="w-3.5 h-3.5" />} label="Realm"
            options={countryOptions} value={country} onChange={setCountry}
          />
          {(facets.countries || []).length > COUNTRY_CHIP_LIMIT && (
            <Chip small active={false} onClick={() => setAllCountries((v) => !v)}>
              <span className="inline-flex items-center gap-1">
                {allCountries ? 'Fewer Realms' : 'More Realms'}
                <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${allCountries ? 'rotate-180' : ''}`} />
              </span>
            </Chip>
          )}
        </div>
      )}
    </div>
  );

  return (
    <HubShell
      title="Live" accent="Airwaves" icon={<Radio className="w-4 h-4" />} subtitle={subtitle}
      search={searchTerm} onSearch={setSearchTerm} searchPlaceholder="Search the airwaves..."
      right={controls}
    >
      {facetsError || (error && channels.length === 0) ? (
        <ArchiveError error={facetsError || error} />
      ) : warming || loading ? (
        <ArchiveSpinner label="Tuning the crimson airwaves..." />
      ) : channels.length === 0 ? (
        <EmptyState label="No channel is broadcasting for that ritual tonight" />
      ) : (
        <div className="space-y-8 pb-24">
          <SectionHeader
            title="Airwaves" icon={<Tv className="w-5 h-5 text-crimson-500" />}
            count={`${channels.length} of ${total.toLocaleString()} channels`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {channels.map((ch) => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onSelect={(c) => navigate(`/watch-live/${encodeURIComponent(c.id)}`)}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900 text-white font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all shadow-[0_5px_15px_rgba(255,0,60,0.3)]"
              >
                {loadingMore ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Unsealing…</>
                ) : (
                  <>Reveal More <ChevronDown className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </HubShell>
  );
}

import { Sparkles, User, ShieldCheck, Crown } from 'lucide-react';
import { useSupporters, useTitle } from './hooks';

const SupportersPage = () => {
  const { supporters, stats, loading, error } = useSupporters();
  useTitle("Lumi's Favorite Mortals");

  return (
    <div className="max-w-4xl w-full mx-auto px-6 py-12 space-y-12 my-auto animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-crimson-500/10 rounded-full border border-crimson-500/20 mb-2">
          <Sparkles className="w-8 h-8 text-crimson-500 animate-pulse" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-sm">
          Lumi's Favorite <span className="text-crimson-500">Mortals</span>
        </h1>
        <p className="text-crimson-400 font-bold uppercase tracking-[0.3em] text-xs">
          The Blessed Contributors of the Haven
        </p>
      </div>

      {/* Stats Overview */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div className="bg-crimson-900/10 border border-crimson-900/40 p-6 rounded-2xl text-center backdrop-blur-sm">
            <p className="text-[10px] font-black text-crimson-500 uppercase tracking-widest mb-1">Active Mortals</p>
            <p className="text-3xl font-black text-white">{stats.supporter_count}</p>
          </div>
          <div className="bg-crimson-900/10 border border-crimson-900/40 p-6 rounded-2xl text-center backdrop-blur-sm">
            <p className="text-[10px] font-black text-crimson-500 uppercase tracking-widest mb-1">Sanctuary Growth</p>
            <p className="text-3xl font-black text-white">{stats.total_raised} <span className="text-sm font-bold text-crimson-400">{stats.currency}</span></p>
          </div>
        </div>
      )}

      {/* Supporters List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-crimson-400 font-bold uppercase tracking-widest text-[10px]">Summoning Mortal Records...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-crimson-950/80 border border-crimson-900 rounded-2xl text-center">
            <p className="text-crimson-500 font-bold">Failed to synchronize with the mortal plane.</p>
            <p className="text-xs text-crimson-400/60 mt-2 font-mono">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(supporters) && supporters.map((supporter, idx) => (
              <div 
                key={idx}
                className="group relative flex items-center gap-4 p-5 bg-crimson-950/40 border border-crimson-900/50 rounded-2xl hover:border-crimson-500/50 hover:bg-crimson-900/20 transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldCheck className="w-12 h-12 text-crimson-500" />
                </div>
                
                <div className="w-12 h-12 rounded-xl bg-crimson-500/10 border border-crimson-500/20 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-crimson-400 group-hover:text-crimson-500 transition-colors" />
                </div>

                <div className="space-y-1 relative">
                  {supporter.is_subscription && (
                    <Crown className="w-3.5 h-3.5 text-crimson-400 absolute -top-4 left-0 animate-bounce duration-1000" />
                  )}
                  <h3 className={`text-lg font-black text-white uppercase tracking-wide transition-all duration-300 ${
                    supporter.is_subscription 
                      ? 'group-hover:text-crimson-300 group-hover:drop-shadow-[0_0_12px_rgba(255,0,60,0.8)]' 
                      : 'group-hover:text-crimson-400'
                  }`}>
                    {supporter.name || 'Anonymous Mortal'}
                  </h3>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-crimson-500/20 text-crimson-400 rounded uppercase tracking-tighter border border-crimson-500/20">
                        {supporter.is_subscription ? 'Eternal Bond' : 'Soul Offering'}
                      </span>
                      <span className="text-[9px] text-crimson-400/60 font-mono">
                        {new Date(supporter.last_payment_at).toLocaleDateString()}
                      </span>
                    </div>
                    {supporter.message && supporter.message !== (supporter.is_subscription ? 'Eternal Bond' : 'Soul Offering') && (
                      <p className="text-[10px] text-crimson-300/60 italic line-clamp-1">
                        "{supporter.message}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {supporters.length === 0 && (
              <div className="col-span-full p-12 bg-crimson-900/5 border border-dashed border-crimson-900/40 rounded-2xl text-center">
                <p className="text-crimson-400/60 font-medium italic">No favored mortals have manifested yet...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="max-w-xl mx-auto text-center space-y-4">
        <p className="text-sm text-crimson-200/60 italic leading-relaxed">
          "Your offerings fuel the sanctuary's fires and keep the dark network nodes humming. 
          Every mortal listed here has earned a special place in the Haven."
        </p>
        <div className="pt-4">
          <a
            href="/support"
            className="inline-block px-8 py-3 bg-crimson-500 hover:bg-crimson-400 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg hover:shadow-crimson-500/20"
          >
            Join the Favored
          </a>
        </div>
      </div>
    </div>
  );
};

export default SupportersPage;

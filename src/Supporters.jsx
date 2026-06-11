import { Sparkles, User, ShieldCheck, Crown, ChevronRight } from 'lucide-react';
import { useSupporters, useTitle } from './hooks';

const SupportersPage = () => {
  const { supporters, stats, loading, error } = useSupporters();
  useTitle("Lumi's Favorite Mortals");

  return (
    <div className="max-w-4xl w-full mx-auto px-6 py-20 space-y-16 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Header Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center p-4 bg-crimson-500/10 rounded-[2rem] border border-crimson-500/20 mb-4 shadow-[0_0_30px_rgba(255,0,60,0.1)]">
          <Sparkles className="w-10 h-10 text-crimson-500 animate-pulse" />
        </div>
        <div className="space-y-3">
          <h1 className="text-5xl sm:text-7xl font-black text-white uppercase tracking-tighter drop-shadow-[0_10px_30px_rgba(255,0,60,0.2)]">
            Lumi's Favorite <span className="text-crimson-500">Mortals</span>
          </h1>
          <p className="text-crimson-400 font-black uppercase tracking-[0.4em] text-[10px] sm:text-xs opacity-80">
            The Blessed Contributors of the Haven
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/40 p-8 rounded-[2rem] text-center shadow-2xl group hover:border-crimson-500/30 transition-all">
            <p className="text-[10px] font-black text-crimson-700 uppercase tracking-[0.3em] mb-2 group-hover:text-crimson-500 transition-colors">Active Mortals</p>
            <p className="text-4xl font-black text-white tracking-tighter">{stats.supporter_count}</p>
          </div>
          <div className="bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/40 p-8 rounded-[2rem] text-center shadow-2xl group hover:border-crimson-500/30 transition-all">
            <p className="text-[10px] font-black text-crimson-700 uppercase tracking-[0.3em] mb-2 group-hover:text-crimson-500 transition-colors">Sanctuary Growth</p>
            <p className="text-4xl font-black text-white tracking-tighter">
              {stats.total_raised} <span className="text-sm font-black text-crimson-600 ml-1">{stats.currency}</span>
            </p>
          </div>
        </div>
      )}

      {/* Supporters List */}
      <div className="space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
              <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-crimson-400 font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">Summoning Mortal Records</p>
          </div>
        ) : error ? (
          <div className="p-10 bg-crimson-950/80 border border-crimson-900 rounded-[2.5rem] text-center shadow-2xl">
            <p className="text-crimson-500 font-black uppercase tracking-widest text-sm">Synchronization Failed</p>
            <p className="text-xs text-crimson-700 mt-4 font-mono opacity-60">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.isArray(supporters) && supporters.map((supporter, idx) => (
              <div 
                key={idx}
                className="group relative flex items-center gap-6 p-6 bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-[2rem] hover:border-crimson-500/40 hover:bg-crimson-900/20 transition-all duration-500 overflow-hidden shadow-xl"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ShieldCheck className="w-16 h-16 text-crimson-500" />
                </div>
                
                <div className="w-16 h-16 rounded-2xl bg-crimson-500/10 border border-crimson-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-crimson-500/20 transition-all duration-500">
                  <User className="w-8 h-8 text-crimson-600 group-hover:text-crimson-500" />
                </div>

                <div className="space-y-2 relative min-w-0">
                  {supporter.is_subscription && (
                    <div className="flex items-center gap-1.5 mb-1 text-crimson-500">
                       <Crown className="w-3.5 h-3.5 fill-current animate-pulse" />
                       <span className="text-[8px] font-black uppercase tracking-[0.3em]">Eternal Rank</span>
                    </div>
                  )}
                  <h3 className={`text-xl font-black text-white uppercase tracking-tight truncate transition-all duration-300 ${
                    supporter.is_subscription 
                      ? 'group-hover:text-crimson-400 group-hover:drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]' 
                      : 'group-hover:text-crimson-400'
                  }`}>
                    {supporter.name || 'Anonymous Mortal'}
                  </h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black px-2.5 py-1 bg-crimson-500/5 text-crimson-600 rounded-lg uppercase tracking-tighter border border-crimson-500/10">
                        {supporter.is_subscription ? 'Eternal Bond' : 'Soul Offering'}
                      </span>
                      <span className="text-[9px] text-crimson-700 font-black uppercase tracking-widest opacity-60">
                        {new Date(supporter.last_payment_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {supporter.message && supporter.message !== (supporter.is_subscription ? 'Eternal Bond' : 'Soul Offering') && (
                      <p className="text-[11px] text-crimson-100/40 italic line-clamp-1 font-medium group-hover:text-crimson-100/60 transition-colors">
                        "{supporter.message}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {supporters.length === 0 && (
              <div className="col-span-full p-20 bg-crimson-950/20 border border-dashed border-crimson-900/40 rounded-[3rem] text-center backdrop-blur-sm">
                <p className="text-crimson-800 font-black uppercase tracking-[0.3em] text-xs">No favored mortals have manifested yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="max-w-xl mx-auto text-center space-y-8 pt-10">
        <p className="text-sm sm:text-base text-crimson-100/50 italic leading-relaxed font-medium">
          "Your offerings fuel the sanctuary's fires and keep the dark network nodes humming. 
          Every mortal listed here has earned a special place in the Haven."
        </p>
        <div>
          <button
            onClick={() => navigate('/support')}
            className="group relative inline-flex items-center gap-3 bg-crimson-500 hover:bg-crimson-400 text-white font-black uppercase tracking-[0.3em] text-[10px] px-10 py-4 rounded-2xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:shadow-[0_15px_40px_rgba(255,0,60,0.5)] active:scale-95"
          >
            Join the Favored
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportersPage;

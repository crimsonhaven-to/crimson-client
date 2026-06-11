import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Play, Clock, Hash } from 'lucide-react';
import { useAccount, useAuth, useTitle } from './hooks';

const RecentlyWatchedPage = () => {
  const { recentlyWatched, loading } = useAccount();
  const { isAuthenticated } = useAuth();
  useTitle('Recent Echoes');
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <History className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">You must establish a link to track your watch progress across dimensions.</p>
          <button 
            onClick={() => navigate('/account')}
            className="mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all"
          >
            Establish Link
          </button>
        </div>
      </div>
    );
  }

  if (loading && recentlyWatched.length === 0) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Probing Watch History...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 animate-in fade-in duration-1000">
      <div className="border-b border-crimson-900/30 pb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tighter leading-none">
            Recent <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Echoes</span>
          </h1>
          <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
            <History className="w-4 h-4 text-crimson-500" />
            Picking up where you left off
          </p>
        </div>
      </div>

      {recentlyWatched.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recentlyWatched.map((item, idx) => {
            const progressPercent = Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100));
            return (
              <div 
                key={`${item.anilist_id}-${item.season_number}-${item.episode_number}-${idx}`}
                onClick={() => navigate(`/watch/${item.anilist_id}/${item.season_number}/${item.episode_number}`)}
                className="group relative flex gap-5 p-4 bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 rounded-3xl hover:border-crimson-500/50 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)] transition-all duration-300 cursor-pointer overflow-hidden"
              >
                {/* Subtle background glow on hover */}
                <div className="absolute -inset-24 bg-crimson-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                <div className="w-28 sm:w-36 aspect-[2/3] shrink-0 relative rounded-2xl overflow-hidden shadow-2xl border border-crimson-900/50">
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-transparent to-transparent opacity-60"></div>
                  
                  {/* Progress Bar (Integrated) */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-crimson-900/80">
                    <div 
                      className="h-full bg-crimson-500 shadow-[0_0_12px_rgba(255,0,60,0.8)] transition-all duration-1000" 
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex flex-col justify-between py-1 flex-grow min-w-0 relative z-10">
                  <div className="space-y-2">
                    <h4 className="text-base sm:text-lg font-black text-crimson-50 truncate group-hover:text-crimson-400 transition-colors tracking-tight">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-crimson-500/10 text-crimson-400 text-[10px] font-black uppercase rounded-lg border border-crimson-500/20 tracking-widest">
                        S{item.season_number} <span className="text-crimson-700 mx-0.5">•</span> E{item.episode_number}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {progressPercent}%
                      </span>
                      {item.status === 'completed' && (
                        <span className="text-crimson-400 bg-crimson-400/10 px-2 py-0.5 rounded-md border border-crimson-400/20">Finished</span>
                      )}
                    </div>
                    <button className="flex items-center gap-2.5 text-[10px] font-black text-white uppercase tracking-[0.2em] group-hover:translate-x-2 transition-all duration-300">
                      <span>Resume Journey</span>
                      <div className="p-1.5 rounded-full bg-crimson-500 shadow-[0_0_10px_rgba(255,0,60,0.5)]">
                        <Play className="w-3 h-3 fill-white" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-32 text-center space-y-8 bg-crimson-950/20 rounded-[3rem] border border-dashed border-crimson-900/30 backdrop-blur-sm">
          <div className="relative w-20 h-20 mx-auto opacity-30">
             <History className="w-20 h-20 text-crimson-900" />
          </div>
          <div className="space-y-2">
            <p className="text-crimson-500 font-black uppercase tracking-[0.3em] text-sm">No recent echoes detected</p>
            <p className="text-crimson-700 font-medium text-xs">Your journey through the dimensions has yet to begin.</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Start Streaming
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentlyWatchedPage;

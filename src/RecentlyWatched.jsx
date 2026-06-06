import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Play, Clock, Hash } from 'lucide-react';
import { useAccount, useAuth, useTitle } from './hooks';

const RecentlyWatchedPage = () => {
  const { continueWatching, loading } = useAccount();
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

  if (loading && continueWatching.length === 0) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Probing Watch History...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-in fade-in duration-700">
      <div className="border-b border-crimson-900/50 pb-6 flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
            Recent <span className="text-crimson-500">Echoes</span>
          </h1>
          <p className="text-crimson-400 font-medium tracking-wide flex items-center gap-2 text-xs sm:text-sm">
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-crimson-500" />
            Picking up where you left off.
          </p>
        </div>
      </div>

      {continueWatching.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {continueWatching.map((item, idx) => {
            const progressPercent = Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100));
            return (
              <div 
                key={`${item.anilist_id}-${item.season_number}-${item.episode_number}-${idx}`}
                onClick={() => navigate(`/watch/${item.anilist_id}/${item.season_number}/${item.episode_number}`)}
                className="bg-crimson-900/10 border border-crimson-900/40 rounded-2xl overflow-hidden hover:border-crimson-500 transition-all group cursor-pointer flex gap-4 p-3 relative"
              >
                <div className="w-24 sm:w-32 aspect-[2/3] shrink-0 relative rounded-lg overflow-hidden shadow-2xl">
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-crimson-950/20 group-hover:bg-transparent transition-colors"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-crimson-900">
                    <div className="h-full bg-crimson-500 shadow-[0_0_8px_rgba(255,0,60,0.8)]" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>

                <div className="flex flex-col justify-between py-1 flex-grow min-w-0">
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-crimson-400 transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-crimson-500/20 text-crimson-400 text-[10px] font-black uppercase rounded-md border border-crimson-500/20">
                        S{item.season_number} E{item.episode_number}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-crimson-600">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {progressPercent}% Complete</span>
                      {item.status === 'completed' && <span className="text-green-500">Finished</span>}
                    </div>
                    <button className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                      Resume <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center space-y-4 bg-crimson-900/5 rounded-3xl border border-dashed border-crimson-900/30">
          <History className="w-12 h-12 text-crimson-900 mx-auto" />
          <p className="text-crimson-700 italic text-lg">No recent echoes detected.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2 border border-crimson-900 text-crimson-500 hover:border-crimson-500 transition-all rounded-xl text-sm font-bold uppercase tracking-widest"
          >
            Start Streaming
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentlyWatchedPage;

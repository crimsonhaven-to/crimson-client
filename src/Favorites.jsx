import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Trash2, Hash } from 'lucide-react';
import { useAccount, useAuth, useTitle } from './hooks';

const FavoritesPage = () => {
  const { favorites, loading, toggleFavorite } = useAccount();
  const { isAuthenticated } = useAuth();
  useTitle('Saved Manifestations');
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <Heart className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white uppercase">Authentication Required</h2>
          <p className="text-crimson-300 mt-2">You must establish a link to view your favorited manifestations.</p>
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

  if (loading && favorites.length === 0) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Retrieving Favorites...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 animate-in fade-in duration-1000">
      <div className="border-b border-crimson-900/30 pb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tighter leading-none">
            Saved <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Manifestations</span>
          </h1>
          <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
            <Heart className="w-4 h-4 text-crimson-500 fill-crimson-500" />
            {favorites.length} items bound to your identity
          </p>
        </div>
      </div>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-8">
          {favorites.map((anime) => (
            <div 
              key={anime.anilist_id || anime.tmdb_id} 
              className="group relative flex flex-col"
            >
              <div className="aspect-[2/3] relative overflow-hidden rounded-2xl border border-crimson-900/40 shadow-2xl transition-all duration-500 group-hover:border-crimson-500/50 group-hover:shadow-[0_0_30px_rgba(255,0,60,0.2)]">
                <img 
                  src={anime.poster} 
                  alt={anime.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-crimson-950/20 to-transparent opacity-80"></div>
                
                {/* Actions Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-crimson-950/40 backdrop-blur-[2px]">
                  <button 
                    onClick={() => navigate(`/anime/${anime.anilist_id || anime.tmdb_id}`)}
                    className="p-4 bg-crimson-500 text-white rounded-full hover:bg-crimson-400 transform hover:scale-110 transition-all shadow-[0_10px_20px_rgba(255,0,60,0.4)]"
                  >
                    <Play className="w-6 h-6 fill-current" />
                  </button>
                  <button 
                    onClick={() => toggleFavorite(anime)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-crimson-950/80 text-[10px] font-black uppercase tracking-widest text-crimson-400 rounded-full border border-crimson-900 hover:text-white hover:border-crimson-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Unbind</span>
                  </button>
                </div>

                {/* Quick Info Badge */}
                <div className="absolute bottom-3 left-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                   <p className="text-[8px] font-black uppercase tracking-[0.2em] text-crimson-400 text-center bg-crimson-950/80 backdrop-blur-md py-1 rounded-md border border-crimson-900/50">
                     Ref: {anime.anilist_id || anime.tmdb_id}
                   </p>
                </div>
              </div>
              <div className="mt-4 px-1">
                <h4 className="text-sm font-bold text-crimson-50 line-clamp-1 group-hover:text-crimson-400 transition-colors tracking-tight">
                  {anime.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-32 text-center space-y-8 bg-crimson-950/20 rounded-[3rem] border border-dashed border-crimson-900/30 backdrop-blur-sm">
          <div className="relative w-20 h-20 mx-auto">
             <div className="absolute inset-0 bg-crimson-500/10 blur-2xl rounded-full"></div>
             <Heart className="relative w-20 h-20 text-crimson-950 fill-crimson-900/20" />
          </div>
          <div className="space-y-2">
            <p className="text-crimson-500 font-black uppercase tracking-[0.3em] text-sm">Your library is currently empty</p>
            <p className="text-crimson-700 font-medium text-xs">No manifestations have been bound to your identity yet.</p>
          </div>
          <button 
            onClick={() => navigate('/catalogue')}
            className="px-10 py-3 bg-crimson-950 border border-crimson-900 text-crimson-500 hover:border-crimson-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
          >
            Explore the Catalogue
          </button>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;

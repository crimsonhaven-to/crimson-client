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
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-in fade-in duration-700">
      <div className="border-b border-crimson-900/50 pb-6 flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
            Saved <span className="text-crimson-500">Manifestations</span>
          </h1>
          <p className="text-crimson-400 font-medium tracking-wide flex items-center gap-2 text-xs sm:text-sm">
            <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-crimson-500 text-crimson-500" />
            {favorites.length} items bound to your identity.
          </p>
        </div>
      </div>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {favorites.map((anime) => (
            <div 
              key={anime.anilist_id || anime.tmdb_id} 
              className="bg-crimson-900/10 border border-crimson-900/40 rounded-xl overflow-hidden hover:border-crimson-500 transition-all group relative"
            >
              <div className="aspect-[2/3] relative overflow-hidden">
                <img 
                  src={anime.poster} 
                  alt={anime.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-crimson-950 via-transparent to-transparent opacity-60"></div>
                
                {/* Actions Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-crimson-950/60 backdrop-blur-[2px]">
                  <button 
                    onClick={() => navigate(`/anime/${anime.anilist_id || anime.tmdb_id}`)}
                    className="p-3 bg-crimson-500 text-white rounded-full hover:bg-crimson-400 transform hover:scale-110 transition-all"
                  >
                    <Play className="w-6 h-6 fill-current" />
                  </button>
                  <button 
                    onClick={() => toggleFavorite(anime)}
                    className="p-2 bg-crimson-900/80 text-crimson-400 rounded-full hover:text-white hover:bg-crimson-800 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-crimson-400 transition-colors">
                  {anime.title}
                </h4>
                <p className="text-[10px] text-crimson-600 font-black uppercase mt-1">ID: {anime.anilist_id || anime.tmdb_id}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center space-y-4 bg-crimson-900/5 rounded-3xl border border-dashed border-crimson-900/30">
          <Hash className="w-12 h-12 text-crimson-900 mx-auto" />
          <p className="text-crimson-700 italic text-lg">Your library is currently empty.</p>
          <button 
            onClick={() => navigate('/catalogue')}
            className="px-6 py-2 border border-crimson-900 text-crimson-500 hover:border-crimson-500 transition-all rounded-xl text-sm font-bold uppercase tracking-widest"
          >
            Browse Catalogue
          </button>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;

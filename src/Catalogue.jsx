import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronRight, Hash, Calendar, BookOpen } from 'lucide-react';
import { useCatalogue, useTitle } from './hooks';

const CataloguePage = () => {
  const { catalogue, loading, error } = useCatalogue();
  useTitle('The Catalogue');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeGenre, setActiveGenre] = useState('ALL');
  const navigate = useNavigate();

  // Filter and categorize animes
  const filteredAnimes = useMemo(() => {
    let result = catalogue.animes;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(anime =>
        (anime.title || '').toLowerCase().includes(lowerSearch) ||
        (anime.title_romaji || '').toLowerCase().includes(lowerSearch) ||
        (anime.title_english || '').toLowerCase().includes(lowerSearch)
      );
    }

    if (activeCategory !== 'ALL') {
      result = result.filter(anime => anime.category === activeCategory);
    }

    if (activeGenre !== 'ALL') {
      result = result.filter(anime => (anime.genres || []).includes(activeGenre));
    }

    return result;
  }, [catalogue.animes, searchTerm, activeCategory, activeGenre]);

  // Group filtered animes by category
  const groupedAnimes = useMemo(() => {
    const groups = {};
    filteredAnimes.forEach(anime => {
      const cat = anime.category || 'UNKNOWN';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(anime);
    });
    // Sort categories alphabetically but keep TV first if it exists
    return Object.keys(groups).sort((a, b) => {
      if (a === 'TV') return -1;
      if (b === 'TV') return 1;
      return a.localeCompare(b);
    }).map(key => ({
      name: key,
      animes: groups[key].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }));
  }, [filteredAnimes]);

  if (loading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-6 py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-crimson-400 font-bold animate-pulse tracking-widest uppercase text-sm">Accessing Royal Archives...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 text-center space-y-6">
        <div className="bg-crimson-900/20 border border-crimson-500/50 p-8 rounded-2xl">
          <Hash className="w-12 h-12 text-crimson-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white uppercase">Archive Link Severed</h2>
          <p className="text-crimson-300 mt-2">The librarians cannot reach the requested records: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-crimson-500 hover:bg-crimson-400 text-white font-bold rounded-xl transition-all"
          >
            Retry Ritual
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 sm:space-y-16 my-auto animate-in fade-in duration-1000">
      {/* Header Section */}
      <div className="space-y-8 border-b border-crimson-900/30 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tighter leading-none">
              The <span className="text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]">Catalogue</span>
            </h1>
            <p className="text-crimson-400 font-black tracking-[0.2em] flex items-center gap-2 text-[10px] sm:text-xs uppercase opacity-80">
              <BookOpen className="w-4 h-4 text-crimson-500" />
              Browsing {catalogue.total} registered manifestations
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative group max-w-lg w-full">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
              <Search className="w-5 h-5 text-crimson-500 opacity-50 group-focus-within:opacity-100 transition-opacity" />
            </div>
            <input 
              type="text" 
              placeholder="Search Archives..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-crimson-950/30 border border-crimson-900/50 rounded-2xl py-4 pl-14 pr-6 text-crimson-50 placeholder-crimson-800 focus:outline-none focus:border-crimson-500 focus:shadow-[0_0_30px_rgba(255,0,60,0.1)] transition-all font-bold tracking-wide backdrop-blur-md text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 pt-2 no-scrollbar">
            <button 
              onClick={() => setActiveCategory('ALL')}
              className={`px-5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
                activeCategory === 'ALL' 
                  ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15px_rgba(255,0,60,0.3)]' 
                  : 'bg-crimson-950/40 border-crimson-900/40 text-crimson-400 hover:border-crimson-700 hover:bg-crimson-900/20'
              }`}
            >
              All Types
            </button>
            {catalogue.categories.map(cat => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category)}
                className={`px-5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
                  activeCategory === cat.category
                    ? 'bg-crimson-600 border-crimson-400 text-white shadow-[0_5px_15_rgba(255,0,60,0.3)]'
                    : 'bg-crimson-950/40 border-crimson-900/40 text-crimson-400 hover:border-crimson-700 hover:bg-crimson-900/20'
                }`}
              >
                {cat.category} <span className="opacity-40 ml-1.5 font-mono text-[9px]">({cat.count})</span>
              </button>
            ))}
          </div>

          {/* Genre Filters */}
          {(catalogue.genres || []).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 no-scrollbar border-t border-crimson-900/20 pt-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 mr-2 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filter by Genre
              </span>
              <button
                onClick={() => setActiveGenre('ALL')}
                className={`px-4 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                  activeGenre === 'ALL'
                    ? 'bg-crimson-500/20 border-crimson-500/50 text-crimson-400 shadow-[0_0_10px_rgba(255,0,60,0.1)]'
                    : 'bg-crimson-900/10 border-crimson-900/30 text-crimson-700 hover:border-crimson-700 hover:text-crimson-500'
                }`}
              >
                All
              </button>
              {(catalogue.genres || []).map(g => (
                <button
                  key={g.genre}
                  onClick={() => setActiveGenre(g.genre === activeGenre ? 'ALL' : g.genre)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                    activeGenre === g.genre
                      ? 'bg-crimson-500/20 border-crimson-500/50 text-crimson-400 shadow-[0_0_10px_rgba(255,0,60,0.1)]'
                      : 'bg-crimson-900/10 border-crimson-900/30 text-crimson-700 hover:border-crimson-700 hover:text-crimson-500'
                  }`}
                >
                  {g.genre} <span className="opacity-40 ml-1 font-mono text-[8px]">({g.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Anime List Sections */}
      <div className="space-y-20 pb-24">
        {groupedAnimes.length > 0 ? (
          groupedAnimes.map(group => (
            <div key={group.name} className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-6">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter bg-crimson-950/40 px-6 py-2 rounded-2xl border border-crimson-900/40 backdrop-blur-md shadow-xl">
                  {group.name}
                </h3>
                <div className="h-px bg-gradient-to-r from-crimson-900/50 to-transparent flex-grow" />
                <span className="text-[10px] font-black text-crimson-700 uppercase tracking-[0.3em]">
                  {group.animes.length} Entries
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-3">
                {group.animes.map(anime => (
                  <button
                    key={anime.anilist_id}
                    onClick={() => navigate(`/anime/${anime.anilist_id}`)}
                    className="flex items-center justify-between group p-3.5 hover:bg-crimson-900/10 rounded-2xl transition-all border border-transparent hover:border-crimson-900/30 text-left"
                  >
                    <div className="flex flex-col truncate pr-6 space-y-1">
                      <span className="text-crimson-50 font-bold group-hover:text-crimson-400 transition-colors truncate tracking-tight text-base">
                        {anime.title || anime.title_romaji || anime.title_english}
                      </span>
                      <div className="flex items-center gap-4 text-[10px] text-crimson-700 font-black uppercase tracking-widest mt-1">
                        <span className="flex items-center gap-1.5 opacity-80">
                          <Calendar className="w-3.5 h-3.5 text-crimson-600" /> {anime.year || 'N/A'}
                        </span>
                        <span className="opacity-40 font-mono text-[9px]">ID {anime.anilist_id}</span>
                      </div>
                      {(anime.genres || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {anime.genres.slice(0, 3).map(g => (
                            <span
                              key={g}
                              className="px-2 py-0.5 rounded-md bg-crimson-500/5 border border-crimson-500/20 text-[8px] font-black uppercase tracking-widest text-crimson-500/80"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-2 rounded-full bg-crimson-900/20 group-hover:bg-crimson-500 transition-all duration-300">
                      <ChevronRight className="w-4 h-4 text-crimson-800 group-hover:text-white transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-32 text-center space-y-6">
            <div className="w-16 h-16 border-2 border-dashed border-crimson-900/40 rounded-full mx-auto flex items-center justify-center opacity-40">
              <Search className="w-8 h-8 text-crimson-900" />
            </div>
            <p className="text-crimson-700 font-black uppercase tracking-[0.2em] text-sm">No manifestation matches your search ritual</p>
          </div>
        )}
      </div>
    </div>
  );
};
    </div>
  );
};

export default CataloguePage;

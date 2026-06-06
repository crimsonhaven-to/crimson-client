import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronRight, Hash, Calendar, BookOpen } from 'lucide-react';
import { useCatalogue, useTitle } from './hooks';

const CataloguePage = () => {
  const { catalogue, loading, error } = useCatalogue();
  useTitle('The Catalogue');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
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

    return result;
  }, [catalogue.animes, searchTerm, activeCategory]);

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
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:y-10 my-auto animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="space-y-6 sm:space-y-4 border-b border-crimson-900/50 pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
              The <span className="text-crimson-500 font-light">Catalogue</span>
            </h1>
            <p className="text-crimson-400 font-medium tracking-wide flex items-center gap-2 text-xs sm:text-sm">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Browsing {catalogue.total} registered manifestations.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative group max-w-md w-full">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-crimson-500/50 group-focus-within:text-crimson-500 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Search Archives..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-crimson-950/50 border-2 border-crimson-900 rounded-2xl py-2.5 sm:py-3 pl-10 sm:pl-12 pr-4 text-crimson-100 placeholder-crimson-700 focus:outline-none focus:border-crimson-500 transition-all font-medium backdrop-blur-sm text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 pt-2 sm:pt-4 no-scrollbar">
          <button 
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest border transition-all ${
              activeCategory === 'ALL' 
                ? 'bg-crimson-500 border-crimson-400 text-white shadow-[0_0_15px_rgba(255,0,60,0.3)]' 
                : 'bg-crimson-900/20 border-crimson-900 text-crimson-400 hover:border-crimson-700'
            }`}
          >
            All
          </button>
          {catalogue.categories.map(cat => (
            <button 
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest border transition-all ${
                activeCategory === cat.category 
                  ? 'bg-crimson-500 border-crimson-400 text-white shadow-[0_0_15px_rgba(255,0,60,0.3)]' 
                  : 'bg-crimson-900/20 border-crimson-900 text-crimson-400 hover:border-crimson-700'
              }`}
            >
              {cat.category} <span className="opacity-50 ml-1">[{cat.count}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* Anime List Sections */}
      <div className="space-y-12 pb-20">
        {groupedAnimes.length > 0 ? (
          groupedAnimes.map(group => (
            <div key={group.name} className="space-y-6">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-white uppercase tracking-widest bg-crimson-900/30 px-4 py-1 rounded-lg border border-crimson-900/50">
                  {group.name}
                </h3>
                <div className="h-px bg-crimson-900/30 flex-grow" />
                <span className="text-xs font-mono text-crimson-600 font-bold uppercase tracking-widest">
                  {group.animes.length} entries
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                {group.animes.map(anime => (
                  <button
                    key={anime.anilist_id}
                    onClick={() => navigate(`/watch/${anime.anilist_id}/${anime.season_number || 1}/1`)}
                    className="flex items-center justify-between group p-2 hover:bg-crimson-900/20 rounded-lg transition-all border-b border-transparent hover:border-crimson-900/50 text-left"
                  >
                    <div className="flex flex-col truncate pr-4">
                      <span className="text-crimson-100 font-bold group-hover:text-crimson-400 transition-colors truncate">
                        {anime.title || anime.title_romaji || anime.title_english}
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-crimson-600 font-black uppercase tracking-widest mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {anime.year || 'N/A'}
                        </span>
                        <span className="opacity-50 text-[8px]">ID: {anime.anilist_id}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-crimson-900 group-hover:text-crimson-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center">
            <p className="text-crimson-500 italic text-lg">No manifestation matches your search ritual.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CataloguePage;

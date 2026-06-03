import React, { useState, useEffect, useCallback } from 'react';
import { Search, Play, HelpCircle, Film, Info, AlertTriangle, ChevronRight, Server } from 'lucide-react';

//TODO: When in Prod, I need to change the API URL
const API_BASE_URL = 'http://localhost:8000'; 

function App() {
    // Navigation Routing States: 'landing' | 'watch' | 'about'
    const [currentView, setCurrentView] = useState('landing');
    
    // Search state (Name Query)
    const [queryName, setQueryName] = useState('');
    // Suggestions state for autocomplete
    const [searchResults, setSearchResults] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Runtime operational tracking states
    const [selectedTmdbId, setSelectedTmdbId] = useState(null);
    const [selectedAnilistId, setSelectedAnilistId] = useState(null);
    const [currentEpisode, setCurrentEpisode] = useState(1);
    const [activeStreamIdx, setActiveStreamIdx] = useState(0);

    // Consolidated Data Fetching States
    const [animeMetadata, setAnimeMetadata] = useState(null);
    const [streamData, setStreamData] = useState(null);
    
    const [metaLoading, setMetaLoading] = useState(false);
    const [trendingAnimes, setTrendingAnimes] = useState([]); //State for trending data
    const [trendLoading, setTrendLoading] = useState(true);
    const [apiError, setApiError] = useState(null);

    // State needed for streaming component logic
    const [streamLoading, setStreamLoading] = useState(false);


// --- HANDLER FUNCTIONS (CORE LOGIC) ---

/** * Handles autocomplete suggestions by querying the backend /search/anime endpoint.
 */
const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) return [];
    try {
        // Using encodeURIComponent for safety in URL queries
        const res = await fetch(`${API_BASE_URL}/search/anime?query_name=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Failed to fetch search suggestions.");
        return res.json().suggestions || [];
    } catch (e) {
        console.error("Search suggestion error:", e);
        setApiError(e.message);
        return [];
    }
}, []);


/** * Handles selection from the autocomplete dropdown. This is the main logic update.
 */
const handleSelectSuggestion = async (suggestion) => {
    setQueryName(suggestion.title); // Set name to selected title
    setShowSuggestions(false);

    // Since the backend has already performed the TMDB->AniList mapping, 
    // we can now proceed directly to fetch metadata using the provided IDs.
    setMetaLoading(true);
    setApiError(null);
    setAnimeMetadata(null);

    // Set both TMDB and AniList IDs simultaneously
    setSelectedTmdbId(suggestion.tmdb_id);
    setSelectedAnilistId(suggestion.anilist_id);

    // Trigger the metadata fetch (Endpoint 1)
    try {
        const res = await fetch(`${API_BASE_URL}/info/${suggestion.tmdb_id}`);
        if (!res.ok) throw new Error("Anime metadata mapping not found in database.");
        return res.json();
    } catch (err) {
        console.error(err);
        setApiError('Metadata mapping failed to load. Check network connectivity or ID.');
    } finally {
        setMetaLoading(false);
    }

    setCurrentEpisode(1); // Default to first episode
    setCurrentView('watch');
};


/**
 * Handles submission of the search form (if user hits enter instead of clicking suggestion).
 */
/**
 * Handles submission of the search form (if user hits enter instead of clicking suggestion).
 */
const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!queryName.trim()) return;

    // 1. If we have autocomplete suggestions ready, automatically pick the first choice
    if (searchResults.length > 0 && !selectedAnilistId) {
        const firstSuggestion = searchResults[0];
        await handleSelectSuggestion(firstSuggestion);
    } else {
        // 2. Fallback: Treat the raw input text as a TMDB ID lookup
        setMetaLoading(true);
        setApiError(null);
        setAnimeMetadata(null);
        setSelectedTmdbId(queryName.trim());

        fetch(`${API_BASE_URL}/info/${encodeURIComponent(queryName.trim())}`)
            .then((res) => {
                if (!res.ok) throw new Error('Anime metadata mapping not found in database.');
                return res.json();
            })
            .then((data) => {
                // CRITICAL FIX: You need to store the metadata data payload here!
                setAnimeMetadata(data);
                setSelectedAnilistId(data.anilist_id);
                setCurrentEpisode(1); // Default to first episode
                setCurrentView('watch'); // Transition viewport
                setMetaLoading(false);
            })
            .catch((err) => {
                console.error('Search Submit Error:', err);
                setApiError(err.message || 'Failed to fetch anime data.');
                setMetaLoading(false);
            });
    }
};


// LIFECYCLE HOOKS

useEffect(() => {
    if (!selectedAnilistId) return;

    setStreamLoading(true);
    setStreamData(null);
    setActiveStreamIdx(0); // Reset fallback source pointer

    fetch(`${API_BASE_URL}/watch/${selectedAnilistId}/${currentEpisode}`)
        .then((res) => {
            if (!res.ok) throw new Error('Could not resolve streaming sources for this episode.');
            return res.json();
        })
        .then((data) => {
            setStreamData(data);
            setStreamLoading(false);
        })
        .catch((err) => {
            console.error('Stream fetch error:', err);
            setStreamLoading(false);
        });
}, [selectedAnilistId, currentEpisode]);


/**
 * Fetches the initial list of trending anime on component mount.
 */
useEffect(() => {
    const fetchTrending = async () => {
        setTrendLoading(true);
        setApiError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/trending`);
            if (!res.ok) throw new Error('Failed to fetch trending data.');
            const data = await res.json();
            if (data.success && Array.isArray(data.animes)) {
                setTrendingAnimes(data.animes);
            } else {
                console.warn('Backend returned no valid trending data:', data);
            }
        } catch (e) {
            console.error('Error fetching trending anime:', e);
            setApiError('Could not load popular titles.');
        } finally {
            setTrendLoading(false);
        }
    };

    fetchTrending();
}, []);


// RENDER HELPERS FOR REUSABILITY

/**
 * Component for displaying a single suggestion/trending item.
 */
const AnimeCard = ({ title, poster, onSelect }) => (
    <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-crimson-900/20 transition-colors border-b border-crimson-900/50"
        onClick={onSelect}
    >
        <div className="flex items-center gap-3">
            {poster ? (
                <img src={poster} alt="" className="w-12 h-auto object-cover rounded shadow-lg flex-shrink-0" />
            ) : (
                <div className="w-12 h-16 bg-crimson-900/30 flex items-center justify-center text-sm text-crimson-400">No Poster</div>
            )}
            <span className={`text-base font-semibold ${selectedAnilistId ? 'text-white' : 'text-crimson-300'} truncate`}>
                {title}
            </span>
        </div>
        <ChevronRight className="w-4 h-4 text-crimson-700" />
    </div>
);


// MAIN RENDER FUNCTION
return (
    <>
        <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
            {/* Background Ambience Texture */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(92,5,20,0.15)_0%,transparent_70%)] pointer-events-none z-0" />

            {/* Shared Navigation Header */}
            <nav className="border-b border-crimson-900/60 bg-crimson-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-md">
                <div
                    onClick={() => {
                        setCurrentView('landing');
                        setApiError(null);
                    }}
                    className="flex items-center space-x-2 cursor-pointer group"
                >
                    <span className="text-2xl font-black tracking-tighter text-crimson-500 group-hover:text-crimson-400 transition-colors">
                        crimson<span className="text-crimson-100 font-light">haven</span>
                    </span>
                </div>
                <div className="flex space-x-6 text-sm font-medium items-center">
                    <button
                        onClick={() => setCurrentView('landing')}
                        className={`transition-colors flex items-center gap-1.5 ${
                            currentView === 'landing' ? 'text-crimson-500 font-bold' : 'text-crimson-200/70 hover:text-crimson-400'
                        }`}
                    >
                        <Film className="w-4 h-4" /> Search Home
                    </button>
                    <button
                        onClick={() => setCurrentView('about')}
                        className={`transition-colors flex items-center gap-1.5 ${
                            currentView === 'about' ? 'text-crimson-500 font-bold' : 'text-crimson-200/70 hover:text-crimson-400'
                        }`}
                    >
                        <HelpCircle className="w-4 h-4" /> About Us
                    </button>
                </div>
            </nav>

            {/* Dynamic Content Frame */}
            <div className="flex-grow z-10 flex flex-col justify-center">
                {/* VIEW 1: CLEAN LANDING PAGE */}
                {currentView === 'landing' && (
                    <div className="max-w-3xl w-full mx-auto px-6 py-20 text-center space-y-8 my-auto">
                        <div className="space-y-3">
                            <h1 className="text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(255,0,60,0.15)]">
                                crimson<span className="text-crimson-500 font-light">haven</span>
                            </h1>
                            <p className="text-crimson-300 text-lg tracking-wide font-medium">
                                Stream dynamic links seamlessly straight from the dark network.
                            </p>
                        </div>

                        {/* SEARCH BAR CONTAINER (FIXED JSX STRUCTURE) */}
                        <div className="relative max-w-xl mx-auto group">
                            <form onSubmit={handleSearchSubmit} className="flex items-end space-x-2 border-2 border-crimson-900/80 rounded-2xl shadow-2xl bg-crimson-900/30 transition-all">
                                <input
                                    type="text" 
                                    placeholder="Enter Anime Name (e.g., The Eminence in Shadow)..."
                                    value={queryName}
                                    onChange={async (e) => {
                                        const val = e.target.value;
                                        setQueryName(val);
                                        
                                        // Show suggestions if query is long enough, hide otherwise
                                        if (val.length >= 3 && val.trim() !== '') {
                                            setShowSuggestions(true);
                                            
                                            // CRITICAL: Fetch data from backend and update searchResults state
                                            const suggestions = await fetchSuggestions(val);
                                            setSearchResults(suggestions);
                                        } else {
                                            setShowSuggestions(false);
                                            setSearchResults([]);
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                                    className="w-full text-white py-4 px-5 focus:outline-none placeholder-crimson-700/80 font-medium tracking-wide appearance-none"
                                />
                                <button
                                    type="submit"
                                    disabled={metaLoading}
                                    className="bg-crimson-500 hover:bg-crimson-400 disabled:bg-crimson-800 text-white px-6 rounded-r-2xl transition-all shadow-md flex items-center justify-center"
                                >
                                    {metaLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Search className="w-5 h-5" />
                                    )}
                                </button>
                            </form>

                            {/* Autocomplete Dropdown */}
                            {showSuggestions && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-crimson-950 border-b border-crimson-800 shadow-xl max-h-[300px] overflow-y-auto z-20">
                                    {searchResults.map((suggestion, index) => (
                                        <AnimeCard key={index} title={suggestion.title} poster={suggestion.poster} onSelect={() => handleSelectSuggestion(suggestion)} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Error display for search/trending */}
                        {apiError && (
                            <div className="max-w-md mx-auto p-4 bg-crimson-900/40 border border-crimson-500/30 rounded-xl text-sm text-crimson-300 flex items-center gap-3 shadow-lg mt-8">
                                <AlertTriangle className="w-5 h-5 text-crimson-500 shrink-0" />
                                <span className="text-left">Error: {apiError}</span>
                            </div>
                        )}

                        {/* TRENDING ANIME SECTION */}
                        <div className="mt-16 pt-8 border-t border-crimson-900/50">
                            <h2 className="text-3xl font-black tracking-tight text-white uppercase mb-6 flex items-center gap-2">
                                <Play className="w-6 h-6 text-crimson-500" /> Trending Streams <span className="text-base font-normal opacity-70">({trendingAnimes.length} Results)</span>
                            </h2>

                            {/* Loading State */}
                            {trendLoading && (
                                <div className="flex justify-center space-x-6 animate-pulse text-crimson-300">
                                    <div className="w-[150px] h-48 bg-gray-700/30 rounded-lg flex-shrink-0 border border-dashed border-crimson-900/50"></div>
                                    <div className="w-[150px] h-48 bg-gray-700/30 rounded-lg flex-shrink-0 border border-dashed border-crimson-900/50"></div>
                                    <div className="w-[150px] h-48 bg-gray-700/30 rounded-lg flex-shrink-0 border border-dashed border-crimson-900/50"></div>
                                </div>
                            )}

                            {/* Error State */}
                            {!trendLoading && apiError && (
                                <div className="text-center text-red-400 p-4 bg-crimson-900/20 rounded-lg">Trending data failed to load. ({apiError})</div>
                            )}

                            {/* Success State */}
                            {!trendLoading && trendingAnimes.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                                    {trendingAnimes.map((anime, index) => (
                                        <div key={index} className="bg-crimson-900/10 border border-crimson-900/40 rounded-xl overflow-hidden hover:border-crimson-500 transition-all group cursor-pointer transform hover:-translate-y-1">
                                            <img src={anime.poster} alt={`${anime.title} poster`} className="w-full h-auto object-cover" />
                                            <div className="p-3 text-left">
                                                <h4 className="text-sm font-bold text-white line-clamp-2 group-hover:text-crimson-400 transition-colors">{anime.title}</h4>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {!trendLoading && trendingAnimes.length === 0 && (
                                <div className="p-6 bg-crimson-900/20 rounded-xl border border-dashed border-crimson-900 text-center text-crimson-500">No currently tracked popular streams found in the database.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW 2: WATCH INTERFACE */}
                {currentView === 'watch' && (
                    <div className="max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Left Frame: Video Engine & Meta Listing */}
                        <div className="lg:col-span-3 space-y-6">
                            {/* Media Sandbox View */}
                            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-crimson-900/80 shadow-[0_0_60px_rgba(26,0,5,0.8)]">
                                {streamLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950 z-20">
                                        <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-crimson-400 font-bold tracking-wide animate-pulse">Resolving manifest vectors...</p>
                                    </div>
                                )}

                                {!streamLoading && streamData?.streams?.[activeStreamIdx] ? (
                                    <>
                                        {streamData.streams[activeStreamIdx].type === 'iframe' ? (
                                            <iframe src={streamData.streams[activeStreamIdx].url} title="Stream Iframe fallback" className="w-full h-full" allowFullScreen scrolling="no" />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-crimson-950">
                                                <Server className="w-12 h-12 text-crimson-500 mb-3" />
                                                <p className="font-bold text-lg text-white">Direct Stream Link Found ({streamData.streams[activeStreamIdx].type.toUpperCase()})</p>
                                                <p className="text-xs text-crimson-400 mt-1 max-w-sm break-all font-mono p-2 bg-crimson-900/20 rounded border border-crimson-900">{streamData.streams[activeStreamIdx].url}</p>
                                                <p className="text-xs text-crimson-500 mt-4 italic">Tip: For direct HLS manifest parsing, plug this URL into an HLS.js component wrapper.</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    !streamLoading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                            <AlertTriangle className="w-12 h-12 text-crimson-500 mb-2" />
                                            <p className="text-white font-bold">No stream content links scraped</p>
                                            <p className="text-xs text-crimson-500 mt-1">All concurrent routing scrapers returned an empty collection array.</p>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Aggregated Overview Metadata Block */}
                            <div className="p-6 bg-crimson-900/10 border border-crimson-900/40 rounded-2xl backdrop-blur-sm relative overflow-hidden">
                                <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
                                    <div className="space-y-2 max-w-xl">
                                        <div className="flex gap-2 items-center">
                                            <span className="bg-crimson-500/20 text-crimson-400 text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-crimson-500/30">{animeMetadata?.status || 'Synchronized'}</span>
                                            <span className="text-xs text-crimson-400/80 font-mono">Camp Identifier: {selectedAnilistId}</span>
                                        </div>
                                        <h1 className="text-3xl font-black tracking-tight text-white">{animeMetadata?.title || 'Unknown Cluster Title'}</h1>
                                        <p className="text-sm text-crimson-200/70 leading-relaxed text-justify line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">{animeMetadata?.summary || 'No description indexes provided by external TMDB datasets.'}</p>
                                    </div>
                                    <div className="bg-crimson-900/40 border border-crimson-800/40 px-5 py-3 rounded-xl text-center min-w-[100px]">
                                        <p className="text-xs uppercase text-crimson-400 font-extrabold tracking-widest">Episode</p>
                                        <p className="text-3xl font-black text-white">{currentEpisode}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Interactive Episode Index Selector */}
                            {animeMetadata?.episodes_list && (
                                <div className="p-6 bg-crimson-900/10 border border-crimson-900/40 rounded-2xl space-y-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Info className="w-5 h-5 text-crimson-500" /> Episode Index Selector
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {animeMetadata.episodes_list.map((ep) => (
                                            <button key={ep.episode_number} onClick={() => setCurrentEpisode(ep.episode_number)} className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${currentEpisode === ep.episode_number ? 'bg-crimson-500 border-crimson-400 text-white font-bold shadow-[0_4px_12px_rgba(255,0,30,0.3)] scale-105' : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-200 hover:border-crimson-700 hover:bg-crimson-900/20'}`}>
                                                <span className="text-xs uppercase font-bold opacity-60">Ep</span>
                                                <span className="text-lg font-black">{ep.episode_number}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Frame: Source Selection Sidebar */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-crimson-900/20 border border-crimson-900/50 p-6 rounded-2xl sticky top-24">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-crimson-500 animate-ping" /> Scraped Targets
                                </h3>

                                <div className="space-y-2">
                                    {streamLoading ? (
                                        [1, 2].map((n) => <div key={n} className="h-14 bg-crimson-900/10 animate-pulse rounded-xl border border-crimson-900/20"></div>)
                                    ) : streamData?.streams && streamData.streams.length > 0 ? (
                                        streamData.streams.map((stream, idx) => (
                                            <button key={idx} onClick={() => setActiveStreamIdx(idx)} className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${activeStreamIdx === idx ? 'bg-crimson-500 text-white font-bold border-crimson-400 shadow-[0_4px_12px_rgba(255,0,60,0.2)]' : 'bg-crimson-950/60 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-700'}`}>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Type: {stream.type}</span>
                                                    <span className="text-sm font-extrabold tracking-wide text-white truncate max-w-[160px]">{stream.source}</span>
                                                </div>
                                                <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${activeStreamIdx === idx ? 'text-white' : 'text-crimson-700'}`} />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 bg-crimson-950/80 rounded-xl text-center border border-crimson-900/40 text-xs text-crimson-400/80 italic">Zero transport nodes active.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW 3: ABOUT US VIEW */}
                {currentView === 'about' && (
                    <div className="max-w-2xl w-full mx-auto px-6 py-12 space-y-6 my-auto">
                        <div className="border-b border-crimson-900 pb-4">
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">About CrimsonHaven</h2>
                            <p className="text-sm text-crimson-400 font-medium">The architectural design manifest.</p>
                        </div>

                        <div className="space-y-4 text-sm text-crimson-200/80 leading-relaxed text-justify">
                            <p>
                                <strong className="text-white">crimsonhaven</strong> is a performance-optimized high-fidelity user application frame. It functions explicitly as an abstraction layer built on top of decoupled microservices designed to format metadata processing endpoints.
                            </p>
                            <p>
                                By coupling an asynchronous pipeline backend with an intuitive modern client interface styled using real-time variable configurations, this platform allows parsing clean media packages instantly without tracking structural analytics or bloating system resources.
                            </p>
                            <div className="bg-crimson-900/20 border border-crimson-900 p-4 rounded-xl font-mono text-xs text-crimson-300 space-y-1">
                                <p className="font-bold text-white mb-1">// System Specification Diagnostics</p>
                                <p>• Client Layer: React 18 / Vite / Tailwind CSS v4</p>
                                <p>• Server Routing Pipeline: Python / FastAPI Asynchronous Engine</p>
                                <p>• Resolution Engine Model: Concurrent Resolver Layer</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Persistent Legal Safety Disclaimer Footer */}
            <footer className="w-full border-t border-crimson-900/40 bg-crimson-950/90 text-center py-6 px-4 z-10 relative">
                <p className="text-[11px] font-medium tracking-wide text-crimson-600 max-w-3xl mx-auto uppercase leading-normal">
                    Disclaimer: <span className="text-crimson-400/70">crimsonhaven does not host, store, or upload any media configuration parameters or file assets locally. Any legal compliance inquiries regarding video source transport streams should be addressed directly to the responsible host mirrors or root link provider networks :3</span>
                </p>
            </footer>
        </div>
    </>
);
}

export default App;
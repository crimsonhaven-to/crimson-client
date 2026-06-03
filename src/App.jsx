import React, { useState, useEffect, useRef, Component } from 'react';
import { Search, Play, HelpCircle, Film, Info, AlertTriangle, ChevronRight, Server, RefreshCw } from 'lucide-react';
import Background from './assets/background.jpg';
import { useAnimeSearch, useTrendingAnime, useRouter } from './hooks'; // Imported useRouter

const API_BASE_URL = 'http://localhost:8000';

class GlobalErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) { console.error("CRITICAL CLIENT CRASH CAPTURED:", error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans flex items-center justify-center p-6 select-none">
                    <div className="max-w-xl w-full border-2 border-crimson-500 bg-crimson-950/90 rounded-2xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-6 text-center backdrop-blur-md">
                        <div className="flex justify-center">
                            <div className="p-4 bg-crimson-500/10 rounded-full border border-crimson-500/30 animate-pulse">
                                <AlertTriangle className="w-12 h-12 text-crimson-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-black uppercase tracking-wider text-white">System Exception Recovered</h1>
                            <p className="text-sm text-crimson-400 font-mono">The layout runtime encountered an unhandled mutation sequence.</p>
                        </div>
                        {this.state.error && (
                            <div className="p-4 bg-black/50 border border-crimson-900 rounded-xl text-left font-mono text-xs text-crimson-300 max-h-[150px] overflow-y-auto break-words">
                                <span className="text-crimson-500 font-bold">Vector Log:</span> {this.state.error.toString()}
                            </div>
                        )}
                        <button onClick={() => window.location.assign('/')} className="w-full bg-crimson-500 hover:bg-crimson-400 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4" /> Return to Safe Terminal
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const AnimeCard = ({ title, poster, onSelect }) => (
    <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-crimson-900/20 transition-colors border-b border-crimson-900/50"
        onMouseDown={onSelect}
    >
        <div className="flex items-center gap-3">
            {poster ? (
                <img src={poster} alt="" className="w-12 h-auto object-cover rounded shadow-lg flex-shrink-0" />
            ) : (
                <div className="w-12 h-16 bg-crimson-900/30 flex items-center justify-center text-sm text-crimson-400">No Poster</div>
            )}
            <span className="text-base font-semibold text-crimson-300 truncate max-w-[240px]">{title}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-crimson-700" />
    </div>
);

function LandingView({ 
    searchState, 
    trendingAnimes, 
    trendLoading, 
    onSelectSuggestion 
}) {
    const { queryName, setQueryName, searchResults, showSuggestions, setShowSuggestions, metaLoading, apiError } = searchState;
    const dropdownRef = useRef(null);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (!queryName.trim()) return;
        if (searchResults.length > 0) onSelectSuggestion(searchResults[0]);
    };

    return (
        <div className="max-w-3xl w-full mx-auto px-6 py-20 text-center space-y-8 my-auto">
            <div className="space-y-3">
                <h1 className="text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_12px_rgba(255,0,60,0.15)]">
                    crimson<span className="text-crimson-500 font-light">haven</span>
                </h1>
                <p className="text-crimson-300 text-lg tracking-wide font-medium">
                    Stream dynamic links seamlessly straight from the dark network.
                </p>
            </div>

            <div className="relative max-w-xl mx-auto" ref={dropdownRef}>
                <form onSubmit={handleSearchSubmit} className="flex items-end space-x-2 border-2 border-crimson-900/80 rounded-2xl shadow-2xl bg-crimson-900/30 transition-all">
                    <input
                        type="text"
                        placeholder="Enter Anime Name (e.g., The Eminence in Shadow)..."
                        value={queryName}
                        onFocus={() => queryName.length >= 3 && setShowSuggestions(true)}
                        onChange={(e) => {
                            const val = e.target.value;
                            setQueryName(val);
                            if (val.trim().length >= 3) setShowSuggestions(true);
                        }}
                        onBlur={(e) => {
                            if (!dropdownRef.current?.contains(e.relatedTarget)) setShowSuggestions(false);
                        }}
                        className="w-full text-white py-4 px-5 focus:outline-none placeholder-crimson-400/90 placeholder:drop-shadow-[0_0_6px_rgba(239,68,68,0.5)] font-semibold tracking-wide appearance-none bg-transparent"
                    />
                    <button
                        type="submit"
                        disabled={metaLoading}
                        className="bg-crimson-500 hover:bg-crimson-400 disabled:bg-crimson-800 text-white px-6 py-[18px] rounded-r-2xl transition-all shadow-md flex items-center justify-center self-stretch"
                    >
                        {metaLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
                    </button>
                </form>

                {showSuggestions && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-crimson-950 border border-crimson-800 shadow-xl max-h-[300px] overflow-y-auto z-20 text-left rounded-xl">
                        {searchResults.length > 0 ? (
                            searchResults.map((suggestion, index) => (
                                <AnimeCard
                                    key={index}
                                    title={suggestion.title || suggestion.name}
                                    poster={suggestion.poster || null}
                                    onSelect={() => onSelectSuggestion(suggestion)}
                                />
                            ))
                        ) : (
                            <div className="p-4 text-sm text-crimson-400 text-center italic">No tracked anime found matching that title.</div>
                        )}
                    </div>
                )}
            </div>

            {apiError && (
                <div className="max-w-md mx-auto p-4 bg-crimson-900/40 border border-crimson-500/30 rounded-xl text-sm text-crimson-300 flex items-center gap-3 shadow-lg mt-8">
                    <AlertTriangle className="w-5 h-5 text-crimson-500 shrink-0" />
                    <span className="text-left">Status Message: {apiError}</span>
                </div>
            )}

            <div className="mt-16 pt-8 border-t border-crimson-900/50">
                <h2 className="text-3xl font-black tracking-tight text-white uppercase mb-6 flex items-center gap-2">
                    <Play className="w-6 h-6 text-crimson-500" /> Trending Streams <span className="text-base font-normal opacity-70">({trendingAnimes.length} Results)</span>
                </h2>

                {trendLoading ? (
                    <div className="flex justify-center space-x-6 animate-pulse text-crimson-300">
                        {[1, 2, 3].map((n) => <div key={n} className="w-[150px] h-48 bg-gray-700/30 rounded-lg border border-dashed border-crimson-900/50" />)}
                    </div>
                ) : trendingAnimes.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                        {trendingAnimes.map((anime, index) => (
                            <div
                                key={index}
                                onClick={() => onSelectSuggestion(anime)}
                                className="bg-crimson-900/10 border border-crimson-900/40 rounded-xl overflow-hidden hover:border-crimson-500 transition-all group cursor-pointer transform hover:-translate-y-1"
                            >
                                <img src={anime.poster} alt={`${anime.title} poster`} className="w-full h-auto object-cover" />
                                <div className="p-3 text-left">
                                    <h4 className="text-sm font-bold text-white line-clamp-2 group-hover:text-crimson-400 transition-colors">{anime.title}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-6 bg-crimson-900/20 rounded-xl border border-dashed border-crimson-900 text-center text-crimson-500">No currently tracked popular streams found.</div>
                )}
            </div>
        </div>
    );
}

function WatchView({ routeParams, navigate, searchState }) {
    const { anilistId, episode } = routeParams;
    const { animeMetadata, setAnimeMetadata } = searchState;
    const [activeStreamIdx, setActiveStreamIdx] = useState(0);
    const [streamData, setStreamData] = useState(null);
    const [streamLoading, setStreamLoading] = useState(false);

    // Effect 1: Handle metadata synchronization if loaded directly via URL
    useEffect(() => {
        if (!anilistId) return;
        if (animeMetadata && String(animeMetadata.anilist_id) === String(anilistId)) return;

        fetch(`${API_BASE_URL}/info/${anilistId}`)
            .then(res => res.ok ? res.json() : null)
            .then(setAnimeMetadata)
            .catch(err => console.error("Metadata fetch sync err:", err));
    }, [anilistId, animeMetadata, setAnimeMetadata]);

    // Effect 2: Handle stream scraping updates when id or episode parameter mutates
    useEffect(() => {
        if (!anilistId) return;

        setStreamLoading(true);
        setStreamData(null);
        setActiveStreamIdx(0);

        fetch(`${API_BASE_URL}/watch/${anilistId}/${episode}`)
            .then((res) => {
                if (!res.ok) throw new Error('Could not resolve streaming sources.');
                return res.json();
            })
            .then(setStreamData)
            .catch((err) => console.error('Stream fetch error:', err))
            .finally(() => setStreamLoading(false));
    }, [anilistId, episode]);

    const activeStream = streamData?.streams?.[activeStreamIdx];

    return (
        <div className="max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-crimson-900/80 shadow-[0_0_60px_rgba(26,0,5,0.8)]">
                    {streamLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950 z-20">
                            <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-crimson-400 font-bold tracking-wide animate-pulse">Resolving manifest vectors...</p>
                        </div>
                    )}

                    {!streamLoading && activeStream ? (
                        activeStream.type === 'iframe' ? (
                            <iframe src={activeStream.url} title="Stream" className="w-full h-full" allowFullScreen scrolling="no" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-crimson-950">
                                <Server className="w-12 h-12 text-crimson-500 mb-3" />
                                <p className="font-bold text-lg text-white">Direct Stream Link Found ({activeStream.type.toUpperCase()})</p>
                                <p className="text-xs text-crimson-400 mt-1 max-w-sm break-all font-mono p-2 bg-crimson-900/20 rounded border border-crimson-900">{activeStream.url}</p>
                            </div>
                        )
                    ) : (
                        !streamLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                <AlertTriangle className="w-12 h-12 text-crimson-500 mb-2" />
                                <p className="text-white font-bold">No stream content links scraped</p>
                            </div>
                        )
                    )}
                </div>

                <div className="p-6 bg-crimson-900/10 border border-crimson-900/40 rounded-2xl backdrop-blur-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 max-w-xl">
                            <div className="flex gap-2 items-center">
                                <span className="bg-crimson-500/20 text-crimson-400 text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-crimson-500/30">
                                    {animeMetadata?.status || 'Synchronized'}
                                </span>
                                <span className="text-xs text-crimson-400/80 font-mono">Camp Identifier: {anilistId}</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white">{animeMetadata?.title || 'Unknown Cluster Title'}</h1>
                            <p className="text-sm text-crimson-200/70 leading-relaxed text-justify line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                                {animeMetadata?.summary || 'No description indexes provided.'}
                            </p>
                        </div>
                        <div className="bg-crimson-900/40 border border-crimson-800/40 px-5 py-3 rounded-xl text-center min-w-[100px]">
                            <p className="text-xs uppercase text-crimson-400 font-extrabold tracking-widest">Episode</p>
                            <p className="text-3xl font-black text-white">{episode}</p>
                        </div>
                    </div>
                </div>

                {animeMetadata?.episodes_list && (
                    <div className="p-6 bg-crimson-900/10 border border-crimson-900/40 rounded-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Info className="w-5 h-5 text-crimson-500" /> Episode Index Selector
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {animeMetadata.episodes_list.map((ep) => (
                                <button 
                                    key={ep.episode_number} 
                                    onClick={() => navigate(`/watch/${anilistId}/${ep.episode_number}`)} 
                                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                                        Number(episode) === Number(ep.episode_number) 
                                            ? 'bg-crimson-500 border-crimson-400 text-white font-bold shadow-[0_4px_12px_rgba(255,0,30,0.3)] scale-105' 
                                            : 'bg-crimson-950/40 border-crimson-900/60 text-crimson-200 hover:border-crimson-700 hover:bg-crimson-900/20'
                                    }`}
                                >
                                    <span className="text-xs uppercase font-bold opacity-60">Ep</span>
                                    <span className="text-lg font-black">{ep.episode_number}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="lg:col-span-1 space-y-4">
                <div className="bg-crimson-900/20 border border-crimson-900/50 p-6 rounded-2xl sticky top-24">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-crimson-500 animate-ping" /> Scraped Targets
                    </h3>
                    <div className="space-y-2">
                        {streamLoading ? (
                            [1, 2].map((n) => <div key={n} className="h-14 bg-crimson-900/10 animate-pulse rounded-xl border border-crimson-900/20" />)
                        ) : streamData?.streams && streamData.streams.length > 0 ? (
                            streamData.streams.map((stream, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setActiveStreamIdx(idx)} 
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                                        activeStreamIdx === idx 
                                            ? 'bg-crimson-500 text-white font-bold border-crimson-400 shadow-[0_4px_12px_rgba(255,0,60,0.2)]' 
                                            : 'bg-crimson-950/60 text-crimson-300 border-crimson-900/60 hover:bg-crimson-900/20 hover:border-crimson-700'
                                    }`}
                                >
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
    );
}

function AboutView() {
    return (
        <div className="max-w-2xl w-full mx-auto px-6 py-12 space-y-6 my-auto">
            <div className="border-b border-crimson-900 pb-4">
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">About CrimsonHaven</h2>
                <p className="text-sm text-crimson-400 font-medium">The architectural design manifest.</p>
            </div>
            <div className="space-y-4 text-sm text-crimson-200/80 leading-relaxed text-justify">
                <p><strong className="text-white">crimsonhaven</strong> is a performance-optimized high-fidelity user application frame.</p>
                <div className="bg-crimson-900/20 border border-crimson-900 p-4 rounded-xl font-mono text-xs text-crimson-300 space-y-1">
                    <p className="font-bold text-white mb-1">// System Specification Diagnostics</p>
                    <p>• Client Layer: React 18 / Vite / Tailwind CSS</p>
                    <p>• Server Routing Pipeline: Python / FastAPI Asynchronous Engine</p>
                </div>
            </div>
        </div>
    );
}

// --- MASTER APPLICATION ROOT ---
function AppContent() {
    const { view, params, navigate } = useRouter(); // Initialize central router hooks
    const searchState = useAnimeSearch();
    const { trendingAnimes, trendLoading } = useTrendingAnime();

    const handleSelectSuggestion = async (suggestion) => {
        searchState.setQueryName(suggestion.name || suggestion.title || "Selected Anime");
        searchState.setShowSuggestions(false);
        searchState.setMetaLoading(true);
        searchState.setApiError(null);
        searchState.setAnimeMetadata(null);

        const idToUse = suggestion.tmdb_id || suggestion.anilist_id;
        if (!idToUse) {
            searchState.setApiError('Selection failed: Identifiers missing.');
            searchState.setMetaLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/info/${idToUse}`);
            if (!res.ok) throw new Error("Metadata mapping not found.");
            const data = await res.json();
            
            searchState.setAnimeMetadata(data);
            
            // FIXED: Trigger clean routing state modification instead of manual state flags
            navigate(`/watch/${data.anilist_id}/1`);
        } catch (err) {
            searchState.setApiError('Metadata mapping failed to load.');
        } finally {
            searchState.setMetaLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
            <div className="absolute inset-0 pointer-events-none z-0">
                <img src={Background} alt="background wallpaper" className="w-full h-full object-cover opacity-50 wallpaper-img" />
            </div>
            
            <nav className="border-b border-crimson-900/60 bg-crimson-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-md">
                <div onClick={() => { navigate('/'); searchState.setApiError(null); }} className="flex items-center space-x-2 cursor-pointer group">
                    <span className="text-2xl font-black tracking-tighter text-crimson-500 group-hover:text-crimson-400 transition-colors">
                        crimson<span className="text-crimson-100 font-light">haven</span>
                    </span>
                </div>
                <div className="flex space-x-6 text-sm font-medium items-center">
                    <button onClick={() => navigate('/')} className={`transition-colors flex items-center gap-1.5 ${view === 'landing' ? 'text-crimson-500 font-bold' : 'text-crimson-200/70 hover:text-crimson-400'}`}>
                        <Film className="w-4 h-4" /> Search Home
                    </button>
                    <button onClick={() => navigate('/about')} className={`transition-colors flex items-center gap-1.5 ${view === 'about' ? 'text-crimson-500 font-bold' : 'text-crimson-200/70 hover:text-crimson-400'}`}>
                        <HelpCircle className="w-4 h-4" /> About Us
                    </button>
                </div>
            </nav>

            <div className="flex-grow z-10 flex flex-col justify-center">
                {view === 'landing' && (
                    <LandingView 
                        searchState={searchState} 
                        trendingAnimes={trendingAnimes} 
                        trendLoading={trendLoading} 
                        onSelectSuggestion={handleSelectSuggestion} 
                    />
                )}
                {view === 'watch' && (
                    <WatchView 
                        routeParams={params}
                        navigate={navigate}
                        searchState={searchState}
                    />
                )}
                {view === 'about' && <AboutView />}
            </div>

            <footer className="w-full border-t border-crimson-900/40 bg-crimson-950/90 text-center py-6 px-4 z-10 relative">
                <p className="text-[11px] font-medium tracking-wide text-crimson-600 max-w-3xl mx-auto uppercase leading-normal">
                    Disclaimer: <span className="text-crimson-400/70">crimsonhaven does not host any assets locally.</span>
                </p>
            </footer>
        </div>
    );
}

function App() {
    return (
        <GlobalErrorBoundary>
            <AppContent />
        </GlobalErrorBoundary>
    );
}

export default App;
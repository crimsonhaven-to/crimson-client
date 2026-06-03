import React, { useState, useEffect } from 'react';

function App() {
  // State for dynamic video loading
  const [streamData, setStreamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hardcoded for testing your specific API data example
  const anilistId = "127230";
  const episodeNumber = "1";

  useEffect(() => {
    // Replace with your actual local network URL if testing on external devices
    fetch(`http://localhost:8000/watch/${anilistId}/${episodeNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stream data");
        return res.json();
      })
      .then((data) => {
        setStreamData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white">
      
      {/* Top Navigation Bar */}
      <nav className="border-b border-crimson-900 bg-crimson-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-black tracking-tighter text-crimson-500 hover:text-crimson-400 cursor-pointer transition-colors">
            crimson<span className="text-crimson-100 font-light">haven</span>
          </span>
        </div>
        <div className="flex space-x-6 text-sm font-medium text-crimson-100/70">
          <a href="#" className="hover:text-crimson-400 transition-colors">Movies</a>
          <a href="#" className="hover:text-crimson-400 transition-colors">TV Shows</a>
          <a href="#" className="hover:text-crimson-500 text-crimson-500 transition-colors font-bold">Anime</a>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side: Video Player Window */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-crimson-900 shadow-[0_0_50px_rgba(56,2,12,0.5)]">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950/90 z-10">
                <div className="w-12 h-12 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-crimson-400 font-medium animate-pulse">Summoning stream from the abyss...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-crimson-950 text-center p-6 z-10">
                <span className="text-4xl mb-2">🩸</span>
                <p className="text-crimson-400 font-bold">Backend couldn't be reached</p>
                <p className="text-xs text-crimson-700 mt-1">Make sure FastAPI is running on port 8000</p>
              </div>
            )}

            {!loading && !error && streamData?.streams?.[0] && (
              <iframe
                src={streamData.streams[0].url}
                title={streamData.title || "Video Player"}
                className="w-full h-full"
                allowFullScreen
                scrolling="no"
              />
            )}
          </div>

          {/* Video Metadata Panel */}
          <div className="p-6 bg-crimson-900/20 border border-crimson-900/60 rounded-2xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-block bg-crimson-500/10 text-crimson-400 text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-crimson-500/20 mb-2">
                  Now Streaming
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                  {loading ? "Loading title..." : streamData?.title || "Chainsaw Man"}
                </h1>
              </div>
              <div className="bg-crimson-900/50 px-4 py-2 rounded-xl border border-crimson-800/40 text-center">
                <p className="text-xs uppercase text-crimson-400 font-bold tracking-widest">Episode</p>
                <p className="text-xl font-black text-white">{loading ? "--" : streamData?.episode || "1"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Source Selection Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-crimson-900/30 border border-crimson-900/60 p-6 rounded-2xl backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-crimson-500 animate-ping"></span>
              Available Mirrors
            </h3>
            
            <div className="space-y-2">
              {loading ? (
                <div className="h-12 bg-crimson-900/20 animate-pulse rounded-xl"></div>
              ) : streamData?.streams?.map((stream, idx) => (
                <button 
                  key={idx}
                  className="w-full text-left bg-crimson-500 text-white font-semibold p-3.5 rounded-xl border border-crimson-400 shadow-[0_4px_12px_rgba(255,0,60,0.2)] hover:bg-crimson-400 transition-all duration-200 transform hover:-translate-y-0.5 flex flex-col"
                >
                  <span className="text-xs opacity-80 font-normal">Active Server</span>
                  <span className="text-sm tracking-wide">{stream.source}</span>
                </button>
              )) || (
                <div className="p-4 bg-crimson-950/50 rounded-xl text-center border border-crimson-900/40 text-sm text-crimson-400">
                  No fallback servers discovered.
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
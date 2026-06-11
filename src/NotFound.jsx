import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Library, Ghost } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-20 flex flex-col md:flex-row items-center justify-between gap-16 my-auto relative min-h-[80vh] overflow-hidden animate-in fade-in duration-1000">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-crimson-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Text Content */}
      <div className="flex-1 space-y-10 text-center md:text-left z-10 animate-in slide-in-from-left-12 duration-1000 max-w-2xl relative">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1 bg-crimson-500/10 border border-crimson-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 mb-2">
             <Ghost className="w-3 h-3" /> Ethereal Error
          </div>
          <h1 className="text-5xl sm:text-8xl font-black text-white uppercase tracking-tighter drop-shadow-[0_10px_30px_rgba(255,0,60,0.3)] leading-none">
            404 <span className="text-crimson-500">.</span> <span className="font-light opacity-50">Lost</span>
          </h1>
          <p className="text-xl sm:text-2xl text-crimson-100/90 font-medium italic leading-relaxed tracking-tight">
            "Oh dear… you’ve wandered into a forgotten corridor of my castle."
          </p>
          <p className="text-[10px] sm:text-xs text-crimson-600 font-black uppercase tracking-[0.4em] flex items-center justify-center md:justify-start gap-4">
            <div className="w-12 h-px bg-crimson-900/50 hidden md:block"></div>
            Luminas, the Vampire Queen
          </p>
        </div>

        <div className="space-y-6 bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/40 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Ghost className="w-16 h-16 text-crimson-500" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center md:justify-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-crimson-500 shadow-[0_0_15px_#ff003c]"></div>
            What happened?
          </h2>
          <p className="text-crimson-200/70 leading-relaxed text-sm sm:text-lg font-medium">
            Either my royal librarians misplaced a link, or you tried to sneak into a room that doesn’t exist. 
            <span className="block mt-2 italic text-crimson-500/60 text-xs sm:text-sm">(Don’t worry — I do that sometimes too.)</span>
          </p>
        </div>

        <div className="space-y-8">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">Let me guide you back, little mortal.</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-5">
            <Link 
              to="/" 
              className="flex items-center gap-3 px-10 py-5 bg-crimson-500 hover:bg-crimson-400 text-white rounded-2xl transition-all font-black uppercase tracking-[0.2em] text-xs w-full sm:w-fit justify-center shadow-[0_15px_30px_rgba(255,0,60,0.3)] hover:shadow-[0_15px_40px_rgba(255,0,60,0.5)] group active:scale-95"
            >
              <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Return Home
            </Link>
            <Link 
              to="/catalogue" 
              className="flex items-center gap-3 px-10 py-5 bg-crimson-950/40 border-2 border-crimson-900/60 hover:border-crimson-500 text-crimson-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-[0.2em] text-xs w-full sm:w-fit justify-center group backdrop-blur-md shadow-xl active:scale-95"
            >
              <Library className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Browse Archives
            </Link>
          </div>
        </div>

        <div className="pt-10 italic text-crimson-300/40 text-sm sm:text-base border-t border-crimson-900/30 relative">
          <p className="mb-3 leading-relaxed font-medium">
            "I’ve ruled for centuries, and even I get lost in my own domain. <br className="hidden sm:block" />
            Don’t blush. Click the pretty button above and I’ll pretend this never happened."
          </p>
          <p className="text-crimson-600 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs flex items-center gap-3">
             <div className="w-6 h-px bg-crimson-900"></div>
             Lumi, adjusting her tiny velvet cape
          </p>
        </div>

        <div className="text-[9px] font-mono text-crimson-900 font-black uppercase tracking-[0.4em] pt-8 opacity-40">
          SYSTEM_ERROR: 0x404 <span className="mx-2">//</span> LINK_SEVERED
        </div>
      </div>

      {/* Mascot Image - Dynamically Anchored */}
      <div className="md:absolute md:bottom-0 md:right-0 md:translate-y-20 lg:translate-y-0 w-full md:w-auto flex justify-center md:block animate-in fade-in zoom-in duration-1000 pointer-events-none opacity-30 md:opacity-100 z-0">
        <div className="relative group max-w-[280px] sm:max-w-[340px] md:max-w-[400px] lg:max-w-[500px]">
          {/* Ambient Glows */}
          <div className="absolute -inset-20 bg-crimson-500/10 rounded-full blur-[120px] group-hover:bg-crimson-500/20 transition-all duration-1000 animate-pulse" />
          
          <img 
            src="/lumi_404.png"
            alt="Luminas mascot" 
            className="relative w-full h-auto drop-shadow-[0_-20px_100px_rgba(255,0,60,0.4)] transition-all duration-1000 wallpaper-img block"
            style={{ 
              maskImage: 'linear-gradient(to top, transparent 0%, black 20%)',
              WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 20%)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NotFound;

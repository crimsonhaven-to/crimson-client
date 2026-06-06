import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Library, Ghost } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="max-w-7xl w-full mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-12 my-auto relative min-h-[70vh]">
      {/* Text Content */}
      <div className="flex-1 space-y-8 text-left z-10 animate-in fade-in slide-in-from-left-8 duration-700 max-w-2xl">
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-white uppercase tracking-tight drop-shadow-[0_4px_12px_rgba(255,0,60,0.25)]">
            404 <span className="text-crimson-500">·</span> The Crimson Veil
          </h1>
          <p className="text-xl text-crimson-200 font-medium italic leading-relaxed">
            "Oh dear… you’ve wandered into a forgotten corridor of my castle."
          </p>
          <p className="text-sm text-crimson-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-8 h-px bg-crimson-500/50" />
            Luminas, the Vampire Queen
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-crimson-500/50 via-crimson-900/30 to-transparent w-full" />

        <div className="space-y-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-crimson-500 shadow-[0_0_8px_#ff003c]" />
            What happened?
          </h2>
          <p className="text-crimson-200/80 leading-relaxed text-lg">
            Either my royal librarians misplaced a link, or you tried to sneak into a room that doesn’t exist. <br />
            <span className="italic text-crimson-400 text-sm font-medium">(Don’t worry — I do that sometimes too. Eternal life makes you forgetful.)</span>
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-crimson-500/50 via-crimson-900/30 to-transparent w-full" />

        <div className="space-y-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Let me guide you back, little mortal.</h2>
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/" 
              className="flex items-center gap-3 px-8 py-4 bg-crimson-500 hover:bg-crimson-400 text-white rounded-2xl transition-all font-black uppercase tracking-widest w-fit shadow-[0_0_20px_rgba(255,0,60,0.3)] hover:shadow-[0_0_30px_rgba(255,0,60,0.5)] group transform hover:-translate-y-1"
            >
              <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Return to the Haven
            </Link>
            <Link 
              to="/" 
              className="flex items-center gap-3 px-8 py-4 bg-crimson-950/50 border-2 border-crimson-900 hover:border-crimson-500 text-crimson-100 rounded-2xl transition-all font-black uppercase tracking-widest w-fit group transform hover:-translate-y-1 backdrop-blur-sm"
            >
              <Library className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Browse Library
            </Link>
          </div>
          <div className="flex items-center gap-3 px-2 text-crimson-500/40 font-bold uppercase text-[10px] tracking-[0.3em] cursor-default">
            <Ghost className="w-4 h-4" />
            Whisper my name – (just kidding. Or am I?)
          </div>
        </div>

        <div className="pt-8 italic text-crimson-300/60 text-base border-t border-crimson-900/40 relative">
          <div className="absolute -left-4 top-8 w-1 h-12 bg-crimson-500/20 rounded-full" />
          <p className="mb-2 leading-relaxed">
            "I’ve ruled for centuries, and even I get lost in my own domain. <br />
            Don’t blush. Click the pretty button above and I’ll pretend this never happened."
          </p>
          <p className="text-crimson-500 font-black uppercase tracking-widest text-sm">— Lumi, adjusting her tiny velvet cape</p>
        </div>

        <div className="text-[10px] font-mono text-crimson-900 font-black uppercase tracking-[0.4em] pt-6 opacity-50">
          Error code: 404 <span className="mx-2">//</span> Page not found (probably eaten by a shadow bat)
        </div>
      </div>

      {/* Mascot Image - Dynamically Anchored to Bottom */}
      <div className="md:absolute md:bottom-0 md:right-0 md:translate-y-12 lg:translate-y-0 w-full md:w-auto flex justify-center md:block animate-in fade-in zoom-in duration-1000 pointer-events-none">
        <div className="relative group max-w-[450px] lg:max-w-[550px]">
          {/* Ambient Glows */}
          <div className="absolute -inset-10 bg-crimson-500/10 rounded-full blur-[100px] group-hover:bg-crimson-500/20 transition-all duration-1000 animate-pulse" />
          
          <img 
            src="/lumi_nobackground.png" 
            alt="Luminas mascot" 
            className="relative w-full h-auto drop-shadow-[0_-10px_60px_rgba(255,0,60,0.3)] transition-all duration-700 wallpaper-img block"
            style={{ 
              maskImage: 'linear-gradient(to top, transparent 0%, black 15%)',
              WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 15%)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NotFound;

import { Link } from 'react-router-dom';
import { Shield, Server, Sparkles } from 'lucide-react';
import { CLIENT_VERSION, HOSTED_IN } from '../api/config';
import { SOCIAL_LINKS } from '../info/socialLinks';

export default function Footer() {
  return (
    <footer className="w-full border-t border-crimson-900/40 bg-crimson-950/90 backdrop-blur-md py-12 px-6 z-10 relative">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <span className="text-xl sm:text-2xl font-black tracking-tighter text-crimson-500">
            crimson<span className="text-crimson-100 font-light">haven</span>
          </span>
          <p className="text-crimson-400 text-sm leading-relaxed max-w-sm mt-5 mb-6">
            Your regal sanctuary for seamless anime streaming, curated by Lumi, your crimson curator. ✨
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3 py-1 bg-crimson-950/40 border border-crimson-900/60 rounded-lg text-[10px] font-black text-crimson-500 uppercase tracking-widest">v{CLIENT_VERSION}</div>
            <div className="px-3 py-1 bg-crimson-950/40 border border-crimson-900/60 rounded-lg text-[10px] font-black text-crimson-500 uppercase tracking-widest">Members Only</div>
            <div className="px-3 py-1 bg-crimson-950/40 border border-crimson-900/60 rounded-lg text-[10px] font-black text-crimson-500 uppercase tracking-widest">Hosted in {HOSTED_IN}</div>
          </div>
        </div>

        <div>
          <h4 className="text-crimson-50 font-black uppercase text-xs tracking-widest mb-6">Browse</h4>
          <div className="flex flex-col gap-3">
            <Link to="/anime" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Anime</Link>
            <Link to="/shows" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Shows</Link>
            <Link to="/movies" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Movies</Link>
            <Link to="/manga" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Manga</Link>
            <Link to="/favorites" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Favorites</Link>
          </div>
        </div>

        <div>
          <h4 className="text-crimson-50 font-black uppercase text-xs tracking-widest mb-6">Connect</h4>
          <div className="flex flex-col gap-3">
            <Link to="/about" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">About Us</Link>
            <Link to="/extension" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Companion</Link>
            <Link to="/disclaimer" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Disclaimer</Link>
            <Link to="/changelog" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">Chronicle</Link>
            {SOCIAL_LINKS.slice(0, 3).map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-crimson-400 hover:text-crimson-500 transition-colors text-sm font-bold">{label}</a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-8 border-t border-crimson-900/20 flex flex-col gap-4">
        <p className="text-[11px] font-medium tracking-wide text-crimson-600 uppercase leading-normal">
          Disclaimer: <span className="text-crimson-400/70">crimsonhaven does not host, store, or upload any file assets locally. Any legal issues should be taken up with the providers directly :3</span>{' '}
          <Link to="/disclaimer" className="text-crimson-500 hover:text-crimson-400 underline underline-offset-2 transition-colors font-black">
            Read More
          </Link>
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-crimson-700 text-[10px] font-bold uppercase tracking-widest">&copy; {new Date().getFullYear()} Crimsonhaven. All rites reserved.</p>
            <span className="px-2.5 py-0.5 bg-crimson-950/40 border border-crimson-900/60 rounded-full text-[9px] font-black text-crimson-600 uppercase tracking-widest">Hosted in {HOSTED_IN}</span>
          </div>
          <div className="flex items-center gap-4 text-crimson-700">
            <Shield className="w-4 h-4" />
            <Server className="w-4 h-4" />
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      </div>
    </footer>
  );
}

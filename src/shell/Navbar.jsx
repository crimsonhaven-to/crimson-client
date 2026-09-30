import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HelpCircle, Menu, X, Heart, History, User, Sparkles, LogOut, Shield, SlidersHorizontal, Flame, Tv, Wallet, BookOpen, Clapperboard, HardDrive, Radio, CalendarDays, Music } from 'lucide-react';
import { useHealthStatus } from '../api/useHealthStatus';
import { useAuth } from '../account/useAuth';
import { useProfile } from '../account/profile';
import { usePublicConfig } from '../api/client';
import { forgetDownloads, hasDownloads } from '../music/downloads';
import { forgetListens } from '../music/listens';
import { close as closeMusic } from '../music/player';

export default function Navbar({ musicEnabled }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { logout } = useAuth();
  const { health } = useHealthStatus();
  const profile = useProfile();
  const isAdmin = !!profile?.is_admin;
  // The local library only exists on operator builds that configured a source.
  const { local_library_enabled: localEnabled, live_tv_enabled: liveTvEnabled } = usePublicConfig();
  // Offline the profile never loads, so downloads on this device keep Music reachable.
  const showMusic = musicEnabled || hasDownloads();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    setUserMenuOpen(false);
    // Nothing of this account's music stays on a device someone else may use next.
    closeMusic();
    forgetDownloads();
    forgetListens();
    logout();
    navigate('/');
  };

  // Informational pages and Admin live in the account dropdown because a label for
  // everything no longer fits one bar.
  const browseLinks = [
    { to: "/", label: "Home", icon: <Sparkles className="w-4 h-4" /> },
    { to: "/anime", label: "Anime", icon: <Flame className="w-4 h-4" /> },
    { to: "/shows", label: "Shows", icon: <Tv className="w-4 h-4" /> },
    { to: "/movies", label: "Movies", icon: <Clapperboard className="w-4 h-4" /> },
    { to: "/manga", label: "Manga", icon: <BookOpen className="w-4 h-4" /> },
    { to: "/live", label: "Live TV", icon: <Radio className="w-4 h-4" />, live: true },
    { to: "/local", label: "Local", icon: <HardDrive className="w-4 h-4" />, local: true },
    { to: "/music", label: "Music", icon: <Music className="w-4 h-4" />, music: true },
  ].filter(l => (!l.local || localEnabled) && (!l.live || liveTvEnabled) && (!l.music || showMusic));
  const personalLinks = [
    { to: "/favorites", label: "Favorites", icon: <Heart className="w-4 h-4" /> },
    { to: "/recently-watched", label: "History", icon: <History className="w-4 h-4" /> },
    { to: "/calendar", label: "Calendar", icon: <CalendarDays className="w-4 h-4" /> },
  ];
  const isCurrent = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));
  const navLinkClass = (to) => `flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-all ${
    isCurrent(to)
      ? 'text-crimson-500 bg-crimson-500/10'
      : 'text-crimson-200/50 hover:text-crimson-400 hover:bg-crimson-900/30'
  }`;

  return (
    <nav className={`sticky top-0 z-50 px-4 sm:px-6 border-b transition-all duration-500 ${
      scrolled
        ? 'bg-crimson-950/80 backdrop-blur-lg border-crimson-900/60 shadow-lg py-3'
        : 'bg-transparent border-transparent py-4'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 cursor-pointer group" onClick={() => { setIsMenuOpen(false); setUserMenuOpen(false); }}>
          <span className="text-xl sm:text-2xl font-black tracking-tighter text-crimson-500 group-hover:text-crimson-400 transition-colors">
            crimson<span className="text-crimson-100 font-light">haven</span>
          </span>
        </Link>

        <div className="hidden md:flex gap-1 text-[11px] font-black uppercase tracking-wider items-center">
          {browseLinks.map(link => (
            <Link key={link.to} to={link.to} title={link.label} aria-label={link.label} className={navLinkClass(link.to)}>
              {link.icon} <span className="hidden xl:inline">{link.label}</span>
            </Link>
          ))}
          <span className="w-px h-5 mx-1 lg:mx-2 bg-crimson-900/60" />
          {personalLinks.map(link => (
            <Link key={link.to} to={link.to} title={link.label} aria-label={link.label} className={navLinkClass(link.to)}>
              {link.icon}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {health && (
            <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 bg-crimson-950/40 border border-crimson-900/60 rounded-xl">
              <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-crimson-600'} animate-pulse`}></div>
              <span className="text-[10px] font-black text-crimson-700 uppercase tracking-widest">{health?.mode || 'ONLINE'}</span>
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => { setUserMenuOpen(o => !o); setIsMenuOpen(false); }}
              className="w-10 h-10 rounded-xl bg-crimson-950/40 border border-crimson-900/60 flex items-center justify-center hover:bg-crimson-900/20 hover:border-crimson-600 transition-all group"
              aria-label="Account menu"
            >
              <User className="w-5 h-5 text-crimson-400 group-hover:text-crimson-500" />
            </button>

            {userMenuOpen && (
              <div className="absolute top-full right-0 mt-4 w-64 bg-crimson-950/95 backdrop-blur-2xl border border-crimson-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-2xl z-50">
                <div className="p-4 border-b border-crimson-900/20 bg-crimson-600/5">
                  <p className="text-xs font-black text-crimson-600 uppercase tracking-widest mb-1">Session</p>
                  <p className="text-crimson-50 font-bold truncate">{profile?.username || 'Sanctuary Dweller'}</p>
                </div>
                <div className="p-2">
                  <Link
                    to="/account"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                  >
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                  >
                    <SlidersHorizontal className="w-4 h-4" /> Preferences
                  </Link>
                  <Link
                    to="/wrapped"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Crimson Wrapped
                  </Link>
                  <div className="my-2 border-t border-crimson-900/20" />
                  <Link to="/support" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all">
                    <Wallet className="w-4 h-4" /> Support Us
                  </Link>
                  <Link to="/supporters" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all">
                    <Sparkles className="w-4 h-4" /> Mortals
                  </Link>
                  <Link to="/about" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all">
                    <HelpCircle className="w-4 h-4" /> About Us
                  </Link>
                  <div className="my-2 border-t border-crimson-900/20" />
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-200/50 hover:text-white hover:bg-crimson-900/20 rounded-xl transition-all"
                    >
                      <Shield className="w-4 h-4" /> Admin Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-crimson-500 hover:bg-crimson-600/10 rounded-xl transition-all"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className="md:hidden p-2 text-crimson-400 hover:text-white transition-colors"
            onClick={() => { setIsMenuOpen(!isMenuOpen); setUserMenuOpen(false); }}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-crimson-950/95 backdrop-blur-xl border-b border-crimson-900 shadow-2xl md:hidden animate-in slide-in-from-top duration-300">
          <div className="flex flex-col p-4 space-y-4">
            {[...browseLinks, ...personalLinks].map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all font-black uppercase tracking-widest text-sm ${
                  isCurrent(link.to) ? 'bg-crimson-500/20 text-crimson-500' : 'text-crimson-100 hover:bg-crimson-900/40'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-crimson-500">{link.icon}</span> {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

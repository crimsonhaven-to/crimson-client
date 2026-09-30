import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MeshBackground from './shell/MeshBackground';
import Navbar from './shell/Navbar';
import Footer from './shell/Footer';
import PageLoader from './shell/PageLoader';
import AuthGate from './shell/AuthGate';
import NotFound from './shell/NotFound';
import { useKonamiCode } from './shell/useKonami';
import { useAuth } from './account/useAuth';
import { useMusicAccess } from './music/hooks';
import { resumeDownloads } from './music/downloads';
import { useDiscordPresence } from './discordPresence';
import LandingPage from './home/LandingPage';
import AnimeWatch from './anime/AnimeWatch';
import AboutPage from './info/About';
// Eager, but renders nothing until /chat/status grants access (deny-by-default).
import Lumi from './lumi/Lumi';
// Eager because it must outlive every route change for playback to continue.
import MiniPlayer from './music/MiniPlayer';
// Authenticated pages are lazy so the login wall doesn't ship them or hls.js.
const AnimeHub = lazy(() => import('./anime/AnimeHub'));
const ShowsHub = lazy(() => import('./shows/ShowsHub'));
const MoviesHub = lazy(() => import('./movies/MoviesHub'));
const MangaHub = lazy(() => import('./manga/MangaHub'));
const LocalHub = lazy(() => import('./local/LocalHub'));
const AccountPage = lazy(() => import('./account/Account'));
const SettingsPage = lazy(() => import('./account/UserSettings'));
const WelcomeTour = lazy(() => import('./shell/WelcomeTour'));
const WatchlistsPage = lazy(() => import('./library/Watchlists'));
const RecentlyWatchedPage = lazy(() => import('./library/RecentlyWatched'));
const AiringCalendarPage = lazy(() => import('./library/AiringCalendar'));
const WrappedPage = lazy(() => import('./wrapped/CrimsonWrapped'));
const SupportUsPage = lazy(() => import('./info/SupportUs'));
const SupportersPage = lazy(() => import('./info/Supporters'));
const DisclaimerPage = lazy(() => import('./info/Disclaimer'));
const ChangelogPage = lazy(() => import('./info/Changelog'));
const AnimeOverview = lazy(() => import('./anime/AnimeOverview'));
const AdminPage = lazy(() => import('./admin/Admin'));
const ShowOverview = lazy(() => import('./shows/ShowOverview'));
const ShowWatch = lazy(() => import('./shows/ShowWatch'));
const MovieOverview = lazy(() => import('./movies/MovieOverview'));
const MovieWatch = lazy(() => import('./movies/MovieWatch'));
const MangaOverview = lazy(() => import('./manga/MangaOverview'));
const MangaReader = lazy(() => import('./manga/MangaReader'));
const LocalOverview = lazy(() => import('./local/LocalOverview'));
const LocalWatch = lazy(() => import('./local/LocalWatch'));
const LiveTvHub = lazy(() => import('./livetv/LiveTvHub'));
const LiveTvWatch = lazy(() => import('./livetv/LiveTvWatch'));
const LumiSecret = lazy(() => import('./lumi/LumiSecret'));
const MusicHub = lazy(() => import('./music/MusicHub'));
const MusicPlaylist = lazy(() => import('./music/MusicPlaylist'));
const MusicNowPlaying = lazy(() => import('./music/MusicNowPlaying'));
const MusicConnect = lazy(() => import('./music/MusicConnect'));
const DownloadExtensionPage = lazy(() => import('./info/DownloadExtension'));

function App() {
  const { isAuthenticated } = useAuth();
  const musicEnabled = useMusicAccess();
  const navigate = useNavigate();

  // Mounted at the root so presence spans every page.
  useDiscordPresence();

  useKonamiCode(useCallback(() => navigate('/lumi'), [navigate]));

  // Only a signed-out to signed-in transition opens the tour; a reload while
  // signed in starts with wasAuthedRef true, so it doesn't re-show.
  const [showTour, setShowTour] = useState(false);
  const wasAuthedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (!wasAuthedRef.current && isAuthenticated) setShowTour(true);
    wasAuthedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Picks up songs added to downloaded playlists since the app last ran.
  useEffect(() => {
    if (musicEnabled) resumeDownloads();
  }, [musicEnabled]);

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
      {showTour && (
        <Suspense fallback={null}>
          <WelcomeTour onClose={() => setShowTour(false)} />
        </Suspense>
      )}

      <div className="absolute inset-0 pointer-events-none z-0">
        <MeshBackground />
      </div>

      <Navbar musicEnabled={musicEnabled} />

      <div className="flex-grow z-10 flex flex-col justify-center px-4 sm:px-6 md:px-0">
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/support" element={<SupportUsPage />} />
          <Route path="/supporters" element={<SupportersPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/anime" element={<AnimeHub />} />
          <Route path="/shows" element={<ShowsHub />} />
          <Route path="/movies" element={<MoviesHub />} />
          <Route path="/manga" element={<MangaHub />} />
          <Route path="/live" element={<LiveTvHub />} />
          <Route path="/local" element={<LocalHub />} />
          <Route path="/music" element={<MusicHub />} />
          <Route path="/music/playlist/:id" element={<MusicPlaylist />} />
          <Route path="/music/now" element={<MusicNowPlaying />} />
          <Route path="/music/connect" element={<MusicConnect />} />
          {/* Legacy path: keep old Catalogue bookmarks working. */}
          <Route path="/catalogue" element={<Navigate to="/anime" replace />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/watchlists" element={<WatchlistsPage />} />
          {/* Legacy path: keep old bookmarks working. */}
          <Route path="/favorites" element={<WatchlistsPage />} />
          <Route path="/recently-watched" element={<RecentlyWatchedPage />} />
          <Route path="/calendar" element={<AiringCalendarPage />} />
          <Route path="/wrapped" element={<WrappedPage />} />
          <Route path="/anime/:anilistId" element={<AnimeOverview />} />
          <Route path="/watch/:anilistId/:season?/:episode?" element={<AnimeWatch />} />
          <Route path="/show/:tmdbId" element={<ShowOverview />} />
          <Route path="/watch-show/:tmdbId/:season?/:episode?" element={<ShowWatch />} />
          <Route path="/movie/:tmdbId" element={<MovieOverview />} />
          <Route path="/watch-movie/:tmdbId" element={<MovieWatch />} />
          <Route path="/local/:token" element={<LocalOverview />} />
          <Route path="/watch-local/:token" element={<LocalWatch />} />
          <Route path="/watch-live/:channelId" element={<LiveTvWatch />} />
          <Route path="/manga/:anilistId" element={<MangaOverview />} />
          {/* Without a chapter id the reader resumes from saved progress. */}
          <Route path="/read/:anilistId" element={<MangaReader />} />
          <Route path="/read/:anilistId/:chapterId" element={<MangaReader />} />
          <Route path="/extension" element={<DownloadExtensionPage />} />
          {/* Reached via the Konami code. */}
          <Route path="/lumi" element={<LumiSecret />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>

      {/* Hides itself on the watch routes, where the player owns that corner. */}
      <Lumi />

      <Footer />

      <MiniPlayer />
    </div>
  );
}

export default App;
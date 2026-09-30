import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, Server, RefreshCw, ScrollText, Tag } from 'lucide-react';
import { useHealthStatus } from '../api/useHealthStatus';
import { useTitle } from '../useTitle';
import { useChangelog } from './hooks';
import { apiFetch } from '../api/client';
import { CLIENT_VERSION, HOSTED_IN } from '../api/config';
import { changelogExcerpt, formatReleaseDate } from './changelogFormat';
import { SOCIAL_LINKS } from './socialLinks';

export default function AboutPage() {
  const { health, healthLoading, healthError } = useHealthStatus();
  const { entries: changelog, loading: changelogLoading, notConfigured: changelogUnavailable } = useChangelog();
  const [backendVersion, setBackendVersion] = useState('Resolving...');
  useTitle('About the Haven');

  const latestRelease = changelog[0];

  useEffect(() => {
    apiFetch(`/`)
      .then(res => res.json())
      .then(data => setBackendVersion(data.Version || data.version || 'Unknown'))
      .catch(() => setBackendVersion('Offline'));
  }, []);

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-2">
        <h2 className="text-4xl sm:text-5xl font-black text-crimson-50 uppercase tracking-tighter leading-none">About <span className="text-crimson-500">CrimsonHaven</span></h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">The architectural design manifest</p>
      </div>

      <div className="space-y-8 text-sm sm:text-base text-crimson-100/70 leading-relaxed text-justify font-medium">
        <p><strong className="text-crimson-50 font-black tracking-tight">crimsonhaven</strong> is a performance-optimized high-fidelity user application frame, engineered for the most discerning mortals.</p>
        
        <div className="bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 p-6 sm:p-8 rounded-[2rem] font-mono text-xs text-crimson-400 space-y-3 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Server className="w-12 h-12 text-crimson-500" />
          </div>
          <h3 className="font-black text-crimson-50 mb-4 tracking-widest uppercase border-b border-crimson-900/50 pb-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse"></div>
            System Specification Diagnostics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">CLIENT:</span> React 19 / Vite / Tailwind</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">ROUTING:</span> FastAPI Asynchronous Engine</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">BLOOD ARCHIVE:</span> 3-Node PostgreSQL HA Coven · Off-Site Crypt Backup</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">DOMINION:</span> 3-Node Docker Swarm · Eternal Zero-Interruption CI/CD Ritual</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">BACKEND VERSION:</span> {backendVersion}</p>
             <p className="flex items-center gap-2"><span className="text-crimson-600 font-black">CLIENT VERSION:</span> {CLIENT_VERSION}</p>
          </div>
        </div>

        <div className="relative bg-crimson-500/5 backdrop-blur-md border border-crimson-500/20 p-8 rounded-[2.5rem] shadow-xl">
          <div className="absolute -top-3 left-10 px-4 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white">Queen's Decree</div>
          <p className="italic text-crimson-100/90 leading-relaxed text-lg tracking-tight">
            "And a little secret between us, darling~ Ironically, this totally <span className="text-crimson-50 not-italic font-black border-b-2 border-crimson-500/50">morally correct</span> webpage
            keeps all your data tucked away in <span className="text-crimson-50 not-italic font-black border-b-2 border-crimson-500/50">{HOSTED_IN}</span>. Funny, isn't it?~"
          </p>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 flex items-center gap-3">
             <span className="block w-8 h-px bg-crimson-500/50"></span>
             Luminas, the Vampire Queen
          </p>
        </div>
      </div>

      {!changelogUnavailable && (
        <div className="space-y-6">
          <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
            <ScrollText className="w-4 h-4" /> Latest Chronicle
            <div className="h-px bg-crimson-900/30 flex-grow"></div>
          </h3>

          <div className="relative bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 p-6 sm:p-8 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 p-5 opacity-[0.07] pointer-events-none">
              <ScrollText className="w-20 h-20 text-crimson-500" />
            </div>

            {changelogLoading && (
              <p className="text-crimson-500 animate-pulse flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]">
                <RefreshCw className="w-3 h-3 animate-spin" /> Unsealing the latest decree...
              </p>
            )}

            {!changelogLoading && latestRelease && (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-crimson-500/10 border border-crimson-500/30 rounded-xl text-crimson-300 font-black tracking-tight text-sm">
                    <Tag className="w-3.5 h-3.5" />
                    {latestRelease.tag || latestRelease.name}
                  </span>
                  {latestRelease.published_at && (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600">
                      {formatReleaseDate(latestRelease.published_at)}
                    </span>
                  )}
                </div>
                {latestRelease.name && latestRelease.name !== latestRelease.tag && (
                  <h4 className="text-lg font-black text-crimson-50 tracking-tight mb-3 leading-tight">{latestRelease.name}</h4>
                )}
                <p className="text-sm sm:text-base text-crimson-100/70 leading-relaxed font-medium whitespace-pre-line">
                  {changelogExcerpt(latestRelease.body)}
                </p>
              </>
            )}

            {!changelogLoading && !latestRelease && (
              <p className="text-sm text-crimson-300/60 italic font-medium">
                "No decrees etched yet, darling, but the first page awaits."
              </p>
            )}

            <Link
              to="/changelog"
              className="inline-flex items-center gap-2 mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-crimson-500 hover:text-crimson-400 transition-colors group"
            >
              Read the Full Chronicle
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
           Invoke Social Nodes
           <div className="h-px bg-crimson-900/30 flex-grow"></div>
        </h3>
        <div className="flex flex-wrap gap-4">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-3 bg-crimson-950/40 backdrop-blur-sm border border-crimson-900/60 rounded-2xl text-crimson-400 hover:text-white hover:border-crimson-500 hover:bg-crimson-900/40 transition-all text-xs font-black uppercase tracking-widest shadow-lg group"
            >
              <div className="group-hover:scale-110 transition-transform"><Icon /></div>
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
          <Server className="w-4 h-4" /> Node Status
          <div className="h-px bg-crimson-900/30 flex-grow"></div>
        </h3>
        <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 p-6 rounded-3xl font-mono text-[10px] space-y-2 shadow-inner">
          {healthLoading && (
            <p className="text-crimson-500 animate-pulse flex items-center gap-2">
               <RefreshCw className="w-3 h-3 animate-spin" /> Probing system nodes...
            </p>
          )}
          {healthError && (
            <p className="text-crimson-500 font-bold flex items-center gap-2">
               <AlertCircle className="w-3 h-3" /> System Link Severed: {healthError}
            </p>
          )}
          {health && Object.entries(health).map(([key, value]) => (
            <p key={key} className="text-crimson-400/80 group">
              <span className="text-crimson-600 font-black mr-2">/</span> 
              <span className="font-black uppercase tracking-wider text-crimson-700">{key}:</span>{' '}
              <span className="text-crimson-100 group-hover:text-white transition-colors">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

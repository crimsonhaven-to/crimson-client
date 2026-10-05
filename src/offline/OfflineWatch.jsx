import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, WifiOff } from 'lucide-react';

import { useTitle } from '../useTitle';
import CacheLoader from './CacheLoader';
import { itemLabel } from './items';
import { savePosition } from './queue';
import { getState, nextKept, useVideoDownloads } from './store';
import { servesFiles } from '../deviceCache';
import { fileKey, playlistKey, read, subtitleKey } from './videoStore';

const CrimsonPlayer = lazy(() => import('../watch/CrimsonPlayer'));

const SAVE_EVERY_MS = 5000;

// HLS copies play through CacheLoader; an mp4 copy and the subtitles become
// object URLs of the stored blobs, which are disk-backed, not read into memory.
// The desktop app serves the mp4 file itself, with seeking, so it needs no blob.
function useOfflineMedia(entry) {
  const [media, setMedia] = useState(null);
  const [error, setError] = useState(null);
  const id = entry?.id;
  const ready = entry?.status === 'done';
  const format = entry?.format;
  const subtitles = entry?.subtitles;

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    const urls = [];
    const objectUrl = async (key, type) => {
      const res = await read(key);
      if (!res) return null;
      const blob = await res.blob();
      const url = URL.createObjectURL(type ? new Blob([blob], { type }) : blob);
      urls.push(url);
      return url;
    };
    const mp4Url = async () => {
      if (!servesFiles()) return objectUrl(fileKey(id));
      const res = await read(fileKey(id));
      await res?.body?.cancel();
      return res ? fileKey(id) : null;
    };
    (async () => {
      try {
        const src = format === 'hls' ? playlistKey(id, 'index') : await mp4Url();
        if (!src) throw new Error('This copy is missing from the device. Remove it and save it again.');
        const tracks = [];
        for (const sub of subtitles || []) {
          const url = await objectUrl(subtitleKey(id, sub.n), 'text/vtt');
          if (url) tracks.push({ url, lang: sub.lang, label: sub.label });
        }
        if (!cancelled) setMedia({ src, type: format === 'hls' ? 'hls' : 'mp4', subtitles: tracks });
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      setMedia(null);
      setError(null);
    };
  }, [id, ready, format, subtitles]);

  return { media, error };
}

function resumePoint(entry) {
  const unfinished = entry?.position > 5 && !(entry.duration && entry.position > entry.duration - 15);
  return unfinished ? entry.position : 0;
}

// Keyed by the copy, so moving to the next episode starts from a clean slate.
export default function OfflineWatch() {
  const { id } = useParams();
  return <OfflineCopy key={id} id={id} />;
}

function OfflineCopy({ id }) {
  const navigate = useNavigate();
  const { entries } = useVideoDownloads();
  const entry = entries[id];
  const next = nextKept(entries, id);
  const { media, error } = useOfflineMedia(entry);
  useTitle(entry ? `Watch ${entry.titleName}` : 'Downloads');

  // Read once: the saved position moves while the copy plays, and a moving
  // startAt would seek the player back.
  const [startAt] = useState(() => resumePoint(getState().entries[id]));

  const latest = useRef(null);
  const savedAt = useRef(0);
  const onProgress = useCallback((position, duration) => {
    latest.current = { position, duration };
    if (Date.now() - savedAt.current < SAVE_EVERY_MS) return;
    savedAt.current = Date.now();
    savePosition(id, position, duration);
  }, [id]);
  useEffect(() => () => {
    if (latest.current) savePosition(id, latest.current.position, latest.current.duration);
  }, [id]);

  const label = entry ? itemLabel(entry) : '';

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-in fade-in duration-700">
      <Link
        to="/downloads"
        className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-crimson-950/40 border border-crimson-900/60 text-crimson-400 hover:text-white hover:border-crimson-600 transition-all text-[11px] font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Downloads
      </Link>

      <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-crimson-900/60 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
        {media ? (
          <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
            <CrimsonPlayer
              src={media.src}
              mediaKey={id}
              type={media.type}
              hlsLoader={media.type === 'hls' ? CacheLoader : null}
              subtitles={media.subtitles}
              title={entry.titleName}
              startAt={startAt}
              onProgress={onProgress}
              onNext={next ? () => navigate(`/downloads/watch/${next.id}`) : undefined}
              hasNext={!!next}
              nextLabel={next ? itemLabel(next) : ''}
              canDownload={false}
            />
          </Suspense>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-crimson-500 mb-4 opacity-60" />
            <p className="text-crimson-50 font-black uppercase tracking-widest text-sm">
              {error || (!entry ? 'Not on this device' : entry.status !== 'done' ? 'Still saving' : 'Opening the copy')}
            </p>
          </div>
        )}
      </div>

      {entry && (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
            <WifiOff className="w-3.5 h-3.5" /> Playing from this device{entry.source ? ` · ${entry.source}` : ''}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-crimson-50">{entry.titleName}</h1>
          {entry.kind === 'episode' && <p className="text-lg font-bold text-crimson-400">{label}</p>}
        </div>
      )}
    </div>
  );
}

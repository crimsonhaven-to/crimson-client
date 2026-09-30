import { useEffect, useRef, useState, useCallback } from 'react';
import { downloadStream } from '../streamDownload';

// HLS downloads fetch every segment and can take a while, hence progress and cancel.
export function useStreamDownload({ src, mediaKey, type, downloadName, title, onError }) {
  const [downloading, setDownloading] = useState(false);
  // null when the download size is unknown.
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(null);

  const toggleDownload = useCallback(async () => {
    if (downloading) { abortRef.current?.abort(); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setDownloading(true);
    setProgress(0);
    try {
      await downloadStream(
        { url: src, type, name: downloadName || title },
        (fraction) => setProgress(fraction == null ? null : fraction),
        controller.signal,
      );
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Download failed:', err);
        onError(`Download failed: ${err.message || 'unknown error'}. Try another source.`);
      }
    } finally {
      setDownloading(false);
      abortRef.current = null;
    }
  }, [downloading, src, type, downloadName, title, onError]);

  useEffect(() => () => abortRef.current?.abort(), [src, mediaKey]);

  return { downloading, progress, toggleDownload };
}

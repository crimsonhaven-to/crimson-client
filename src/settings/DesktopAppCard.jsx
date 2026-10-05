import { useEffect, useState } from 'react';
import { Download, MonitorDown } from 'lucide-react';

import { API_BASE_URL } from '../api/config';
import { apiFetch, usePublicConfig } from '../api/client';
import { formatBytes } from '../formatBytes';

const KIND_LABELS = {
  installer: 'Windows installer',
  appimage: 'Linux AppImage',
  deb: 'Debian, Ubuntu (.deb)',
  rpm: 'Fedora, openSUSE (.rpm)',
  dmg: 'macOS (.dmg)',
  apk: 'Android (.apk)',
};

function platformOfThisDevice() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return null;
}

// Members only: the installers come through the backend, which signs each
// link for a day, so they never sit anywhere public.
export default function DesktopAppCard() {
  const { desktop_app: offered } = usePublicConfig();
  const [release, setRelease] = useState(null);

  useEffect(() => {
    if (!offered || window.CrimsonNative) return;
    apiFetch('/app/release')
      .then((res) => (res.ok ? res.json() : null))
      .then(setRelease, () => {});
  }, [offered]);

  if (!release?.files?.length) return null;
  const mine = platformOfThisDevice();
  const files = [...release.files].sort((a, b) => (b.platform === mine) - (a.platform === mine));

  return (
    <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>
      <div className="space-y-3 relative z-10">
        <div className="flex items-center gap-3 text-crimson-500">
          <MonitorDown className="w-6 h-6" />
          <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">The App</h3>
        </div>
        <p className="text-xs text-crimson-300/60 font-medium leading-relaxed max-w-md">
          Version {release.version}, for desktop and Android. Every source works without the browser extension,
          and downloads become real files that are never evicted. The desktop app updates itself and needs no
          Discord helper.
        </p>
      </div>
      <ul className="relative z-10 space-y-2">
        {files.map((file) => (
          <li key={file.name}>
            <a
              href={`${API_BASE_URL}${file.url}`}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-xs font-bold transition-colors ${
                file.platform === mine
                  ? 'bg-crimson-600 border-crimson-600 text-white hover:bg-crimson-500'
                  : 'bg-crimson-950/60 border-crimson-900/60 text-crimson-300 hover:border-crimson-600'
              }`}
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="flex-grow">{KIND_LABELS[file.kind] || file.name}</span>
              {file.size > 0 && <span className="opacity-70">{formatBytes(file.size)}</span>}
            </a>
          </li>
        ))}
      </ul>
      <p className="relative z-10 text-[11px] text-crimson-400/70 leading-relaxed font-medium max-w-md">
        The app is not code signed. Windows may warn on first start: choose <em>More info</em>, then{' '}
        <em>Run anyway</em>. On Android, allow installing from your browser when asked.
      </p>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Download, Upload, ChevronDown } from 'lucide-react';

// The import result goes out through onImportMessage because the page shows it as a
// banner below this row, not inside it.
const WatchlistTransfer = ({ exportWatchlists, importWatchlists, canExport, onImportMessage }) => {
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const importRef = useRef(null);
  const fileRef = useRef(null);
  const importModeRef = useRef('merge');

  useEffect(() => {
    if (!exportOpen && !importOpen) return;
    const onClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
      if (importRef.current && !importRef.current.contains(e.target)) setImportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [exportOpen, importOpen]);

  const handleExport = async (format) => {
    setExportOpen(false);
    setExporting(true);
    await exportWatchlists(format);
    setExporting(false);
  };

  // 'replace' wipes every list, so confirm before the file dialog opens.
  const handlePickImport = (mode) => {
    setImportOpen(false);
    if (mode === 'replace' && !window.confirm(
      'Replace ALL your watchlists with the contents of this file? Your current lists are deleted first. This cannot be undone.'
    )) return;
    importModeRef.current = mode;
    onImportMessage(null);
    fileRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file fires onChange again
    if (!file) return;
    setImporting(true);
    const res = await importWatchlists(file, importModeRef.current);
    setImporting(false);
    if (res.ok) {
      const parts = [`Imported ${res.imported} item${res.imported === 1 ? '' : 's'}`];
      if (res.skipped) parts.push(`skipped ${res.skipped}`);
      onImportMessage({ ok: true, text: `${parts.join(', ')}.` });
    } else {
      onImportMessage({ ok: false, text: res.error || 'Import failed.' });
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5 shrink-0">
        <div ref={importRef} className="relative">
          <button
            onClick={() => setImportOpen(o => !o)}
            disabled={importing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-crimson-900/60 bg-crimson-950/40 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Upload className={`w-4 h-4 ${importing ? 'animate-pulse' : ''}`} />
            <span>{importing ? 'Importing…' : 'Import'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${importOpen ? 'rotate-180' : ''}`} />
          </button>

          {importOpen && (
            <div className="absolute right-0 mt-2 w-52 z-20 rounded-xl border border-crimson-900/60 bg-crimson-950 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => handlePickImport('merge')}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors"
              >
                <span>Merge</span>
                <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Add to lists</span>
              </button>
              <button
                onClick={() => handlePickImport('replace')}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors border-t border-crimson-900/40"
              >
                <span>Replace</span>
                <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Wipe &amp; restore</span>
              </button>
            </div>
          )}
        </div>

        <div ref={exportRef} className="relative">
          <button
            onClick={() => setExportOpen(o => !o)}
            disabled={exporting || !canExport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-crimson-900/60 bg-crimson-950/40 text-crimson-300 text-xs font-black uppercase tracking-widest hover:text-white hover:border-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
            <span>{exporting ? 'Exporting…' : 'Export'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-44 z-20 rounded-xl border border-crimson-900/60 bg-crimson-950 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors"
              >
                <span>CSV</span>
                <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Spreadsheet</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-xs font-bold text-crimson-200 hover:bg-crimson-900/50 hover:text-white transition-colors border-t border-crimson-900/40"
              >
                <span>JSON</span>
                <span className="text-[9px] text-crimson-600 uppercase tracking-wider">Backup</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        onChange={handleImportFile}
        className="hidden"
      />
    </>
  );
};

export default WatchlistTransfer;

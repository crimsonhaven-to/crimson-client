// Members find each other by handle, so messaging asks for one before anything else.
import { useState } from 'react';
import { AtSign, Check, Loader2 } from 'lucide-react';

import { messagesApi } from './api';
import { HANDLE_PATTERN, normalizeHandle } from './format';

export default function HandleSetup({ current = null }) {
  const [draft, setDraft] = useState(current || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handle = normalizeHandle(draft);
  const valid = HANDLE_PATTERN.test(handle);
  const dirty = handle !== (current || '');

  const save = async (e) => {
    e.preventDefault();
    if (!valid || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await messagesApi.setHandle(handle);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      window.dispatchEvent(new Event('crimson-profile'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-6 shadow-2xl">
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-crimson-500">
          <AtSign className="w-6 h-6" />
          <h3 className="text-lg font-black text-crimson-50 uppercase tracking-tighter">Your Handle</h3>
        </div>
        <p className="text-xs text-crimson-400 font-medium leading-relaxed max-w-md">
          {current
            ? 'Other members message you by this name. Changing it keeps your chats; they just see the new one.'
            : 'Pick the name other members find you by to start chatting. 3 to 20 letters, digits or _, starting with a letter.'}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-crimson-500 font-black">@</span>
          <input
            value={draft}
            maxLength={21}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Handle"
            className="w-full pl-10 pr-5 py-4 rounded-2xl bg-crimson-950/50 border border-crimson-900/60 text-crimson-50 placeholder-crimson-400 font-bold tracking-wide focus:outline-none focus:border-crimson-500/60 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!valid || !dirty || saving}
          className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white text-[11px] font-black uppercase tracking-widest transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {draft && !valid && (
        <p className="text-xs text-amber-400 font-bold">3 to 20 letters, digits or _, starting with a letter.</p>
      )}
      {error && <p className="text-xs text-amber-400 font-bold">{error}</p>}
    </form>
  );
}

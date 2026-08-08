// Admin › Lumi tab. Operator control for the chatbot: the master switch, which
// provider and model answers, spend guards, and what it has actually cost.
//
// Deliberately NOT here: API keys (they live in the backend's environment so a
// database dump never carries billable credentials, and this tab is told only
// whether each one is present) and per-user access grants (those sit on the
// Users tab next to the admin flag, because granting a person access is a
// user-management action).
import { useCallback, useEffect, useState } from 'react';
import { Bot, Coins, KeyRound, RefreshCw, Save, Sparkles, Users } from 'lucide-react';

import { adminApi } from '../adminApi';
import { StatCard } from './ui';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', hint: 'Claude. Strongest at staying in character and picking tool arguments.' },
  { id: 'gemini', label: 'Google AI Studio', hint: 'Gemini. Cheapest per token; Flash-Lite is the budget floor.' },
];

// Costs are stored as USD millionths so the ledger never touches a float. Both
// helpers round for display only.
const usd = (micros) => `$${((micros || 0) / 1_000_000).toFixed(2)}`;
const compactTokens = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
};

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-widest text-crimson-500">{label}</span>
      {children}
      {hint && <span className="block text-[10px] font-bold text-crimson-700 leading-relaxed">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-50 text-sm font-bold focus:outline-none focus:border-crimson-500 transition-all disabled:opacity-40';

export default function LumiTab({ notify }) {
  const [data, setData] = useState(null); // GET /admin/chat/settings payload
  const [usage, setUsage] = useState(null);
  const [draft, setDraft] = useState(null); // local edits, committed on Save
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, use] = await Promise.all([adminApi.chatSettings(), adminApi.chatUsage(30)]);
      setData(settings);
      setDraft(settings.settings);
      setUsage(use);
    } catch {
      notify('Failed to load Lumi settings', false);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  if (loading || !draft) {
    return <div className="py-16 text-center text-crimson-600 animate-pulse text-[10px] font-black uppercase tracking-[0.3em]">Rousing the empress…</div>;
  }

  const keyPresent = data.keys?.[draft.provider];
  const modelsForProvider = data.models?.[draft.provider] || [];
  // Switching provider must also move the model, or Save would be rejected for
  // pairing a model with the wrong vendor.
  const setProvider = (provider) => {
    const first = data.models?.[provider]?.[0];
    setDraft({ ...draft, provider, model: first ? first.id : draft.model });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateChatSettings({
        enabled: draft.enabled,
        provider: draft.provider,
        model: draft.model,
        monthly_token_budget: Number(draft.monthly_token_budget) || 0,
        history_turns: Number(draft.history_turns),
        max_tool_iterations: Number(draft.max_tool_iterations),
      });
      if (res.settings) {
        setData(res);
        setDraft(res.settings);
        notify('Lumi updated', true);
      } else notify(res.detail || 'Save failed', false);
    } catch {
      notify('Save failed', false);
    } finally {
      setSaving(false);
    }
  };

  const selectedModel = modelsForProvider.find((m) => m.id === draft.model);

  return (
    <div className="space-y-6">
      {/* Spend at a glance. The estimate caveat matters: these are computed from
          published rates at call time, not pulled from a vendor invoice. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Month to date" value={usd(usage?.month_to_date_cost_micros)} sub="estimated" icon={Coins} accent="text-amber-400" />
        <StatCard label="Last 30 days" value={usd(usage?.totals?.cost_micros)} sub={`${usage?.totals?.calls || 0} calls`} icon={Sparkles} accent="text-crimson-400" />
        <StatCard label="Tokens (30d)" value={compactTokens((usage?.totals?.input_tokens || 0) + (usage?.totals?.output_tokens || 0) + (usage?.totals?.cached_tokens || 0))} sub={`${compactTokens(usage?.totals?.cached_tokens)} cached`} icon={Bot} accent="text-crimson-400" />
        <StatCard label="Granted" value={usage?.users_granted ?? 0} sub={`${usage?.conversations ?? 0} threads`} icon={Users} accent="text-green-400" />
      </div>

      <div className="bg-crimson-950/30 border border-crimson-900/40 rounded-2xl p-4 sm:p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-crimson-500" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-crimson-400">Configuration</h3>
          <button
            onClick={load}
            className="ml-auto p-2 rounded-xl bg-crimson-950/60 border border-crimson-900/60 text-crimson-400 hover:border-crimson-500/50 transition-all"
            title="Reload"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Key presence is an environment fact, so it is reported rather than
            edited. Saying which env var to set turns a dead end into a fix. */}
        <div className="grid sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
                data.keys?.[p.id]
                  ? 'bg-green-950/30 border-green-800/40 text-green-300'
                  : 'bg-crimson-950/40 border-crimson-900/50 text-crimson-700'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="truncate">
                {p.label} key {data.keys?.[p.id] ? 'present' : 'missing'}
              </span>
            </div>
          ))}
        </div>

        {!data.sdk?.anthropic && (
          <p className="text-xs font-bold text-amber-400 leading-relaxed">
            This build has no <code className="text-amber-300">anthropic</code> package installed, so only Gemini can answer. Rebuild the image to enable Claude.
          </p>
        )}

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="accent-crimson-600 w-4 h-4"
          />
          <span className="text-sm font-bold text-crimson-50">Lumi is awake</span>
          <span className="text-[10px] font-bold text-crimson-700">
            Master switch. Members still need an individual grant on the Users tab.
          </span>
        </label>

        {draft.enabled && !keyPresent && (
          <p className="text-xs font-bold text-crimson-500 leading-relaxed">
            No API key is configured for {draft.provider}. Set{' '}
            <code className="text-crimson-400">
              {draft.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'}
            </code>{' '}
            in the backend environment, or the save will be rejected.
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Provider" hint={PROVIDERS.find((p) => p.id === draft.provider)?.hint}>
            <select value={draft.provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Model"
            hint={
              selectedModel
                ? `${selectedModel.note} Roughly $${selectedModel.input_per_mtok}/M in, $${selectedModel.output_per_mtok}/M out.`
                : undefined
            }
          >
            <select value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className={inputCls}>
              {modelsForProvider.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Monthly token budget"
            hint="Per member, across every conversation. The check runs before each reply, so it stops the next message rather than cutting one in half. 0 disables the cap."
          >
            <input
              type="number"
              min={0}
              step={100000}
              value={draft.monthly_token_budget}
              onChange={(e) => setDraft({ ...draft, monthly_token_budget: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="History turns" hint="How many past exchanges Lumi is reminded of. The main lever on what a long conversation costs.">
            <input
              type="number"
              min={1}
              max={50}
              value={draft.history_turns}
              onChange={(e) => setDraft({ ...draft, history_turns: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="Max tool rounds" hint="Ceiling on tool calls within one reply. Bounds a model that decides to keep searching.">
            <input
              type="number"
              min={1}
              max={10}
              value={draft.max_tool_iterations}
              onChange={(e) => setDraft({ ...draft, max_tool_iterations: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-3 bg-crimson-600 hover:bg-crimson-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Per-member spend, so an unusual bill has a name attached to it. */}
      <div className="bg-crimson-950/30 border border-crimson-900/40 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-crimson-500" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-crimson-400">Spend by member · last 30 days</h3>
        </div>
        {usage?.per_user?.length ? (
          usage.per_user.map((u) => (
            <div key={u.user_id} className="flex items-center gap-4 py-2 border-b border-crimson-900/30 last:border-0">
              <span className="text-sm font-bold text-crimson-50 truncate flex-grow">
                {u.username || u.email || `User #${u.user_id}`}
              </span>
              <span className="text-[10px] font-bold text-crimson-700 tracking-wide flex-shrink-0">
                {u.calls} calls · {compactTokens(u.tokens)} tokens
              </span>
              <span className="text-sm font-black text-amber-400 tabular-nums flex-shrink-0 w-16 text-right">
                {usd(u.cost_micros)}
              </span>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-crimson-700 text-[10px] font-black uppercase tracking-[0.3em] italic">
            Nobody has spoken to her yet
          </p>
        )}
        <p className="text-[10px] font-bold text-crimson-700 leading-relaxed pt-1">
          Costs are estimated from published per-million rates at call time, not read from a vendor invoice, so they track spend closely but will not match a bill to the cent.
        </p>
      </div>
    </div>
  );
}

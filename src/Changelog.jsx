import { Link } from 'react-router-dom';
import { ScrollText, Tag, Calendar, ExternalLink, Sparkles, AlertCircle, Moon, ArrowLeft, FlaskConical } from 'lucide-react';
import { useChangelog, useTitle } from './hooks';
import { formatReleaseDate } from './utils';

// ---------------------------------------------------------------------------
// Minimal, dependency-free Markdown renderer for GitHub release notes.
//
// The project ships no markdown library, and release `body` text is authored by
// us — but to stay safe we build React elements directly (never
// dangerouslySetInnerHTML), so nothing in a release note can inject markup.
// It covers the subset release notes actually use: headings, bullet/numbered
// lists, bold/italic/inline-code, links, and horizontal rules. Anything else
// falls through as plain paragraph text.
// ---------------------------------------------------------------------------

// Inline spans: **bold**, __bold__, *italic*, _italic_, `code`, [text](url).
const INLINE_RE =
  /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;

function renderInline(text, keyPrefix) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [, , bold1, bold2, italic1, italic2, code, linkText, linkUrl] = match;
    const key = `${keyPrefix}-${i++}`;
    if (bold1 != null || bold2 != null) {
      nodes.push(<strong key={key} className="font-black text-crimson-50">{bold1 ?? bold2}</strong>);
    } else if (italic1 != null || italic2 != null) {
      nodes.push(<em key={key} className="italic text-crimson-200/90">{italic1 ?? italic2}</em>);
    } else if (code != null) {
      nodes.push(
        <code key={key} className="font-mono text-[0.85em] px-1.5 py-0.5 rounded-md bg-crimson-950/60 border border-crimson-900/60 text-crimson-300">
          {code}
        </code>
      );
    } else if (linkText != null) {
      // Only allow http(s) hrefs — anything else renders as plain text.
      const safe = /^https?:\/\//i.test(linkUrl);
      nodes.push(
        safe ? (
          <a
            key={key}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crimson-400 hover:text-crimson-300 underline underline-offset-2 decoration-crimson-700/60 transition-colors"
          >
            {linkText}
          </a>
        ) : (
          linkText
        )
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Group lines into block-level elements (headings, lists, rules, paragraphs).
function renderMarkdown(body) {
  if (!body || !body.trim()) {
    return <p className="italic text-crimson-300/40">No notes were left for this release.</p>;
  }
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null; // { ordered: bool, items: [] }
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      const text = para.join(' ');
      blocks.push(
        <p key={`p-${key++}`} className="leading-relaxed">{renderInline(text, `p${key}`)}</p>
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag
          key={`l-${key++}`}
          className={`space-y-1.5 pl-1 ${list.ordered ? 'list-decimal list-inside' : ''}`}
        >
          {list.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed flex gap-3">
              {!list.ordered && <span className="text-crimson-500 font-black select-none mt-0.5">›</span>}
              <span className="flex-1">{renderInline(item, `li${key}-${idx}`)}</span>
            </li>
          ))}
        </Tag>
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flushPara(); flushList(); continue; }

    // Horizontal rule
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushPara(); flushList();
      blocks.push(<hr key={`hr-${key++}`} className="border-crimson-900/40" />);
      continue;
    }

    // Headings (#..######)
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); flushList();
      const level = heading[1].length;
      const cls = level <= 2
        ? 'text-lg font-black text-white uppercase tracking-tight'
        : 'text-sm font-black text-crimson-300 uppercase tracking-widest';
      blocks.push(<p key={`h-${key++}`} className={`${cls} mt-2`}>{renderInline(heading[2], `h${key}`)}</p>);
      continue;
    }

    // Unordered list item (-, *, +)
    const ul = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
      continue;
    }

    // Ordered list item (1. 2. ...)
    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
      continue;
    }

    // Plain paragraph text
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();

  return <div className="space-y-4">{blocks}</div>;
}

// One release card.
function ReleaseEntry({ entry, latest }) {
  return (
    <article className="relative bg-crimson-950/40 backdrop-blur-xl border border-crimson-900/50 rounded-[2rem] p-6 sm:p-8 shadow-2xl overflow-hidden transition-colors hover:border-crimson-800/60">
      <div className="absolute top-0 right-0 p-5 opacity-[0.07] pointer-events-none">
        <ScrollText className="w-20 h-20 text-crimson-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-crimson-500/10 border border-crimson-500/30 rounded-xl text-crimson-300 font-black tracking-tight">
          <Tag className="w-3.5 h-3.5" />
          {entry.tag || entry.name}
        </span>
        {latest && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-crimson-500/15 border border-crimson-500/30 rounded-full text-[9px] font-black uppercase tracking-[0.25em] text-crimson-400">
            <Sparkles className="w-3 h-3" /> Latest Decree
          </span>
        )}
        {entry.prerelease && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-crimson-900/40 border border-crimson-800/50 rounded-full text-[9px] font-black uppercase tracking-[0.25em] text-crimson-500">
            <FlaskConical className="w-3 h-3" /> Pre-release
          </span>
        )}
      </div>

      {entry.name && entry.name !== entry.tag && (
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-3 leading-tight">{entry.name}</h3>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-crimson-600 mb-6">
        {entry.published_at && (
          <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {formatReleaseDate(entry.published_at)}</span>
        )}
        {entry.author && <span className="text-crimson-700">Inscribed by {entry.author}</span>}
      </div>

      <div className="text-sm sm:text-base text-crimson-100/70 font-medium space-y-4">
        {renderMarkdown(entry.body)}
      </div>

      {entry.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-7 text-[10px] font-black uppercase tracking-[0.25em] text-crimson-500 hover:text-crimson-400 transition-colors group"
        >
          View on GitHub
          <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </a>
      )}
    </article>
  );
}

export default function ChangelogPage() {
  const { entries, meta, loading, error, notConfigured } = useChangelog();
  useTitle('The Crimson Chronicle');

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* Header */}
      <div className="border-b border-crimson-900/30 pb-8 space-y-3">
        <Link
          to="/about"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600 hover:text-crimson-400 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to the Haven
        </Link>
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter flex items-center gap-4 leading-none">
          <ScrollText className="w-10 h-10 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]" />
          The <span className="text-crimson-500">Chronicle</span>
        </h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">
          Every decree the Queen has etched into the Haven
        </p>
      </div>

      {/* Queen's intro flavour */}
      <div className="relative bg-crimson-500/5 backdrop-blur-md border border-crimson-500/20 p-7 sm:p-8 rounded-[2.5rem] shadow-xl">
        <div className="absolute -top-3 left-10 px-4 py-1 bg-crimson-500 rounded-full text-[8px] font-black uppercase tracking-[0.3em] text-white">Queen's Decree</div>
        <p className="italic text-crimson-100/90 leading-relaxed text-base sm:text-lg tracking-tight">
          "Every refinement to my Haven is recorded here, darling~ Each version a little ritual,
          each fix a drop of my centuries-old devotion. Scroll, and witness how I keep our sanctuary <span className="text-white not-italic font-black border-b-2 border-crimson-500/50">flawless</span> for you."
        </p>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-500 flex items-center gap-3">
          <span className="block w-8 h-px bg-crimson-500/50"></span>
          Luminas Crimsonveil, the Vampire Queen
        </p>
      </div>

      {/* Stale notice — last-known notes when GitHub was unreachable. */}
      {meta?.stale && entries.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-crimson-900/20 border border-crimson-900/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-crimson-500">
          <AlertCircle className="w-4 h-4 shrink-0" />
          These are the last-known chronicles — the archive could not be refreshed just now.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-crimson-900 rounded-full opacity-20"></div>
            <div className="absolute inset-0 border-4 border-crimson-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-crimson-600 animate-pulse">Unsealing the chronicle</p>
        </div>
      )}

      {/* Not configured — the engine slumbers (backend has no GITHUB_TOKEN). */}
      {!loading && notConfigured && (
        <div className="text-center py-16 space-y-5 bg-crimson-950/30 border border-crimson-900/40 rounded-[2.5rem] px-8">
          <Moon className="w-12 h-12 text-crimson-700 mx-auto" />
          <h3 className="text-xl font-black text-white uppercase tracking-tight">The Chronicle Slumbers</h3>
          <p className="text-sm text-crimson-300/60 font-medium max-w-md mx-auto leading-relaxed italic">
            "The archive is sealed for now, little mortal. My scribes have yet to be granted their quill —
            return soon, and the chronicle shall awaken."
          </p>
        </div>
      )}

      {/* Hard error (network, unexpected status) */}
      {!loading && !notConfigured && error && (
        <div className="text-center py-16 space-y-4 bg-crimson-500/5 border border-crimson-500/20 rounded-[2.5rem] px-8">
          <AlertCircle className="w-10 h-10 text-crimson-500 mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-widest text-crimson-400">System Message: {error}</p>
          <p className="text-sm text-crimson-300/50 italic">The chronicle could not be summoned. Try again in a moment.</p>
        </div>
      )}

      {/* Empty (configured, but no releases yet) */}
      {!loading && !notConfigured && !error && entries.length === 0 && (
        <div className="text-center py-16 space-y-4 bg-crimson-950/30 border border-crimson-900/40 rounded-[2.5rem] px-8">
          <ScrollText className="w-12 h-12 text-crimson-700 mx-auto" />
          <p className="text-sm text-crimson-300/60 font-medium italic">"No decrees have been etched yet, darling. The first page awaits."</p>
        </div>
      )}

      {/* The chronicle itself */}
      {!loading && entries.length > 0 && (
        <div className="space-y-8">
          {entries.map((entry, idx) => (
            <ReleaseEntry key={entry.tag || entry.url || idx} entry={entry} latest={idx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

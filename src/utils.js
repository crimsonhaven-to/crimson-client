// AniList synopses arrive as HTML (<br>, <i>, source notes). Strip the tags down
// to the plain text we render in our own panels.
//
// We hand the markup to the browser's HTML parser and read back its text, rather
// than deleting tags with a regex. A single-pass regex tag-stripper is easy to
// slip past — e.g. an unterminated `<script` (no closing `>`) matches nothing and
// survives verbatim — whereas the parser fully neutralises any markup it's given.
// (Parsing is inert: `parseFromString` never runs scripts or loads resources.)
export function stripHtml(html) {
  if (!html) return '';
  // Preserve <br> as a visible break — the parser would otherwise drop it to
  // nothing, gluing the surrounding words together.
  const withBreaks = String(html).replace(/<br\s*\/?>/gi, ' ');
  const text =
    new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

// Pretty, human date for a release. Falls back to the raw string if unparseable.
// (Shared by the changelog page and the About-page preview — kept here, in a
// JSX-free module, so the preview doesn't pull in the lazy Changelog chunk.)
export function formatReleaseDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Strip markdown down to a one-glance plain-text excerpt (used by the About-page
// preview). Drops headings/list markers/emphasis/links so a few clean lines show.
export function changelogExcerpt(body, maxChars = 240) {
  if (!body) return '';
  const text = body
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')              // heading markers
    .replace(/^[-*+]\s+/gm, '• ')             // bullets → •
    .replace(/^\d+[.)]\s+/gm, '')             // numbered markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // bold
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')          // italic
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → text
    .replace(/^[-*_]{3,}$/gm, '')             // rules
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…';
}

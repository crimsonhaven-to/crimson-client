// AniList synopses arrive as HTML. A regex tag-stripper is easy to slip past (an
// unterminated `<script` survives verbatim), so let the inert DOMParser do it.
export function stripHtml(html) {
  if (!html) return '';
  // The parser drops <br> to nothing, which would glue the surrounding words together.
  const withBreaks = String(html).replace(/<br\s*\/?>/gi, ' ');
  const text =
    new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

// Lives in this JSX-free module so the About-page preview doesn't pull in the lazy
// Changelog chunk.
export function formatReleaseDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function changelogExcerpt(body, maxChars = 240) {
  if (!body) return '';
  const text = body
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…';
}

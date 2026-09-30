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

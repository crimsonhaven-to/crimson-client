// AniList synopses arrive as HTML (<br>, <i>, source notes). Strip the tags down
// to the plain text we render in our own panels.
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

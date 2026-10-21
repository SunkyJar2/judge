/**
 * Ultra-fast, zero-dependency HTML sanitizer safe for Node, Serverless, and Edge runtimes.
 * Protects against XSS by removing executable tags, event handlers, and malicious URIs.
 */
export function sanitizeHtmlSimple(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  return dirtyHtml
    // Strip dangerous tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(iframe|embed|object|applet|base)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
    .replace(/<(iframe|embed|object|applet|base)\b[^>]*>/gi, '')
    // Strip inline event attributes (e.g. onload, onerror, onclick, onmouseover)
    .replace(/\s+on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    // Disarm javascript:, vbscript:, and non-image data: URIs in href, src, or form action
    .replace(/(href|src|action)\s*=\s*(['"])\s*(?:javascript:|vbscript:|data:(?!image\/)[^'"]*)/gi, '$1=$2#');
}

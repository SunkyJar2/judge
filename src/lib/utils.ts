/**
 * Returns a URL path for a problem that preserves forward slash route segments
 * while encoding URI-sensitive characters like spaces and symbols.
 * Prevents %2F encoding issues with SvelteKit rest params [...id].
 */
export function getProblemHref(id: string): string {
  if (!id) return '/problems';
  const segments = id.split('/').map(seg => encodeURIComponent(seg));
  return `/problems/${segments.join('/')}`;
}

/**
 * Returns an API URL path for problem statements, PDF downloads, or details.
 */
export function getProblemApiHref(id: string, subpath: string = ''): string {
  if (!id) return '/api/problems';
  const segments = id.split('/').map(seg => encodeURIComponent(seg));
  const base = `/api/problems/${segments.join('/')}`;
  return subpath ? `${base}/${subpath}` : base;
}

/**
 * Domain lists as the API's web tools read them: an entry names a host with no scheme, its
 * subdomains included, compared without case; a path after the host narrows it to URLs under
 * that path (a trailing `*` changes nothing). WebSearch applies the lists itself once the hook
 * injects them; the hook checks a WebFetch URL against them.
 */

interface DomainRule {
  host: string;
  path: string;
}

function ruleOf(entry: string): DomainRule {
  const bare = entry.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\*+$/, '');
  const slash = bare.indexOf('/');
  const host = (slash < 0 ? bare : bare.slice(0, slash)).toLowerCase().replace(/^\*\./, '');
  return { host, path: slash < 0 ? '' : bare.slice(slash) };
}

function matches(url: URL, entry: string): boolean {
  const { host, path } = ruleOf(entry);
  const hostname = url.hostname.toLowerCase();
  const onHost = hostname === host || hostname.endsWith(`.${host}`);
  return onHost && underPath(url.pathname, path);
}

function underPath(pathname: string, path: string): boolean {
  if (path === '' || path === '/') return true;
  const prefix = path.endsWith('/') ? path : `${path}/`;
  return pathname === path || pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
}

/** Whether `url` falls under any of `entries`. */
export function onDomainList(url: URL, entries: readonly string[]): boolean {
  return entries.some(entry => matches(url, entry));
}

/** `text` as an absolute URL, or undefined. */
export function parseUrl(text: unknown): URL | undefined {
  if (typeof text !== 'string') return undefined;
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

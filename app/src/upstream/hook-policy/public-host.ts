/**
 * Keeping web fetch off the operator's network (spec section 8). Upstream's WebFetch runs on the
 * wrapper's machine, so unless the operator turns it off the hook lets a fetch through only when
 * its URL's host is public: an `http` or `https` URL whose host is a public IP address, or a name
 * that is not `localhost` (or under it) and resolves only to public addresses. A name is resolved
 * when its call is decided, through `ResolveHost` (injected; DNS in production), and a name that
 * does not resolve is refused: the check fails closed. Two limits remain, stated in the operator
 * docs: upstream follows redirects the hook never sees, and upstream resolves the name again
 * itself (the answer is checked at decision time only).
 */
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { isPublicAddress } from './public-address';

/** Every address `hostname` resolves to; rejects when it resolves to none. */
export type ResolveHost = (hostname: string) => Promise<readonly string[]>;

/** Where a WebFetch may go: public hosts only (the default), names resolved by `resolveHost`; or anywhere. */
export type WebFetchReach = { publicOnly: true; resolveHost: ResolveHost } | { publicOnly: false };

/** The system resolver (`getaddrinfo`, as upstream's own fetch resolves), every address it gives. */
export const resolveWithSystem: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map(entry => entry.address);

/** The URL's host as resolvers and the classifier read it: no IPv6 brackets, no trailing dot. */
const hostOf = (url: URL): string => url.hostname.replace(/^\[(.*)\]$/, '$1').replace(/\.+$/, '');

const isLocalhost = (host: string): boolean => host === 'localhost' || host.endsWith('.localhost');

async function resolvesToPublic(host: string, resolveHost: ResolveHost): Promise<string | undefined> {
  let addresses: readonly string[];
  try {
    addresses = await resolveHost(host);
  } catch {
    addresses = [];
  }
  if (addresses.length === 0) return `${host} could not be resolved to check that it is public`;
  return addresses.every(isPublicAddress) ? undefined : `${host} resolves to an address that is not public`;
}

/** Why `url` may not be fetched under public-only reach, or undefined when its host is public. */
export async function nonPublicHost(url: URL, resolveHost: ResolveHost): Promise<string | undefined> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return `${url.protocol} URLs are not fetched`;
  const host = hostOf(url);
  if (isLocalhost(host)) return `${host} is not a public address`;
  if (isIP(host) !== 0) return isPublicAddress(host) ? undefined : `${host} is not a public address`;
  return resolvesToPublic(host, resolveHost);
}

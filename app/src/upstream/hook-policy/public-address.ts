/**
 * Public IP addresses (spec section 8, web fetch): the only ones a WebFetch may reach while the
 * operator keeps web fetch off their own network. Public means globally routable unicast, after
 * the IANA special-purpose registries: an IPv4 address outside every special range below, an
 * IPv6 address inside global unicast (`2000::/3`) and outside its special blocks. An IPv6 address
 * that carries an IPv4 address (IPv4-mapped, NAT64, 6to4) is as public as the address it carries.
 * Anything that is not an IP address is not a public address.
 */
import { isIPv4, isIPv6 } from 'net';

/** IPv4 ranges that are not public: [network, prefix length]. */
const SPECIAL_IPV4: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8], // "this network", the unspecified address included
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // shared address space (carrier-grade NAT)
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, where cloud metadata endpoints answer
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4] // reserved, the broadcast address included
];

const ipv4Number = (address: string): number =>
  address.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);

const inRange = (value: number, [network, prefix]: readonly [string, number]): boolean => {
  const size = 2 ** (32 - prefix);
  return Math.floor(value / size) === Math.floor(ipv4Number(network) / size);
};

function isPublicIpv4(value: number): boolean {
  return !SPECIAL_IPV4.some(range => inRange(value, range));
}

/** The eight 16-bit groups of an address `isIPv6` accepted, its zone dropped. */
function ipv6Groups(address: string): number[] {
  const hex = address.replace(/%.*$/, '').replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_all, a, b, c, d) =>
    `${(Number(a) * 256 + Number(b)).toString(16)}:${(Number(c) * 256 + Number(d)).toString(16)}`);
  const [head = '', tail] = hex.split('::');
  const groups = (part: string) => (part === '' ? [] : part.split(':').map(group => parseInt(group, 16)));
  const left = groups(head);
  const right = tail === undefined ? [] : groups(tail);
  return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
}

const embeddedIpv4 = (high: number, low: number): number => high * 65536 + low;

function isPublicIpv6(g: number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  const zeroTo = (end: number) => g.slice(0, end).every(group => group === 0);
  if (zeroTo(5) && g5 === 0xffff) return isPublicIpv4(embeddedIpv4(g6, g7)); // IPv4-mapped
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isPublicIpv4(embeddedIpv4(g6, g7)); // NAT64
  }
  if (g0 === 0x2002) return isPublicIpv4(embeddedIpv4(g1, g2)); // 6to4
  if ((g0 & 0xe000) !== 0x2000) return false; // outside global unicast: loopback, unique local, link-local, multicast...
  if (g0 === 0x2001 && g1 < 0x200) return false; // IETF protocol assignments, Teredo included
  if (g0 === 0x2001 && g1 === 0xdb8) return false; // documentation
  return !(g0 === 0x3fff && g1 < 0x1000); // documentation (3fff::/20)
}

/** Whether `address` (an IP address, as text) is globally routable unicast. */
export function isPublicAddress(address: string): boolean {
  if (isIPv4(address)) return isPublicIpv4(ipv4Number(address));
  if (isIPv6(address)) return isPublicIpv6(ipv6Groups(address));
  return false;
}

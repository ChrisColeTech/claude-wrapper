/**
 * Which IP addresses a WebFetch may reach while the operator keeps web fetch to public addresses:
 * only globally routable unicast. The expected values come from the IANA special-purpose address
 * registries (IPv4 and IPv6), not from the classifier's own tables.
 */
import { isPublicAddress } from '../../../src/upstream/hook-policy/public-address';

describe('isPublicAddress: IPv4', () => {
  it.each([
    '8.8.8.8', '1.1.1.1', '93.184.215.14', '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0',
    '192.169.0.1', '198.17.255.255', '198.20.0.0', '223.255.255.255'
  ])('%s is public', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ['0.0.0.0', 'unspecified'],
    ['0.1.2.3', '"this network"'],
    ['10.0.0.1', 'private'],
    ['100.64.0.1', 'shared address space (carrier-grade NAT)'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['169.254.169.254', 'link-local (cloud metadata)'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.0.0.8', 'IETF protocol assignments'],
    ['192.0.2.1', 'documentation'],
    ['192.88.99.1', '6to4 relay anycast'],
    ['192.168.1.1', 'private'],
    ['198.18.0.1', 'benchmarking'],
    ['198.51.100.1', 'documentation'],
    ['203.0.113.1', 'documentation'],
    ['224.0.0.1', 'multicast'],
    ['239.255.255.250', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'broadcast']
  ])('%s is not public (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe('isPublicAddress: IPv6', () => {
  it.each([
    ['2606:4700:4700::1111', 'global unicast'],
    ['2001:4860:4860::8888', 'global unicast'],
    ['2a00:1450:4001:80b::200e', 'global unicast'],
    ['::ffff:8.8.8.8', 'IPv4-mapped, of a public address'],
    ['64:ff9b::808:808', 'NAT64 of a public address'],
    ['2002:808:808::1', '6to4 of a public address']
  ])('%s is public (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ['::', 'unspecified'],
    ['::1', 'loopback'],
    ['0:0:0:0:0:0:0:1', 'loopback, written in full'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback, in hex'],
    ['::ffff:10.0.0.1', 'IPv4-mapped private'],
    ['::ffff:169.254.169.254', 'IPv4-mapped link-local'],
    ['::127.0.0.1', 'IPv4-compatible (deprecated)'],
    ['64:ff9b::a00:1', 'NAT64 of a private address'],
    ['64:ff9b::7f00:1', 'NAT64 of loopback'],
    ['64:ff9b:1::1', 'local-use NAT64'],
    ['2002:7f00:1::1', '6to4 of loopback'],
    ['2002:c0a8:101::1', '6to4 of a private address'],
    ['100::1', 'discard-only'],
    ['2001::1', 'Teredo (IETF protocol assignments)'],
    ['2001:db8::1', 'documentation'],
    ['3fff::1', 'documentation'],
    ['5f00::1', 'segment routing'],
    ['fc00::1', 'unique local'],
    ['fd12:3456:789a::1', 'unique local'],
    ['fe80::1', 'link-local'],
    ['fe80::1%eth0', 'link-local, with a zone'],
    ['fec0::1', 'site-local (deprecated)'],
    ['ff02::1', 'multicast']
  ])('%s is not public (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe('isPublicAddress: anything else', () => {
  it.each(['example.com', '', '256.1.1.1', '1.2.3', '[::1]', 'localhost'])('%p is not a public address', (text) => {
    expect(isPublicAddress(text)).toBe(false);
  });
});

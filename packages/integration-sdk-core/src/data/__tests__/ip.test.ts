import { isHost, isInternet, isLoopback, isPublicIp, isIpv4 } from '../ip';

describe('isHost', () => {
  test('returns true if input address is a ipv4 host', () => {
    expect(isHost('192.168.15.100/32')).toEqual(true);
  });

  test('returns true if input address is a ipv6 host', () => {
    expect(isHost('2001:cdba:0000:0000:0000:0000:3257:9652/128')).toEqual(true);
  });

  test('returns false if not a host', () => {
    expect(isHost('192.168.15.100')).toEqual(false);
    expect(isHost('2001:cdba:0000:0000:0000:0000:3257:9652')).toEqual(false);
  });
});

describe('isInternet', () => {
  test('returns true if input ip is the internet (0.0.0.0)', () => {
    expect(isInternet('0.0.0.0')).toEqual(true);
  });

  test('returns true if input ip is the internet (::/0)', () => {
    expect(isInternet('::/0')).toEqual(true);
  });

  test('returns false if input ip is not the internet', () => {
    expect(isInternet('78.101.249.176')).toEqual(false);
  });
});

describe('isLoopback', () => {
  test('returns true if input ip is a loopback address (127.0.0.1)', () => {
    expect(isLoopback('127.0.0.1')).toEqual(true);
  });

  test('returns true if input ip is a loopback address (::1/128)', () => {
    expect(isLoopback('::1/128')).toEqual(true);
  });

  test('returns false if input ip does not represent a loopback address', () => {
    expect(isLoopback('127.0.0.0')).toEqual(false);
  });
});

describe('isPublicIp', () => {
  test('returns true if input address is a public ip', () => {
    expect(isPublicIp('172.16.254.1')).toEqual(false);
  });

  test('returns false if the input ip address is not public', () => {
    expect(isPublicIp('10.0.0.0')).toEqual(false);
    expect(isPublicIp('172.16.0.0')).toEqual(false);
    expect(isPublicIp('192.168.0.0')).toEqual(false);
  });
});

describe('isIpv4', () => {
  test('returns true if input ip is an ipv4 ip', () => {
    expect(isIpv4('192.168.5.0')).toEqual(true);
  });

  test('returns false if input ip is not an ipv4 ip', () => {
    expect(isIpv4('2001:db8:0:1234:0:567:8:1')).toEqual(false);
  });
});

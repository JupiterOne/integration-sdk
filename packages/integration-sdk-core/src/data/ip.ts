export function isHost(ipAddress: string): boolean {
  return (
    (ipAddress.includes(':') && ipAddress.endsWith('/128')) ||
    ipAddress.endsWith('/32')
  );
}

export function isInternet(ipAddress: string): boolean {
  return ipAddress.startsWith('0.0.0.0') || ipAddress === '::/0';
}

export function isLoopback(ipAddress: string): boolean {
  return ipAddress.startsWith('127.0.0.1') || ipAddress === '::1/128';
}

export function isPublicIp(ipAddress: string): boolean {
  return !ipAddress.match(
    /(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)/,
  );
}

export function isIpv4(ipAddress: string): boolean {
  return !!ipAddress.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?:\/[0-9]{1,2})?$/);
}

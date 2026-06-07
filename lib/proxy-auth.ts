export function proxyAuthorizationHeader(proxy: URL) {
  if (!proxy.username && !proxy.password) return {};
  return {
    "Proxy-Authorization": `Basic ${Buffer.from(
      `${decodeUrlCredential(proxy.username)}:${decodeUrlCredential(proxy.password)}`,
    ).toString("base64")}`,
  };
}

function decodeUrlCredential(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Returns true ONLY when the request originates from localhost.
 *
 * Used to gate development-only conveniences (demo-auth fallback and the
 * fail-open billing-row default in pack-guard / feature-gate) so they
 * cannot be triggered by production traffic regardless of the
 * ALLOW_DEMO_AUTH env-var state.
 *
 * Defense-in-depth: both hostname AND remote IP must match. A spoofed
 * Host header alone (hostname check would pass) cannot trigger demo
 * auth, and a spoofed forwarded-for header cannot either (we use
 * req.ip which respects Express's trust-proxy setting and falls back
 * to the actual socket remoteAddress).
 */
export function isLocalhostRequest(req: { hostname?: string; ip?: string }): boolean {
  const hostname = req.hostname?.toLowerCase();
  const ip = req.ip;

  const localhostHostnames = ['localhost', '127.0.0.1', '::1'];
  const localhostIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

  const hostnameMatch = hostname ? localhostHostnames.includes(hostname) : false;
  const ipMatch = ip ? localhostIPs.includes(ip) : false;

  return hostnameMatch && ipMatch;
}

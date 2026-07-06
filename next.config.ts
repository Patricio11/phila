import type { NextConfig } from "next";

/**
 * Security response headers (W2). Applied to every route. We deliberately keep the
 * CSP to directives that don't require per-request nonces (frame-ancestors,
 * object-src, base-uri, form-action) so Next's inline/hydration scripts keep working;
 * a full nonce-based `script-src` is a separate, larger change. Clickjacking is closed
 * by both `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
 */
const SECURITY_HEADERS = [
  // HTTPS only, for two years, incl. subdomains (ignored by browsers over http/localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // No camera/mic/geo by default — the room route re-enables camera+mic for itself below.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev-tools indicator (bottom-left) during local dev.
  devIndicators: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // The in-session video room needs same-origin camera + mic (LiveKit getUserMedia).
      {
        source: "/room/:path*",
        headers: [
          ...SECURITY_HEADERS.filter((h) => h.key !== "Permissions-Policy"),
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;

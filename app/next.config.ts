import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

// The only places the browser may send requests to: this site, the API, and the live-editing WebSocket.
// The NEXT_PUBLIC_* values are the same ones the client bundle is built with.
const connectSources = [
  "'self'",
  originOf(process.env.NEXT_PUBLIC_API_URL),
  originOf(process.env.NEXT_PUBLIC_WS_URL),
].filter((source): source is string => Boolean(source));

// Next.js writes small inline scripts into every page, so script-src has to allow 'unsafe-inline' (a nonce-based
// policy would make every page dynamic). What the policy still does: it stops script injected by a stored XSS from
// sending data to any other host (connect-src, img-src, form-action), loading plugins, or being framed.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Images are only ever this site's own or embedded in a document (data:). Not https:, so a link to another
  // host can't be used to see who reads a shared document.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

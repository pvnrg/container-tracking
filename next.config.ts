import type { NextConfig } from "next";

// Starter CSP: locks script/style/connect/img sources to the app's own
// origin. 'unsafe-inline' is needed for style-src because the UI
// primitives (Base UI dialogs/selects/popovers) inject inline positioning
// styles, and for script-src because Next.js's dev-mode Fast Refresh
// client and hydration bootstrap rely on inline scripts. This is a real
// improvement over having no CSP at all, but it is not a strict/nonce-based
// policy -- tightening script-src further is a separate follow-up that
// needs careful testing against every page.
//
// Strict-Transport-Security is intentionally NOT set here -- it's only
// safe to add once the production deployment actually terminates TLS
// (see the server-side TLS setup), otherwise it would tell browsers to
// force HTTPS on a site that can't yet serve it.
// Turbopack/React's dev-mode Fast Refresh client uses eval() to
// reconstruct stack traces across HMR boundaries -- harmless (React never
// uses eval() in production builds), but needs 'unsafe-eval' to not be
// blocked outright. Scoped to development only so the shipped policy stays
// tight.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // tesseract.js locates its worker script on disk relative to its own
  // package at runtime; bundling it rewrites those paths and breaks that
  // lookup, so it needs to be loaded via native require() instead.
  serverExternalPackages: ["tesseract.js", "pdf-parse"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;

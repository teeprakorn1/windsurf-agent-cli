/** @type {import('next').NextConfig} */
const apiUrl = process.env.AIYU_API_URL || "http://localhost:3000";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.AIYU_WS_URL || "ws://localhost:3000/ws";

const nextConfig = {
  output: "standalone",
  distDir: ".next",
  // experimental: { turbo: { root: "/app" } }, // removed: wrong path for local dev
  env: {
    NEXT_PUBLIC_WS_URL: wsUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY || "",
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "2.7.5",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data:; " +
              "connect-src 'self' ws: wss: http: https:; " +
              "font-src 'self'; " +
              "frame-ancestors 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self';",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

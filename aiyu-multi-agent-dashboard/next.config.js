/** @type {import('next').NextConfig} */
const apiUrl = process.env.AIYU_API_URL || "http://localhost:3000";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.AIYU_WS_URL || "ws://localhost:3000/ws";

const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_WS_URL: wsUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY || "",
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "2.7.0",
  },
};

module.exports = nextConfig;

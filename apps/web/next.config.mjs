/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow dev-mode access via tunnel hostnames (e.g. Pinggy) without the
  // cross-origin /_next warning; localhost ports are allowed by default.
  allowedDevOrigins: [
    "magmm-203-154-14-8.run.pinggy-free.link",
    "dash-1.shadowmart.in",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:4000/uploads/:path*" },
    ];
  },
};

export default nextConfig;

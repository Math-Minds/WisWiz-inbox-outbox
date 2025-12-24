/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow serving files from data directory
  async rewrites() {
    return [
      {
        source: '/data/:path*',
        destination: '/api/media/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

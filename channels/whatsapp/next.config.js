/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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

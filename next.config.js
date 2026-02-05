/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Disable problematic experimental features
  experimental: {
    // Disable lockfile patching that's causing issues
    esmExternals: false,
  },
  // Disable SWC minification that's causing issues
  swcMinify: false,
}

module.exports = nextConfig



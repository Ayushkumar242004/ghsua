/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    WATTSIGHT_BACKEND_URL: process.env.WATTSIGHT_BACKEND_URL || process.env.NEXT_PUBLIC_WATTSIGHT_BACKEND_URL || 'http://localhost:8000',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

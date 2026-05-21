/** @type {import('next').NextConfig} */
const RENDER_URL = 'https://vijey-textile.onrender.com';

const nextConfig = {
  // Embed the API URL at build time.
  // Vercel env var takes priority; Render URL is the production fallback.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || RENDER_URL,
  },

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost',              port: '8000' },
      { protocol: 'https', hostname: 'vijey-textile.onrender.com'              },
    ],
  },
};

module.exports = nextConfig;

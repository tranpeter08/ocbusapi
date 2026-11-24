import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Include the static schedule files in the serverless function that reads them.
  outputFileTracingIncludes: {
    '/api/gtfs/trip': ['./data/gtfs/*.txt'],
    '/api/gtfs/status': ['./data/gtfs/*.txt'],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;

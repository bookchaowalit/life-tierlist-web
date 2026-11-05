import type { NextConfig } from 'next';

// Static export by default: the design-floor CI job serves out/ itself. An app that needs a
// server drops `output` and switches design-floor.json to a "serve" target (see README).
const nextConfig: NextConfig = { output: 'export', trailingSlash: true };

export default nextConfig;

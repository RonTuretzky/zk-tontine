/** @type {import('next').NextConfig} */

// GitHub Pages serves a project site under /<repo>/. Set NEXT_PUBLIC_BASE_PATH
// to that repo path in CI; leave empty for local dev (served at root).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

// The Bread kit re-exports its Privy login variant, which pulls in Privy's full
// bundle. We use general (wallet) auth, so Privy's optional wallet integrations
// are never reached at runtime — stub the ones that aren't installed so the
// bundler doesn't fail resolving them.
const PRIVY_OPTIONAL_STUBS = [
  "@stripe/crypto",
  "@farcaster/mini-app-solana",
  "@react-native-async-storage/async-storage",
]

const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = { ...(config.resolve.alias || {}) }
    for (const m of PRIVY_OPTIONAL_STUBS) config.resolve.alias[m] = false
    config.resolve.fallback = { ...(config.resolve.fallback || {}), "pino-pretty": false }
    return config
  },
}

export default nextConfig

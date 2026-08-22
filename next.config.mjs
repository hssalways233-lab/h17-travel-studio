/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_ACTIONS === 'true'
const basePath = isGithubPages ? '/h17-travel-studio' : ''

const nextConfig = {
  reactStrictMode: true,
  ...(isGithubPages ? { output: 'export' } : {}),
  basePath,
  assetPrefix: basePath,
  trailingSlash: isGithubPages,
  images: { unoptimized: true },
}

export default nextConfig

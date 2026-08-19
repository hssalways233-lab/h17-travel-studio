import './globals.css'
import type { Metadata, Viewport } from 'next'

const basePath = process.env.GITHUB_ACTIONS === 'true' ? '/h17-travel-studio' : ''

export const metadata: Metadata = {
  title: '禾十七 · Travel Content Studio',
  description: '旅行素材、选题、内容制作与小红书数据复盘工作台',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: '禾十七 Studio', statusBarStyle: 'default' }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f2ea'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>
}

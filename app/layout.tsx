import './globals.css'
import './travel-os.css'
import './v2-corrections.css'
import type { Metadata, Viewport } from 'next'
import V2Corrections from '@/components/V2Corrections'

const basePath = process.env.GITHUB_ACTIONS === 'true' ? '/h17-travel-studio' : ''

export const metadata: Metadata = {
  title: '禾十七 · Travel OS',
  description: '手机采集、电脑制作、智能选题与数据复盘的一体化旅行内容工作台',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: '禾十七 Travel OS', statusBarStyle: 'default' }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f1e9'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><V2Corrections/>{children}</body></html>
}

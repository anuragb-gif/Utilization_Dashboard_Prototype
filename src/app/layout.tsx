import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'
import { FilterProvider } from '@/lib/state/filter-context'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Utilization Control Tower | Snowman Logistics',
    template: '%s | Snowman Control Tower',
  },
  description:
    'Pan-India warehouse utilization and capacity control tower for Snowman Logistics - prototype built on demonstration data.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2f53',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <body className="min-h-screen bg-canvas text-ink">
        <FilterProvider>
          <AppShell>{children}</AppShell>
        </FilterProvider>
      </body>
    </html>
  )
}

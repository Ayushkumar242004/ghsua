import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WattSight — UK Wind Forecast Intelligence',
  description: 'Decision support for January 2026 day-ahead wind procurement.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}

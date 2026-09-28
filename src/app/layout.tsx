import type { Metadata } from 'next'
import type React from 'react'
import '../styles.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://wishwell.cards'),
  title: { default: 'Create Beautiful Birthday Cards Online — Free | Wishwell', template: '%s | Wishwell' },
  description: 'Create personalized digital birthday cards with photos, music, messages, and beautiful animations. Free to use.',
  openGraph: { type: 'website', siteName: 'Wishwell', title: 'Create Beautiful Birthday Cards Online — Free', description: 'Personal birthday cards with photos, music, and beautiful animations.' },
  twitter: { card: 'summary_large_image' },
}
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }

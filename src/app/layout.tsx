import type { Metadata } from 'next'
import type React from 'react'
import '../styles.css'
import '../card-polish.css'
import { getSiteUrl } from '../lib/site-url'

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Create Beautiful Birthday Cards Online — Free | Wishwell', template: '%s | Wishwell' },
  description: 'Create personalized digital birthday cards with photos, music, messages, and beautiful animations. Free to use.',
  keywords: [
    'birthday card',
    'digital birthday card',
    'online birthday card maker',
    'free animated birthday card',
    'birthday card with music and photos',
    'happy birthday card maker',
    'wishwell cards',
  ],
  authors: [{ name: 'Wishwell' }],
  creator: 'Wishwell',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Wishwell',
    title: 'Create Beautiful Birthday Cards Online — Free',
    description: 'Personal birthday cards with photos, music, and beautiful animations.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Create Beautiful Birthday Cards Online — Free | Wishwell',
    description: 'Personal birthday cards with photos, music, and beautiful animations.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Wishwell',
  url: siteUrl,
  description: 'Create personalized digital birthday cards with photos, music, messages, and beautiful animations. Free to use.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

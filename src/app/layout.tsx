import type { Metadata } from 'next'
import type React from 'react'
import '../styles.css'
import '../card-polish.css'
import { getSiteUrl } from '../lib/site-url'

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'BirthdaySmile — Create Beautiful Digital Birthday Cards', template: '%s | BirthdaySmile' },
  description: 'Create beautiful digital birthday cards with photos, music, messages, and animations. Make a personal birthday surprise with BirthdaySmile.',
  keywords: [
    'birthday card',
    'digital birthday card',
    'online birthday card maker',
    'animated birthday card maker',
    'birthday card with music and photos',
    'happy birthday card maker',
    'personalized birthday cards',
  ],
  authors: [{ name: 'BirthdaySmile' }],
  creator: 'BirthdaySmile',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'BirthdaySmile',
    title: 'BirthdaySmile — Create Beautiful Digital Birthday Cards',
    description: 'Create a personal birthday card with photos, music, messages, and beautiful animations.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BirthdaySmile — Create Beautiful Digital Birthday Cards',
    description: 'Create a personal birthday card with photos, music, messages, and beautiful animations.',
  },
  verification: {
    google: '7Jw7uZ0XkzPcmhIVnydOHgIf5JbvhR9li3dXpWHKTqs',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BirthdaySmile',
  url: siteUrl,
  description: 'Create beautiful digital birthday cards with photos, music, messages, and animations. Make a personal birthday surprise with BirthdaySmile.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '99',
    priceCurrency: 'USD',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="7Jw7uZ0XkzPcmhIVnydOHgIf5JbvhR9li3dXpWHKTqs" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

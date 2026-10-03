import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Read the BirthdaySmile terms for creating and sharing digital birthday cards.',
}

export default function TermsPage() {
  return <main className="legal-page"><a className="legal-brand" href="/">BirthdaySmile</a><article><span className="eyebrow">LEGAL</span><h1>Terms of service</h1><p>By using BirthdaySmile, you agree to use the service lawfully and provide content that you have permission to upload and share.</p><h2>Cards and accounts</h2><p>You are responsible for your account, card content, and share links. Keep private card links and recipient passwords secure.</p><h2>Service use</h2><p>We may limit or suspend access when necessary to protect users, payment systems, or the service from misuse.</p></article></main>
}

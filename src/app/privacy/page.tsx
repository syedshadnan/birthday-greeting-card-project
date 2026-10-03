import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how BirthdaySmile handles account, card, and payment information.',
}

export default function PrivacyPage() {
  return <main className="legal-page"><a className="legal-brand" href="/">BirthdaySmile</a><article><span className="eyebrow">LEGAL</span><h1>Privacy policy</h1><p>BirthdaySmile uses the information you provide to create, save, protect, and deliver your birthday cards.</p><h2>Information we use</h2><p>We may use your account details, card content, uploaded media, and payment information to provide the service, protect your cards, and support payment verification.</p><h2>Your control</h2><p>You can request help with your account or card information by contacting BirthdaySmile support. We do not sell your personal information.</p></article></main>
}

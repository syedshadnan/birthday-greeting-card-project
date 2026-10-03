import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Read the BirthdaySmile refund policy for digital birthday card purchases.',
}

export default function RefundPage() {
  return <main className="legal-page"><a className="legal-brand" href="/">BirthdaySmile</a><article><span className="eyebrow">LEGAL</span><h1>Refund policy</h1><p>If a mistake occurs on our side and your paid card service cannot be delivered as intended, you may request a refund.</p><h2>Our commitment</h2><p>If the error is caused by BirthdaySmile, we will review the payment and provide a refund where appropriate. Please contact support with your order details so we can investigate.</p><h2>Digital service</h2><p>Because cards are digital and personalized, refund requests are reviewed individually. Payment approval does not guarantee a refund for user-created content or an incorrectly entered recipient or wallet number.</p><p className="legal-note">For refund assistance, contact BirthdaySmile support and include your order ID.</p></article></main>
}

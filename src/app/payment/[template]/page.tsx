import PremiumCheckout from '../../../components/premium-checkout'

export const metadata = { title: 'Premium card payment', robots: { index: false, follow: false } }

export default async function PaymentPage({ params }: { params: Promise<{ template: string }> }) {
  const { template } = await params
  if (template !== 'romantic' && template !== 'cinematic') {
    return <main className="expired"><h1>That premium card isn’t available.</h1><a href="/templates">Choose a card</a></main>
  }

  return <PremiumCheckout template={template} />
}

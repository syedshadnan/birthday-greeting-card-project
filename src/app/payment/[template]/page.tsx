import { redirect } from 'next/navigation'
import { getCurrentUser } from '../../../lib/auth'
import PaymentOrderForm from '../../../components/payment-order-form'

export const metadata = { title: 'Free birthday cards', robots: { index: false, follow: false } }

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ cardId?: string }> }) {
  const { cardId } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/payment/premium?cardId=${cardId ?? ''}`)}`)
  if (!cardId || !/^[a-z0-9]{12,32}$/.test(cardId)) redirect('/account')
  return <main className="payment-page"><span className="eyebrow">PAYMENT</span><h1>Complete your order.</h1><p className="sub">Send exactly 99 BDT. Payment will remain pending until verified by a trusted process.</p><PaymentOrderForm cardId={cardId} /></main>
}

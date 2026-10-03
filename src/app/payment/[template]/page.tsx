import { redirect } from 'next/navigation'
import { getCurrentUser } from '../../../lib/auth'
import PaymentOrderForm from '../../../components/payment-order-form'

export const metadata = { title: 'Free birthday cards', robots: { index: false, follow: false } }

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ cardId?: string }> }) {
  const { cardId } = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/payment/premium?cardId=${cardId ?? ''}`)}`)
  if (!cardId || !/^[a-z0-9]{12,32}$/.test(cardId)) redirect('/account')
  return <main className="payment-page"><a className="payment-brand" href="/"><img src="/images/birthday-smile-logo.png" alt="BirthdaySmile" /><span>Secure payment</span></a><span className="eyebrow">BIRTHDAYSMILE CHECKOUT</span><h1>Complete your payment.</h1><p className="sub">A simple, secure one-time payment of 99 BDT.</p><PaymentOrderForm cardId={cardId} /></main>
}

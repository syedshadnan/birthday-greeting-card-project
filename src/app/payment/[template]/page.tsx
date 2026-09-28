import { redirect } from 'next/navigation'

export const metadata = { title: 'Free birthday cards', robots: { index: false, follow: false } }

export default function PaymentPage() {
  redirect('/create')
}

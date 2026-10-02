import { NextResponse } from 'next/server'
import { getActivePaymentAccount, isPaymentMethod } from '../../../lib/payment-accounts'

export async function GET(request: Request) {
  const method = new URL(request.url).searchParams.get('method')
  if (!isPaymentMethod(method)) {
    return NextResponse.json({ error: 'Choose bKash or Nagad.' }, { status: 400 })
  }

  const account = await getActivePaymentAccount(method)
  if (!account) {
    return NextResponse.json({ error: `${method === 'bkash' ? 'bKash' : 'Nagad'} payment is currently unavailable.` }, { status: 404 })
  }

  return NextResponse.json(
    { method: account.method, accountNumber: account.account_number },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

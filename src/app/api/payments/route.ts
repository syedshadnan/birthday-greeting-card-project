import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '../../../lib/admin-auth'
import { supabaseRequest } from '../../../lib/supabase/server'

const premiumPrices: Record<string, number> = { romantic: 49, cinematic: 49 }
const paymentMethods = new Set(['bkash', 'nagad'])

type DraftCard = { id: string; status: string; template_slug: string }

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Payment request was rejected.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (
      typeof body.cardId !== 'string' || !/^[a-f0-9]{32}$/.test(body.cardId) ||
      typeof body.customerName !== 'string' || body.customerName.trim().length < 2 || body.customerName.length > 100 ||
      typeof body.payerPhone !== 'string' || !/^01\d{9}$/.test(body.payerPhone.replace(/[\s-]/g, '')) ||
      typeof body.paymentMethod !== 'string' || !paymentMethods.has(body.paymentMethod) ||
      typeof body.transactionId !== 'string' || !/^[A-Za-z0-9]{8,20}$/.test(body.transactionId.trim())
    ) {
      return NextResponse.json({ error: 'Check your name, payment method, 11-digit phone number, and transaction ID.' }, { status: 400 })
    }

    const draftResponse = await supabaseRequest(
      `/rest/v1/cards?public_id=eq.${body.cardId}&status=eq.draft&select=id,status,template_slug&limit=1`,
    )
    const [card] = await draftResponse.json() as DraftCard[]
    if (!card || !premiumPrices[card.template_slug]) {
      return NextResponse.json({ error: 'This card is unavailable for payment. Return to the editor and try again.' }, { status: 404 })
    }

    const duplicateResponse = await supabaseRequest(
      `/rest/v1/payments?card_id=eq.${card.id}&status=in.(pending,verified)&select=id&limit=1`,
    )
    if ((await duplicateResponse.json()).length) {
      return NextResponse.json({ error: 'A payment for this card is already awaiting review.' }, { status: 409 })
    }

    await supabaseRequest('/rest/v1/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        card_id: card.id,
        customer_name: body.customerName.trim(),
        bkash_number: body.payerPhone.replace(/[\s-]/g, ''),
        payment_method: body.paymentMethod,
        payer_phone: body.payerPhone.replace(/[\s-]/g, ''),
        transaction_id: body.transactionId.trim().toUpperCase(),
        amount: premiumPrices[card.template_slug],
        status: 'pending',
      }),
    })

    return NextResponse.json({ status: 'pending' }, { status: 201 })
  } catch (error) {
    console.error('Could not submit manual payment.', error)
    const details = error instanceof Error ? error.message : ''
    if (details.includes('not configured')) {
      return NextResponse.json({ error: 'Payment submission needs Supabase configuration and the latest database migration.' }, { status: 503 })
    }
    if (details.includes('duplicate key') || details.includes('payments_transaction_id_key')) {
      return NextResponse.json({ error: 'That transaction ID has already been submitted. Check the ID and try again.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'We could not submit your payment details. Please try again.' }, { status: 500 })
  }
}

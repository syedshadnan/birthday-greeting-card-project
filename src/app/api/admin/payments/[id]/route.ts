import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../lib/admin-auth'
import { supabaseRequest } from '../../../../../lib/supabase/server'

type PaymentRow = { id: string; card_id: string | null; status: string }
type CardRow = { id: string }

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to review payment requests.' }, { status: 401 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Payment review request was rejected.' }, { status: 403 })
  }

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Payment request could not be found.' }, { status: 404 })
  }

  try {
    const body = await request.json()
    if (body.status !== 'verified' && body.status !== 'rejected') {
      return NextResponse.json({ error: 'Choose whether to approve or reject this payment.' }, { status: 400 })
    }

    const updatedResponse = await supabaseRequest(
      `/rest/v1/payments?id=eq.${id}&status=eq.pending&select=id,card_id,status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          status: body.status,
          verified_at: body.status === 'verified' ? new Date().toISOString() : null,
        }),
      },
    )
    const [payment] = await updatedResponse.json() as PaymentRow[]
    if (!payment) {
      return NextResponse.json({ error: 'This payment has already been reviewed.' }, { status: 409 })
    }

    if (body.status === 'verified') {
      if (!payment.card_id) {
        await revertPayment(payment.id)
        return NextResponse.json({ error: 'This payment is not linked to a card and cannot be approved.' }, { status: 409 })
      }

      let cardResponse: Response
      try {
        cardResponse = await supabaseRequest(
          `/rest/v1/cards?id=eq.${payment.card_id}&status=eq.draft&select=id`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ status: 'published' }),
          },
        )
      } catch (error) {
        await revertPayment(payment.id)
        throw error
      }
      const [card] = await cardResponse.json() as CardRow[]
      if (!card) {
        await revertPayment(payment.id)
        return NextResponse.json({ error: 'The linked card could not be published. The payment remains pending review.' }, { status: 409 })
      }
    }

    return NextResponse.json({ status: body.status })
  } catch (error) {
    console.error('Could not review payment request.', error)
    return NextResponse.json({ error: 'Could not update this payment. Please try again.' }, { status: 500 })
  }
}

async function revertPayment(paymentId: string) {
  await supabaseRequest(`/rest/v1/payments?id=eq.${paymentId}&status=eq.verified`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'pending', verified_at: null }),
  })
}

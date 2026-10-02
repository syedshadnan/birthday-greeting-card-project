import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '../../../../../lib/admin-auth'
import { getCurrentUser } from '../../../../../lib/auth'
import { getSiteUrl } from '../../../../../lib/site-url'
import { supabaseRequest } from '../../../../../lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9]{12,32}$/.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Card sharing request was rejected.' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in is required before sharing this card.' }, { status: 401 })
  }

  const response = await supabaseRequest(
    `/rest/v1/cards?public_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&status=in.(draft,published)&select=id,public_id&limit=1`,
  )
  const [card] = await response.json() as { id: string; public_id: string }[]
  if (!card) {
    return NextResponse.json({ error: 'You are not authorized to share this card.' }, { status: 403 })
  }

  const paidOrderResponse = await supabaseRequest(
    `/rest/v1/orders?card_id=eq.${encodeURIComponent(card.id)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.paid&select=id&limit=1`,
  )
  const [paidOrder] = await paidOrderResponse.json() as { id: string }[]
  if (!paidOrder) {
    return NextResponse.json({ error: 'Verified payment is required before sharing this card.' }, { status: 402 })
  }

  await supabaseRequest(
    `/rest/v1/cards?public_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ share_enabled_at: new Date().toISOString() }),
    },
  )

  return NextResponse.json({
    url: `${getSiteUrl()}/card/${card.public_id}`,
  }, {
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

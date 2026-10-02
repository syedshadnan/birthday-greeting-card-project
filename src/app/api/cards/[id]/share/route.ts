import { NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../../lib/auth'
import { getSiteUrl } from '../../../../../lib/site-url'
import { supabaseRequest } from '../../../../../lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9]{12,32}$/.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in is required before sharing this card.' }, { status: 401 })
  }

  const response = await supabaseRequest(
    `/rest/v1/cards?public_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&status=in.(draft,published)&select=public_id&limit=1`,
  )
  const [card] = await response.json() as { public_id: string }[]
  if (!card) {
    return NextResponse.json({ error: 'You are not authorized to share this card.' }, { status: 403 })
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

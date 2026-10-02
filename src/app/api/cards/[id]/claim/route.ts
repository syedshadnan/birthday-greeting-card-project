import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { isSameOriginRequest } from '../../../../../lib/admin-auth'
import { getCurrentUser } from '../../../../../lib/auth'
import { supabaseRequest } from '../../../../../lib/supabase/server'

function isCardId(value: string) {
  return /^[a-z0-9]{12,32}$/.test(value)
}

function claimTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isCardId(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Card ownership request was rejected.' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in is required before sharing this card.' }, { status: 401 })
  }

  const claimCookie = request.headers.get('cookie')
    ?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`wishwell_card_claim_${id}=`))
    ?.slice(`wishwell_card_claim_${id}=`.length)
  if (!claimCookie) {
    return NextResponse.json({ error: 'This card is not available to claim from this session.' }, { status: 403 })
  }

  let claimHash: string
  try {
    claimHash = claimTokenHash(decodeURIComponent(claimCookie))
  } catch {
    return NextResponse.json({ error: 'This card claim session is invalid.' }, { status: 403 })
  }

  const response = await supabaseRequest(
    `/rest/v1/cards?public_id=eq.${encodeURIComponent(id)}&user_id=is.null&claim_token_hash=eq.${claimHash}&select=public_id`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: user.id,
        claim_token_hash: null,
      }),
    },
  )
  const claimed = await response.json() as { public_id: string }[]
  if (claimed.length !== 1) {
    return NextResponse.json({ error: 'This card is already claimed or its claim session has expired.' }, { status: 409 })
  }

  const result = NextResponse.json({ claimed: true })
  result.cookies.set(`wishwell_card_claim_${id}`, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return result
}

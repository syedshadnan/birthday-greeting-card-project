import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '../../../../../lib/admin-auth'
import { cardAccessCookie, cardAccessLifetimeSeconds, createCardAccessToken, verifyCardPassword } from '../../../../../lib/cards/password'
import { checkRateLimit } from '../../../../../lib/rate-limit'
import { supabaseRequest } from '../../../../../lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9]{12,32}$/.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Card unlock request was rejected.' }, { status: 403 })
  }

  try {
    if (!await checkRateLimit(request, `unlock-card-${id}`, 5, 900)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait 15 minutes before trying again.' }, { status: 429 })
    }
    const body = await request.json() as { password?: unknown }
    if (typeof body.password !== 'string' || body.password.length > 128) {
      return NextResponse.json({ error: 'Enter the password shared with you.' }, { status: 400 })
    }

    const response = await supabaseRequest(
      `/rest/v1/cards?public_id=eq.${id}&status=in.(draft,published)&select=password_salt,password_hash,expires_at&limit=1`,
    )
    const [card] = await response.json()
    if (!card || new Date(card.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This birthday card could not be found or has expired.' }, { status: 404 })
    }
    const valid = typeof card.password_salt === 'string'
      && typeof card.password_hash === 'string'
      && await verifyCardPassword(body.password, card.password_salt, card.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'That password didn’t unlock this card. Please try again.' }, { status: 401 })
    }

    const { token, maxAge } = createCardAccessToken(id)
    const result = NextResponse.json({ unlocked: true }, { headers: { 'Cache-Control': 'no-store, private' } })
    result.cookies.set(cardAccessCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/cards',
      maxAge: Math.min(maxAge, cardAccessLifetimeSeconds),
    })
    return result
  } catch (error) {
    console.error('Could not unlock birthday card.', error)
    return NextResponse.json({ error: 'We could not check this password right now. Please try again shortly.' }, { status: 503 })
  }
}

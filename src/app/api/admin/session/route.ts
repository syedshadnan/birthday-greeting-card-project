import { NextRequest, NextResponse } from 'next/server'
import { clearAdminSession, hasAdminSession, isSameOriginRequest, setAdminSession, verifyAdminCredentials } from '../../../../lib/admin-auth'
import { checkRateLimit } from '../../../../lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ authenticated: hasAdminSession(request) })
  } catch (error) {
    console.error('Admin sign-in is not configured.', error)
    return NextResponse.json({ error: 'Admin sign-in is not configured. Set the admin environment variables in Vercel.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Sign-in request was rejected.' }, { status: 403 })
  }

  try {
    if (!await checkRateLimit(request, 'admin-login', 8, 900)) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }, { status: 429 })
    }
    const body = await request.json()
    if (typeof body.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) {
      return NextResponse.json({ error: 'Enter your admin email and password.' }, { status: 400 })
    }

    if (!verifyAdminCredentials(body.email, body.password)) {
      return NextResponse.json({ error: 'The admin email or password is incorrect.' }, { status: 401 })
    }

    const response = NextResponse.json({ authenticated: true })
    setAdminSession(response)
    return response
  } catch (error) {
    console.error('Could not sign in to the admin dashboard.', error)
    const message = error instanceof SyntaxError
      ? 'Enter your admin email and password.'
      : 'Admin sign-in is not configured. Set the admin environment variables in Vercel.'
    return NextResponse.json({ error: message }, { status: error instanceof SyntaxError ? 400 : 503 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Sign-out request was rejected.' }, { status: 403 })
  }

  const response = NextResponse.json({ authenticated: false })
  clearAdminSession(response)
  return response
}

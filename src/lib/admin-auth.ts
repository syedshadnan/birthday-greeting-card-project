import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

const cookieName = 'wishwell_admin'
const sessionLifetimeSeconds = 8 * 60 * 60

function adminConfig() {
  const emails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
  const password = process.env.ADMIN_PASSWORD
  const secret = process.env.ADMIN_SESSION_SECRET

  if (!emails.length || !password || password.length < 16 || !secret || secret.length < 32) {
    throw new Error('Set ADMIN_EMAILS, an ADMIN_PASSWORD of at least 16 characters, and an ADMIN_SESSION_SECRET of at least 32 characters.')
  }

  return { emails, password, secret }
}

function signature(expiresAt: string, secret: string) {
  return createHmac('sha256', secret).update(`${cookieName}:${expiresAt}`).digest('hex')
}

export function verifyAdminCredentials(email: string, password: string) {
  const config = adminConfig()
  const expected = createHmac('sha256', config.secret).update(config.password).digest()
  const actual = createHmac('sha256', config.secret).update(password).digest()

  return config.emails.includes(email.trim().toLowerCase()) && timingSafeEqual(expected, actual)
}

export function setAdminSession(response: NextResponse) {
  const { secret } = adminConfig()
  const expiresAt = String(Math.floor(Date.now() / 1000) + sessionLifetimeSeconds)
  response.cookies.set(cookieName, `${expiresAt}.${signature(expiresAt, secret)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: sessionLifetimeSeconds,
  })
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: 0,
  })
}

export function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value
  if (!token) return false

  try {
    const { secret } = adminConfig()
    const [expiresAt, providedSignature, ...extra] = token.split('.')
    if (extra.length || !/^\d+$/.test(expiresAt) || !/^[a-f0-9]{64}$/.test(providedSignature)) return false
    if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false

    const expected = Buffer.from(signature(expiresAt, secret), 'hex')
    const provided = Buffer.from(providedSignature, 'hex')
    return expected.length === provided.length && timingSafeEqual(expected, provided)
  } catch {
    return false
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

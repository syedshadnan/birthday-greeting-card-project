import bcrypt from 'bcryptjs'
import { createHmac, timingSafeEqual } from 'node:crypto'

const accessLifetimeSeconds = 15 * 60
const accessCookieName = 'wishwell_card_access'

export type PasswordHash = { salt: string; hash: string }

export async function hashCardPassword(password: string): Promise<PasswordHash> {
  const salt = await bcrypt.genSalt(12)
  return { salt, hash: await bcrypt.hash(password, salt) }
}

export async function verifyCardPassword(password: string, saltValue: string, hashValue: string) {
  if (!/^\$2[aby]\$12\$/.test(hashValue) || saltValue !== hashValue.slice(0, 29)) return false
  return bcrypt.compare(password, hashValue)
}

function signature(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || secret.length < 32) throw new Error('A secure server secret is required for protected birthday cards.')
  return createHmac('sha256', secret).update(`wishwell-card:${payload}`).digest('base64url')
}

export function createCardAccessToken(id: string) {
  const expires = Math.floor(Date.now() / 1000) + accessLifetimeSeconds
  const payload = `${id}.${expires}`
  return { token: `${payload}.${signature(payload)}`, maxAge: accessLifetimeSeconds }
}

export function hasCardAccess(request: Request, id: string) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const value = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${accessCookieName}=`))?.slice(accessCookieName.length + 1)
  if (!value) return false
  let token: string
  try { token = decodeURIComponent(value) } catch { return false }
  const [tokenId, rawExpires, provided, ...extra] = token.split('.')
  if (extra.length || tokenId !== id || !/^\d+$/.test(rawExpires) || !/^[A-Za-z0-9_-]{43}$/.test(provided)) return false
  if (Number(rawExpires) <= Math.floor(Date.now() / 1000)) return false
  const payload = `${tokenId}.${rawExpires}`
  const expected = Buffer.from(signature(payload))
  const actual = Buffer.from(provided)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const cardAccessCookie = accessCookieName
export const cardAccessLifetimeSeconds = accessLifetimeSeconds

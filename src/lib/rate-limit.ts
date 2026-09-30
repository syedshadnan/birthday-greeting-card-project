import { createHash } from 'node:crypto'
import { supabaseRequest } from './supabase/server'

export async function checkRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number) {
  // `x-forwarded-for` and `x-real-ip` can be supplied by the caller. Vercel
  // overwrites its own header at the edge, so only trust that platform header.
  // On another host, use one shared bucket rather than letting callers choose
  // their own rate-limit identity.
  const address = process.env.VERCEL === '1'
    ? request.headers.get('x-vercel-forwarded-for')?.trim() || 'unknown'
    : 'unknown'
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Supabase is not configured for rate limiting.')

  const key = createHash('sha256').update(`${secret}:${bucket}:${address}`).digest('hex')
  const response = await supabaseRequest('/rest/v1/rpc/consume_public_rate_limit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: key, p_max_requests: limit, p_window_seconds: windowSeconds }),
  })

  return response.json() as Promise<boolean>
}

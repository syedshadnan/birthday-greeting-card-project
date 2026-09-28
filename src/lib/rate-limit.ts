import { createHash } from 'node:crypto'
import { supabaseRequest } from './supabase/server'

export async function checkRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
  const address = request.headers.get('x-real-ip') || forwarded || 'unknown'
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

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseRequest } from '../../../../lib/supabase/server'

const maxPayloadBytes = 256 * 1024

function configuredSecret() {
  const secret = process.env.SMS_WEBHOOK_SECRET
  return secret && secret.length >= 32 ? secret : null
}

function hasValidSecret(request: Request, secret: string) {
  const provided = request.headers.get('x-sms-webhook-secret')
  if (!provided) return false
  const expected = Buffer.from(secret, 'utf8')
  const actual = Buffer.from(provided, 'utf8')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function isTextField(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

export async function POST(request: Request) {
  const secret = configuredSecret()
  if (!secret || !hasValidSecret(request, secret)) {
    return NextResponse.json({ error: 'Webhook authentication failed.' }, { status: 401 })
  }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Webhook payload must be JSON.' }, { status: 400 })
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxPayloadBytes)) {
    return NextResponse.json({ error: 'Webhook payload is too large.' }, { status: 413 })
  }

  let payload: unknown
  try {
    const body = await request.arrayBuffer()
    if (body.byteLength > maxPayloadBytes) {
      return NextResponse.json({ error: 'Webhook payload is too large.' }, { status: 413 })
    }
    payload = JSON.parse(new TextDecoder().decode(body))
  } catch {
    return NextResponse.json({ error: 'Webhook payload is malformed.' }, { status: 400 })
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Webhook payload must be a JSON object.' }, { status: 400 })
  }

  const input = payload as Record<string, unknown>
  if (!isTextField(input.event_id, 200) || !isTextField(input.source, 100) || !isTextField(input.event_type, 100)) {
    return NextResponse.json({ error: 'Webhook event_id, source, and event_type are required.' }, { status: 400 })
  }

  try {
    await supabaseRequest('/rest/v1/webhook_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        external_event_id: input.event_id,
        source: input.source,
        event_type: input.event_type,
        raw_payload: payload,
        received_at: new Date().toISOString(),
        status: 'received',
      }),
    })
    return NextResponse.json({ accepted: true, duplicate: false }, { status: 202 })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Supabase request failed (409)')) {
      return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 })
    }
    console.error('Could not store inbound SMS webhook event.', error)
    return NextResponse.json({ error: 'Webhook event could not be stored.' }, { status: 503 })
  }
}

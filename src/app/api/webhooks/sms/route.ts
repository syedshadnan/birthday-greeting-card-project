import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseRequest } from '../../../../lib/supabase/server'
import { parseSupportedSms } from '../../../../lib/payment-verification'
import { normalizeBangladeshPhone } from '../../../../lib/payment-accounts'

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

function isConflict(error: unknown) {
  return error instanceof Error && error.message.startsWith('Supabase request failed (409)')
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

  const message = typeof input.raw_message === 'string' ? input.raw_message : typeof input.message === 'string' ? input.message : null
  const parsed = parseSupportedSms(message)
  const trustedSource = typeof input.trusted_source === 'string' && input.trusted_source.trim() ? input.trusted_source.trim() : null
  const rawReceivingAccount = typeof input.receiving_account === 'string' && input.receiving_account.trim() ? input.receiving_account.trim() : null
  const receivingAccount = rawReceivingAccount ? normalizeBangladeshPhone(rawReceivingAccount) ?? rawReceivingAccount : null
  const initialStatus = parsed ? 'needs_review' : 'invalid'
  const initialReasonCode = parsed ? 'PENDING_AUTOMATIC_VERIFICATION' : 'INVALID_SMS_FORMAT'
  const initialReason = parsed
    ? 'Evidence stored; automatic verification has not completed.'
    : 'SMS format could not be safely parsed.'

  try {
    let eventId: string
    try {
      const eventResponse = await supabaseRequest('/rest/v1/webhook_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          external_event_id: input.event_id,
          source: input.source,
          event_type: input.event_type,
          raw_payload: payload,
          raw_message: message,
          received_at: new Date().toISOString(),
          status: 'received',
          verification_status: initialStatus,
          verification_reason_code: initialReasonCode,
          verification_reason: initialReason,
          parsed_provider: parsed?.provider ?? null,
          parsed_amount_bdt: parsed?.amountBdt ?? null,
          parsed_sender_phone: parsed?.senderPhone ?? null,
          parsed_transaction_id: parsed?.transactionId ?? null,
          parsed_provider_timestamp: parsed?.providerTimestamp ?? null,
          trusted_source: trustedSource,
          trusted_receiving_account: receivingAccount,
        }),
      })
      eventId = (await eventResponse.json() as { id: string }[])[0].id
    } catch (error) {
      if (!isConflict(error)) throw error
      // Same event_id delivered again. Only resume it if the first delivery never finished processing.
      const existingResponse = await supabaseRequest(`/rest/v1/webhook_events?external_event_id=eq.${encodeURIComponent(input.event_id)}&select=id,processed_at&limit=1`)
      const [existing] = await existingResponse.json() as { id: string; processed_at: string | null }[]
      if (!existing || existing.processed_at) return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 })
      eventId = existing.id
    }

    const existingVerificationResponse = await supabaseRequest(`/rest/v1/payment_verifications?webhook_event_id=eq.${eventId}&select=id&limit=1`)
    let [verification] = await existingVerificationResponse.json() as { id: string }[]
    if (!verification) {
      const verificationResponse = await supabaseRequest('/rest/v1/payment_verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          webhook_event_id: eventId, provider: parsed?.provider ?? null, amount_bdt: parsed?.amountBdt ?? null,
          sender_phone: parsed?.senderPhone ?? null, transaction_id: parsed?.transactionId ?? null,
          provider_timestamp: parsed?.providerTimestamp ?? null, trusted_source: trustedSource,
          trusted_receiving_account: receivingAccount, verification_status: initialStatus,
          reason_code: initialReasonCode, reason: initialReason, raw_evidence: payload,
        }),
      })
      ;[verification] = await verificationResponse.json() as { id: string }[]
    }

    // Matching, credited-transaction protection, and the paid transition run in one database transaction.
    const resultResponse = await supabaseRequest('/rest/v1/rpc/process_sms_payment_verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_verification_id: verification.id }),
    })
    const [result] = await resultResponse.json() as { out_status: string }[]
    return NextResponse.json({ accepted: true, duplicate: false, verification_status: result?.out_status ?? initialStatus }, { status: 202 })
  } catch (error) {
    // A concurrent delivery of the same event is already being processed.
    if (isConflict(error)) return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 })
    console.error('Could not store or verify inbound SMS webhook event.', error)
    return NextResponse.json({ error: 'Webhook event could not be stored.' }, { status: 503 })
  }
}

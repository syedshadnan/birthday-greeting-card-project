import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseRequest } from '../../../../lib/supabase/server'
import { parseSupportedSms } from '../../../../lib/payment-verification'

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

  const message = typeof input.raw_message === 'string' ? input.raw_message : typeof input.message === 'string' ? input.message : null
  const parsed = parseSupportedSms(message)
  const trustedSource = typeof input.trusted_source === 'string' ? input.trusted_source : null
  const receivingAccount = typeof input.receiving_account === 'string' ? input.receiving_account : null
  let verificationStatus: 'verified' | 'needs_review' | 'unmatched' | 'invalid' | 'duplicate' = parsed ? 'needs_review' : 'invalid'
  let reasonCode = parsed ? 'RECEIVING_ACCOUNT_UNKNOWN' : 'INVALID_SMS_FORMAT'
  let reason = parsed
    ? 'Auto verification stopped because the receiving account could not be established from trusted metadata.'
    : 'SMS format could not be safely parsed.'

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
        verification_status: verificationStatus,
        verification_reason_code: reasonCode,
        verification_reason: reason,
        parsed_provider: parsed?.provider ?? null,
        parsed_amount_bdt: parsed?.amountBdt ?? null,
        parsed_sender_phone: parsed?.senderPhone ?? null,
        parsed_transaction_id: parsed?.transactionId ?? null,
        parsed_provider_timestamp: parsed?.providerTimestamp ?? null,
        trusted_source: trustedSource,
        trusted_receiving_account: receivingAccount,
      }),
    })
    const [event] = await eventResponse.json() as { id: string }[]
    if (parsed && parsed.transactionId) {
      const duplicateResponse = await supabaseRequest(`/rest/v1/payment_verifications?provider=eq.${parsed.provider}&transaction_id=eq.${parsed.transactionId}&select=id&limit=1`)
      if ((await duplicateResponse.json()).length) {
        verificationStatus = 'duplicate'
        reasonCode = 'TRANSACTION_ID_DUPLICATE'
        reason = 'This transaction ID has already been processed.'
      }
    }
    let verificationId: string | null = null
    const verificationResponse = await supabaseRequest('/rest/v1/payment_verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        webhook_event_id: event.id, provider: parsed?.provider ?? null, amount_bdt: parsed?.amountBdt ?? null,
        sender_phone: parsed?.senderPhone ?? null, transaction_id: parsed?.transactionId ?? null,
        provider_timestamp: parsed?.providerTimestamp ?? null, trusted_source: trustedSource,
        trusted_receiving_account: receivingAccount, verification_status: verificationStatus,
        reason_code: reasonCode, reason, raw_evidence: payload,
      }),
    })
    const [verification] = await verificationResponse.json() as { id: string }[]
    verificationId = verification?.id ?? null

    if (parsed && verificationStatus === 'needs_review' && trustedSource && receivingAccount) {
      const accountResponse = await supabaseRequest(`/rest/v1/payment_accounts?method=eq.${parsed.provider}&webhook_source=eq.${encodeURIComponent(trustedSource)}&provider_account_number=eq.${encodeURIComponent(receivingAccount)}&select=id,account_number`)
      const accounts = await accountResponse.json() as { id: string; account_number: string }[]
      if (accounts.length === 1) {
        const ordersResponse = await supabaseRequest(`/rest/v1/orders?payment_method=eq.${parsed.provider}&status=eq.pending&payment_account_id=eq.${accounts[0].id}&select=id,customer_phone,amount_bdt,payment_account_id&limit=3`)
        const orders = await ordersResponse.json() as { id: string; customer_phone: string; amount_bdt: number; payment_account_id: string }[]
        if (orders.length === 1 && orders[0].amount_bdt !== parsed.amountBdt) {
          reasonCode = 'AMOUNT_MISMATCH'
          reason = `Auto verification failed: SMS amount is ${parsed.amountBdt} BDT, but the required payment amount is ${orders[0].amount_bdt} BDT.`
        } else if (orders.length === 1 && orders[0].customer_phone !== parsed.senderPhone) {
          reasonCode = 'CUSTOMER_PHONE_MISMATCH'
          reason = `Auto verification failed: SMS sender phone ${parsed.senderPhone} does not match the customer's payment phone.`
        } else if (orders.length === 1 && !parsed.transactionId) {
          reasonCode = 'TRANSACTION_ID_MISSING'
          reason = 'Auto verification failed: the supported SMS did not contain a transaction ID.'
        } else if (orders.length === 1 && parsed.transactionId) {
          verificationStatus = 'verified'
          reasonCode = 'AUTO_VERIFIED'
          reason = 'Payment matched one eligible pending order with trusted provider and receiving-account metadata.'
          const paidResponse = await supabaseRequest(`/rest/v1/orders?id=eq.${orders[0].id}&status=eq.pending`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString(), payment_verification_source: 'AUTOMATIC', updated_at: new Date().toISOString() }),
          })
          const paidOrders = await paidResponse.json() as { id: string }[]
          if (paidOrders.length !== 1) {
            verificationStatus = 'needs_review'
            reasonCode = 'ORDER_ALREADY_PAID'
            reason = 'The matching order was no longer pending when automatic approval was attempted.'
          } else {
            await supabaseRequest(`/rest/v1/payment_verifications?id=eq.${verificationId}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ verification_status: verificationStatus, reason_code: reasonCode, reason, order_id: orders[0].id }),
            })
            await supabaseRequest(`/rest/v1/webhook_events?id=eq.${event.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ verification_status: verificationStatus, verification_reason_code: reasonCode, verification_reason: reason, matched_order_id: orders[0].id, processed_at: new Date().toISOString(), status: 'processed' }),
            })
          }
        } else {
          reasonCode = orders.length > 1 ? 'MULTIPLE_MATCHING_ORDERS' : 'NO_MATCHING_ORDER'
          reason = orders.length > 1 ? 'Multiple possible orders matched the SMS, so automatic payment was intentionally not approved.' : 'No matching pending order was found.'
        }
      } else {
        reasonCode = 'RECEIVING_ACCOUNT_UNKNOWN'
        reason = 'The trusted receiving account metadata did not match exactly one configured payment account.'
      }
    }
    if (verificationId && verificationStatus !== 'verified') {
      await supabaseRequest(`/rest/v1/payment_verifications?id=eq.${verificationId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status: verificationStatus, reason_code: reasonCode, reason }),
      })
      await supabaseRequest(`/rest/v1/webhook_events?id=eq.${event.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status: verificationStatus, verification_reason_code: reasonCode, verification_reason: reason, processed_at: new Date().toISOString(), status: 'processed' }),
      })
    }
    return NextResponse.json({ accepted: true, duplicate: false, verification_status: verificationStatus }, { status: 202 })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Supabase request failed (409)')) {
      return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 })
    }
    console.error('Could not store inbound SMS webhook event.', error)
    return NextResponse.json({ error: 'Webhook event could not be stored.' }, { status: 503 })
  }
}

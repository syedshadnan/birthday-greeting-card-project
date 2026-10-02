import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../lib/admin-auth'
import { getCurrentUserRole } from '../../../../../lib/auth'
import { supabaseRequest } from '../../../../../lib/supabase/server'

async function requireAdmin(request: Request) {
  return hasAdminSession(request as NextRequest) || (await getCurrentUserRole()) === 'admin'
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment account request was rejected.' }, { status: 403 })
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Object.keys(body).some(key => !['isActive', 'webhookSource', 'providerAccountNumber'].includes(key))) {
    return NextResponse.json({ error: 'Payment account update fields are invalid.' }, { status: 400 })
  }
  if ('isActive' in body && typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'The active state is invalid.' }, { status: 400 })
  }
  const metadata: { webhook_source?: string | null; provider_account_number?: string | null } = {}
  for (const [key, field] of [['webhookSource', 'webhook_source'], ['providerAccountNumber', 'provider_account_number']] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== 'string') return NextResponse.json({ error: 'Trust metadata must be text or empty.' }, { status: 400 })
      const value = typeof body[key] === 'string' ? body[key].trim() : ''
      if (value.length > 100) return NextResponse.json({ error: 'Trust metadata must be 100 characters or fewer.' }, { status: 400 })
      metadata[field] = value || null
    }
  }
  if (!('isActive' in body) && !Object.keys(metadata).length) return NextResponse.json({ error: 'No account changes were provided.' }, { status: 400 })

  try {
    if (body.isActive === true) {
      const response = await supabaseRequest('/rest/v1/rpc/activate_payment_account', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ p_account_id: id }),
      })
      return NextResponse.json({ account: await response.json() })
    }
    const response = await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ ...metadata, ...('isActive' in body ? { is_active: body.isActive } : {}), updated_at: new Date().toISOString() }),
    })
    const accounts = await response.json()
    if (!accounts.length) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })
    return NextResponse.json({ account: accounts[0] })
  } catch (error) {
    console.error('Could not update payment account.', error)
    return NextResponse.json({ error: 'Payment account could not be updated.' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment account request was rejected.' }, { status: 403 })
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })

  try {
    const accountResponse = await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${id}&select=id,is_active,method,webhook_source,provider_account_number`)
    const accountRows = await accountResponse.json() as { id: string; is_active: boolean; method: string; webhook_source: string | null; provider_account_number: string | null }[]
    if (!accountRows.length) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })
    if (accountRows[0].is_active) return NextResponse.json({ error: 'Active payment accounts must be deactivated before archival or deletion.', requiresArchive: true }, { status: 409 })
    const response = await supabaseRequest(`/rest/v1/orders?payment_account_id=eq.${id}&select=id&limit=1`)
    const orders = await response.json() as { id: string }[]
    const account = accountRows[0]
    const source = account.webhook_source
    const providerAccount = account.provider_account_number
    const hasMetadata = Boolean(source && providerAccount)
    const [evidenceResponse, webhookResponse] = hasMetadata ? await Promise.all([
      supabaseRequest(`/rest/v1/payment_verifications?provider=eq.${encodeURIComponent(account.method)}&trusted_source=eq.${encodeURIComponent(source as string)}&trusted_receiving_account=eq.${encodeURIComponent(providerAccount as string)}&select=id&limit=1`),
      supabaseRequest(`/rest/v1/webhook_events?parsed_provider=eq.${encodeURIComponent(account.method)}&trusted_source=eq.${encodeURIComponent(source as string)}&trusted_receiving_account=eq.${encodeURIComponent(providerAccount as string)}&select=id&limit=1`),
    ]) : [null, null]
    const evidence = evidenceResponse ? await evidenceResponse.json() as { id: string }[] : []
    const webhookEvidence = webhookResponse ? await webhookResponse.json() as { id: string }[] : []
    if (orders.length || evidence.length || webhookEvidence.length) return NextResponse.json({ error: 'This account is linked to historical payment records and cannot be permanently deleted.', requiresArchive: true }, { status: 409 })
    const deleteResponse = await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${id}`, {
      method: 'DELETE', headers: { Prefer: 'return=representation' },
    })
    const deleted = await deleteResponse.json() as { id: string }[]
    if (!deleted.length) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })
    return NextResponse.json({ deleted: deleted[0].id })
  } catch (error) {
    console.error('Could not delete payment account.', error)
    return NextResponse.json({ error: 'Payment account could not be deleted.' }, { status: 500 })
  }
}

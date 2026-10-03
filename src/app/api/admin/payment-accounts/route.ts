import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { hasAdminSession } from '../../../../lib/admin-auth'
import { getCurrentUserRole } from '../../../../lib/auth'
import { normalizeBangladeshPhone, isPaymentMethod } from '../../../../lib/payment-accounts'
import { supabaseRequest } from '../../../../lib/supabase/server'
import { isSameOriginRequest } from '../../../../lib/admin-auth'

async function requireAdmin(request?: NextRequest) {
  return Boolean(request && hasAdminSession(request)) || (await getCurrentUserRole()) === 'admin'
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
  const response = await supabaseRequest('/rest/v1/payment_accounts?select=id,method,account_number,label,is_active,webhook_source,provider_account_number,created_at,updated_at&order=method.asc,created_at.desc')
  return NextResponse.json({ accounts: await response.json() })
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment account request was rejected.' }, { status: 403 })
  if (!await requireAdmin(request as NextRequest)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Object.keys(body).some(key => !['method', 'accountNumber', 'label', 'isActive', 'webhookSource', 'providerAccountNumber'].includes(key))) {
    return NextResponse.json({ error: 'Payment account details are invalid.' }, { status: 400 })
  }
  const accountNumber = normalizeBangladeshPhone(body.accountNumber)
  if (!isPaymentMethod(body.method) || !accountNumber) {
    return NextResponse.json({ error: 'Choose a supported method and valid Bangladesh number.' }, { status: 400 })
  }
  const webhookSource = typeof body.webhookSource === 'string' ? body.webhookSource.trim() : ''
  const providerAccountNumber = typeof body.providerAccountNumber === 'string' ? body.providerAccountNumber.trim() : ''
  if (webhookSource.length > 100 || providerAccountNumber.length > 100) {
    return NextResponse.json({ error: 'Trust metadata must be 100 characters or fewer.' }, { status: 400 })
  }

  const user = (await import('../../../../lib/auth')).getCurrentUser
  const currentUser = await user()
  try {
    const response = await supabaseRequest('/rest/v1/payment_accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        method: body.method,
        account_number: accountNumber,
        label: typeof body.label === 'string' ? body.label.trim().slice(0, 80) || null : null,
        is_active: false,
        created_by: currentUser?.id ?? null,
        webhook_source: webhookSource || null,
        provider_account_number: providerAccountNumber || null,
      }),
    })
    const accounts = await response.json() as { id: string }[]
    if (body.isActive === true && accounts[0]) {
      // Atomically deactivates the previous account for this method only.
      const activated = await supabaseRequest('/rest/v1/rpc/activate_payment_account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_account_id: accounts[0].id }),
      })
      return NextResponse.json({ accounts: [await activated.json()] }, { status: 201 })
    }
    return NextResponse.json({ accounts }, { status: 201 })
  } catch (error) {
    console.error('Could not create payment account.', error)
    const duplicate = error instanceof Error && error.message.startsWith('Supabase request failed (409)')
    return NextResponse.json({ error: duplicate ? 'This trust mapping is already used by another account for this method.' : 'Payment account could not be created.' }, { status: duplicate ? 409 : 500 })
  }
}

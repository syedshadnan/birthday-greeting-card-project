import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../../lib/admin-auth'
import { getCurrentUser } from '../../../../../../lib/auth'
import { adminApprovePayment, isUuid } from '../../../../../../lib/payment-approval'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment approval request was rejected.' }, { status: 403 })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid order is required.' }, { status: 400 })
  const body = await request.json().catch(() => null) as { reason?: unknown; verificationId?: unknown } | null
  if (!body || (body.verificationId != null && !isUuid(body.verificationId))) {
    return NextResponse.json({ error: 'The selected payment evidence is invalid.' }, { status: 400 })
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.length > 2000) {
    return NextResponse.json({ error: 'An approval reason of at least 10 characters is required.' }, { status: 400 })
  }

  const admin = await getCurrentUser()
  const verificationId = isUuid(body.verificationId) ? body.verificationId : null
  const result = await adminApprovePayment(id, verificationId, admin?.id ?? null, body.reason.trim())
  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ approvedOrderId: result.approvedOrderId })
}

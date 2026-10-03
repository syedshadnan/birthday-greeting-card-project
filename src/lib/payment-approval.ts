import { supabaseRequest } from './supabase/server'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

// Admin marks one pending order paid, optionally attaching stored SMS evidence. The database
// keeps one paid order per card, never credits a transaction ID twice, and writes an audit row.
export async function adminApprovePayment(orderId: string, verificationId: string | null, adminUserId: string | null, reason: string) {
  try {
    const response = await supabaseRequest('/rest/v1/rpc/admin_approve_payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_order_id: orderId, p_verification_id: verificationId, p_admin_user_id: adminUserId, p_reason: reason }),
    })
    return { approvedOrderId: await response.json() as string, error: null }
  } catch (error) {
    console.error('Could not approve payment.', error)
    const rejection = error instanceof Error ? /APPROVAL_REJECTED: ([^"\\]+)/.exec(error.message)?.[1] : undefined
    return { approvedOrderId: null, error: rejection ? `Approval rejected: ${rejection}.` : 'The pending order could not be approved.' }
  }
}

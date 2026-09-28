import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession } from '../../../../lib/admin-auth'

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to view payment requests.' }, { status: 401 })
  }

  return NextResponse.json({ payments: [], paymentsDisabled: true })
}

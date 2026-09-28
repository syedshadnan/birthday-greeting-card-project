import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../lib/admin-auth'

export async function PATCH(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to review payment requests.' }, { status: 401 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Payment review request was rejected.' }, { status: 403 })
  }

  return NextResponse.json({ error: 'Payment review is disabled because all birthday cards are free.' }, { status: 410 })
}

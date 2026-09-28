import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '../../../lib/admin-auth'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Payment request was rejected.' }, { status: 403 })
  }

  return NextResponse.json({ error: 'All birthday cards are currently free; payment is disabled.' }, { status: 410 })
}

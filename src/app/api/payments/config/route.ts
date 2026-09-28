import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'All birthday cards are currently free; payment is disabled.' }, { status: 410 })
}

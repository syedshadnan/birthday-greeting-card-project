import { NextResponse } from 'next/server'

function validBangladeshNumber(value: string | undefined) {
  const normalized = value?.replace(/[\s-]/g, '') ?? ''
  return /^01\d{9}$/.test(normalized) ? normalized : undefined
}

export async function GET() {
  const bkash = validBangladeshNumber(process.env.BKASH_PERSONAL_NUMBER)
  const nagad = validBangladeshNumber(process.env.NAGAD_PERSONAL_NUMBER)
  if (!bkash || !nagad) {
    return NextResponse.json({ error: 'Payment numbers are not configured. Please contact the site administrator.' }, { status: 503 })
  }

  return NextResponse.json({
    accounts: [
      { method: 'bkash', label: 'bKash', number: bkash },
      { method: 'nagad', label: 'Nagad', number: nagad },
    ],
  })
}

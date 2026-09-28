import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession } from '../../../../lib/admin-auth'
import { supabaseRequest } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to view payment requests.' }, { status: 401 })
  }

  try {
    const response = await supabaseRequest(
      '/rest/v1/payments?select=id,card_id,customer_name,bkash_number,payment_method,payer_phone,transaction_id,amount,status,created_at,verified_at,cards(public_id,template_slug,recipient_name)&order=created_at.desc&limit=100',
    )
    return NextResponse.json({ payments: await response.json() })
  } catch (error) {
    console.error('Could not load payment requests.', error)
    return NextResponse.json({ error: 'Could not load payment requests. Check the database migration and Supabase configuration.' }, { status: 503 })
  }
}

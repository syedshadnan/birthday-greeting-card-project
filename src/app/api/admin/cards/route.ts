import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession } from '../../../../lib/admin-auth'
import { supabaseRequest } from '../../../../lib/supabase/server'

const pageSize = 50

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to view generated cards.' }, { status: 401 })
  }

  const rawOffset = request.nextUrl.searchParams.get('offset') ?? '0'
  if (!/^\d+$/.test(rawOffset) || Number(rawOffset) > 10_000_000) {
    return NextResponse.json({ error: 'The requested card page is invalid.' }, { status: 400 })
  }
  const offset = Number(rawOffset)

  try {
    const response = await supabaseRequest(
      `/rest/v1/cards?select=id,public_id,recipient_name,sender_name,message,theme,status,created_at,expires_at,music_url,admin_locked_at,deleted_at,card_photos(image_url,sort_order)&order=created_at.desc,id.asc&limit=${pageSize}&offset=${offset}`,
      { headers: { Prefer: 'count=exact' } },
    )
    const cards = await response.json()
    const total = Number(response.headers.get('content-range')?.split('/')[1])

    return NextResponse.json({
      cards,
      total: Number.isFinite(total) ? total : offset + cards.length,
      offset,
      pageSize,
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Could not load generated cards for the admin dashboard.', error)
    return NextResponse.json({ error: 'Generated cards could not be loaded. Please try again.' }, { status: 500 })
  }
}

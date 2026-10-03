import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseRequest } from '../../../../lib/supabase/server'

type ExpiredCard = { id: string; public_id: string; music_url: string | null }
type PhotoRow = { image_url: string }
const batchSize = 100
const maxCardsPerRun = 500

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || !supplied) return false
  const expectedBytes = Buffer.from(secret)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    let removed = 0
    let retained = 0

    while (removed < maxCardsPerRun) {
      const expiredResponse = await supabaseRequest(
        `/rest/v1/cards?paid=eq.false&status=in.(draft,published)&expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=id,public_id,music_url&order=expires_at.asc,id.asc&offset=${retained}&limit=${batchSize}`,
      )
      const cards = await expiredResponse.json() as ExpiredCard[]
      if (!cards.length) break

      // Cards with orders are payment history and are never cleaned up.
      const ordersResponse = await supabaseRequest(`/rest/v1/orders?card_id=in.(${cards.map(card => card.id).join(',')})&select=card_id`)
      const cardsWithOrders = new Set((await ordersResponse.json() as { card_id: string }[]).map(order => order.card_id))

      for (const card of cards) {
      if (cardsWithOrders.has(card.id)) {
        retained++
        continue
      }
      const photosResponse = await supabaseRequest(
        `/rest/v1/card_photos?card_id=eq.${card.id}&select=image_url`,
      )
      const photos = await photosResponse.json() as PhotoRow[]
      const prefix = `/storage/v1/object/public/birthday-cards/${card.public_id}/`

      const assetUrls = [...photos.map(photo => photo.image_url), ...(card.music_url ? [card.music_url] : [])]
      for (const assetUrl of assetUrls) {
        const assetUrlParsed = new URL(assetUrl)
        if (!assetUrlParsed.pathname.startsWith(prefix)) {
          throw new Error(`Unexpected storage path for expired card ${card.public_id}.`)
        }
        const storagePath = decodeURIComponent(assetUrlParsed.pathname.slice(prefix.length))
        if (!storagePath || storagePath.includes('/')) {
          throw new Error(`Invalid storage object path for expired card ${card.public_id}.`)
        }
        await supabaseRequest(
          `/storage/v1/object/birthday-cards/${card.public_id}/${encodeURIComponent(storagePath)}`,
          { method: 'DELETE' },
        )
      }

      await supabaseRequest(`/rest/v1/payments?card_id=eq.${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ card_id: null, status: 'rejected' }),
      })
      await supabaseRequest(`/rest/v1/cards?id=eq.${card.id}&paid=eq.false`, { method: 'DELETE' })
        removed++
        if (removed >= maxCardsPerRun) break
      }
    }

    return NextResponse.json({ removed, capped: removed >= maxCardsPerRun })
  } catch (error) {
    console.error('Could not clean up expired free birthday cards.', error)
    return NextResponse.json({ error: 'Expired-card cleanup failed. Review server logs and try again.' }, { status: 500 })
  }
}

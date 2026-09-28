import { NextResponse } from 'next/server'
import { supabaseRequest } from '../../../../lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }

  try {
    const response = await supabaseRequest(
      `/rest/v1/cards?public_id=eq.${id}&status=eq.published&select=public_id,template_slug,recipient_name,sender_name,message,music_url,expires_at,card_photos(image_url,sort_order)&limit=1`,
    )
    const [card] = await response.json()

    if (!card) return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
    if (new Date(card.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This birthday card has expired.' }, { status: 410 })
    }

    return NextResponse.json({
      id: card.public_id,
      template: card.template_slug,
      recipient: card.recipient_name,
      sender: card.sender_name,
      message: card.message,
      music: card.music_url ?? undefined,
      photos: (card.card_photos ?? [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((photo: { image_url: string }) => photo.image_url),
    })
  } catch (error) {
    console.error('Could not load birthday card.', error)
    const message = error instanceof Error && error.message.includes('not configured')
      ? 'Card sharing needs Supabase configuration. Add the required Supabase environment variables and run the database migrations.'
      : 'We could not load this card. Please try again later.'
    return NextResponse.json({ error: message }, { status: message.startsWith('Card sharing') ? 503 : 500 })
  }
}

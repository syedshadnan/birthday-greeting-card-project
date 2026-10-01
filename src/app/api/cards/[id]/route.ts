import { NextResponse } from 'next/server'
import { cardThemes } from '../../../../lib/cards/themes'
import { defaultBirthdayMusic } from '../../../../lib/cards/music'
import { supabaseRequest } from '../../../../lib/supabase/server'
import { hasCardAccess } from '../../../../lib/cards/password'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9]{12,32}$/.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }

  try {
    const response = await supabaseRequest(
      `/rest/v1/cards?public_id=eq.${id}&status=in.(draft,published)&select=public_id,template_slug,theme,language,card_config,recipient_name,sender_name,message,music_url,expires_at,password_salt,password_hash,password_hint,card_photos(image_url,sort_order)&limit=1`,
    )
    const [card] = await response.json()

    if (!card) return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
    if (new Date(card.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This birthday card has expired.' }, { status: 410 })
    }
    if (card.password_hash && !hasCardAccess(_request, id)) {
      return NextResponse.json({
        locked: true,
        passwordHint: card.password_hint ?? '',
        theme: card.theme,
        language: card.language === 'bn' ? 'bn' : 'en',
      }, { headers: { 'Cache-Control': 'no-store, private' } })
    }

    const config = card.card_config && typeof card.card_config === 'object' ? card.card_config : {}
    const theme = cardThemes[card.theme as keyof typeof cardThemes] ? card.theme : 'pastel-cute'
    const hasCustomMusic = typeof card.music_url === 'string'
    const musicChoice = config.musicChoice === 'soft' ? 'soft' : 'signature'

    return NextResponse.json({
      id: card.public_id,
      template: theme,
      theme,
      language: card.language === 'bn' ? 'bn' : 'en',
      config,
      fullAccess: true,
      recipient: card.recipient_name,
      sender: card.sender_name,
      message: card.message,
      music: hasCustomMusic ? card.music_url : musicChoice === 'soft' ? null : defaultBirthdayMusic.url,
      musicCredit: !hasCustomMusic && musicChoice === 'signature',
      photos: (card.card_photos ?? [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((photo: { image_url: string }) => photo.image_url),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Could not load birthday card.', error)
    const message = error instanceof Error && error.message.includes('not configured')
      ? 'Card sharing needs Supabase configuration. Add the required Supabase environment variables and run the database migrations.'
      : 'We could not load this card. Please try again later.'
    return NextResponse.json({ error: message }, { status: message.startsWith('Card sharing') ? 503 : 500 })
  }
}

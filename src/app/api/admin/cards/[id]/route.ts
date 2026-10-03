import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../lib/admin-auth'
import { getSupabaseConfig, supabaseRequest } from '../../../../../lib/supabase/server'
import { cardThemes } from '../../../../../lib/cards/themes'
import { defaultBirthdayMusic } from '../../../../../lib/cards/music'

type CardForDeletion = {
  id: string
  public_id: string
  music_url: string | null
  card_photos: { image_url: string }[]
}

function storagePath(assetUrl: string, publicId: string, supabaseUrl: string) {
  const asset = new URL(assetUrl)
  const prefix = `/storage/v1/object/public/birthday-cards/${publicId}/`
  if (!/^[a-z0-9]{12,32}$/.test(publicId) || asset.origin !== new URL(supabaseUrl).origin || !asset.pathname.startsWith(prefix)) {
    throw new Error('A card asset is outside its expected storage folder.')
  }

  const fileName = decodeURIComponent(asset.pathname.slice(prefix.length))
  if (!/^(?:music\.mp3|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp)$/i.test(fileName)) {
    throw new Error('A card asset has an invalid storage path.')
  }
  return `${publicId}/${fileName}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to preview this card.' }, { status: 401 })
  }

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }

  try {
    const response = await supabaseRequest(
      `/rest/v1/cards?id=eq.${id}&select=id,public_id,theme,language,card_config,recipient_name,sender_name,message,music_url,card_photos(image_url,sort_order)&limit=1`,
    )
    const [card] = await response.json()
    if (!card) {
      return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
    }

    const config = card.card_config && typeof card.card_config === 'object' ? card.card_config : {}
    const theme = cardThemes[card.theme as keyof typeof cardThemes] ? card.theme : 'pastel-cute'
    const hasCustomMusic = typeof card.music_url === 'string'
    const musicChoice = config.musicChoice === 'soft' ? 'soft' : 'signature'

    return NextResponse.json({
      id: card.public_id,
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
    console.error('Could not load a generated birthday card for the admin preview.', error)
    return NextResponse.json({ error: 'This card could not be previewed. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to delete a card.' }, { status: 401 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Card deletion request was rejected.' }, { status: 403 })
  }

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }

  try {
    const cardResponse = await supabaseRequest(
      `/rest/v1/cards?id=eq.${id}&deleted_at=is.null&select=id,public_id,music_url,card_photos(image_url)&limit=1`,
    )
    const [card] = await cardResponse.json() as CardForDeletion[]
    if (!card) {
      return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
    }

    const { url } = getSupabaseConfig()
    const assetPaths = [...(card.card_photos ?? []).map(photo => photo.image_url), ...(card.music_url ? [card.music_url] : [])]
      .map(assetUrl => storagePath(assetUrl, card.public_id, url))

    // Cards with orders or legacy payments are archived so payment, webhook, and audit evidence stays intact.
    const resultResponse = await supabaseRequest('/rest/v1/rpc/admin_delete_card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_card_id: card.id }),
    })
    const outcome = await resultResponse.json() as 'deleted' | 'archived'

    for (const path of assetPaths) {
      await supabaseRequest(`/storage/v1/object/birthday-cards/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE',
      }, { ignoreNotFound: true })
    }

    return NextResponse.json({ deleted: true, paymentHistoryRetained: outcome === 'archived' })
  } catch (error) {
    console.error('Could not delete a generated birthday card from the admin dashboard.', error)
    return NextResponse.json({ error: 'The card could not be fully deleted. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to change this card.' }, { status: 401 })
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Card update request was rejected.' }, { status: 403 })
  }

  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
  }
  const body = await request.json().catch(() => null) as { locked?: unknown } | null
  if (!body || typeof body.locked !== 'boolean' || Object.keys(body).length !== 1) {
    return NextResponse.json({ error: 'Choose whether to lock or unlock this card.' }, { status: 400 })
  }

  try {
    const response = await supabaseRequest(`/rest/v1/cards?id=eq.${id}&deleted_at=is.null`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ admin_locked_at: body.locked ? new Date().toISOString() : null }),
    })
    const [card] = await response.json() as { id: string; admin_locked_at: string | null }[]
    if (!card) return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
    return NextResponse.json({ id: card.id, admin_locked_at: card.admin_locked_at })
  } catch (error) {
    console.error('Could not change the admin lock on a birthday card.', error)
    return NextResponse.json({ error: 'The card could not be updated. Please try again.' }, { status: 500 })
  }
}

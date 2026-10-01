import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../lib/admin-auth'
import { getSupabaseConfig, supabaseRequest } from '../../../../../lib/supabase/server'

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
      `/rest/v1/cards?id=eq.${id}&select=id,public_id,music_url,card_photos(image_url)&limit=1`,
    )
    const [card] = await cardResponse.json() as CardForDeletion[]
    if (!card) {
      return NextResponse.json({ error: 'This birthday card could not be found.' }, { status: 404 })
    }

    const { url } = getSupabaseConfig()
    const assets = [...(card.card_photos ?? []).map(photo => photo.image_url), ...(card.music_url ? [card.music_url] : [])]
    for (const assetUrl of assets) {
      const path = storagePath(assetUrl, card.public_id, url)
      await supabaseRequest(`/storage/v1/object/birthday-cards/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE',
      }, { ignoreNotFound: true })
    }

    await supabaseRequest(`/rest/v1/payments?card_id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ card_id: null, status: 'rejected' }),
    })
    const deleteResponse = await supabaseRequest(`/rest/v1/cards?id=eq.${id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    })
    const deleted = await deleteResponse.json()
    if (!Array.isArray(deleted) || deleted.length === 0) {
      return NextResponse.json({ error: 'This birthday card was already deleted.' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('Could not delete a generated birthday card from the admin dashboard.', error)
    return NextResponse.json({ error: 'The card could not be fully deleted. Please try again.' }, { status: 500 })
  }
}

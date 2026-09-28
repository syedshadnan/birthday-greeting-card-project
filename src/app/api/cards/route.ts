import { NextResponse } from 'next/server'
import { getSupabaseConfig, supabaseRequest } from '../../../lib/supabase/server'

const allowedTemplates = new Set(['romantic', 'cute', 'friend', 'elegant', 'funny', 'minimal', 'cinematic', 'party'])
const premiumTemplates = new Set(['romantic', 'cinematic'])
const maxPhotoSize = 5_000_000
const maxMusicSize = 10_000_000
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const musicTypes = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'])

type UploadedAsset = { file: File; path: string; url: string }

function extensionFor(file: File) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'audio/mpeg') return 'mp3'
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav') return 'wav'
  return 'm4a'
}

async function uploadAsset(file: File, id: string): Promise<UploadedAsset> {
  const { url } = getSupabaseConfig()
  const path = `${id}/${crypto.randomUUID()}.${extensionFor(file)}`

  await supabaseRequest(`/storage/v1/object/birthday-cards/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  })

  return {
    file,
    path,
    url: `${url}/storage/v1/object/public/birthday-cards/${path}`,
  }
}

async function removeAssets(assets: UploadedAsset[]) {
  for (const asset of assets) {
    try {
      await supabaseRequest(`/storage/v1/object/birthday-cards/${asset.path}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Could not remove an incomplete birthday-card upload.', error)
    }
  }
}

export async function POST(request: Request) {
  const uploaded: UploadedAsset[] = []
  let cardId: string | undefined

  try {
    const form = await request.formData()
    const template = form.get('template')
    const recipient = form.get('recipient')
    const message = form.get('message')
    const sender = form.get('sender')
    const photos = form.getAll('photos')
    const music = form.get('music')

    if (
      typeof template !== 'string' || !allowedTemplates.has(template) ||
      typeof recipient !== 'string' || recipient.trim().length < 1 || recipient.length > 32 ||
      typeof message !== 'string' || message.length > 300 ||
      typeof sender !== 'string' || sender.length > 60
    ) {
      return NextResponse.json({ error: 'Check the card details and choose a free template.' }, { status: 400 })
    }

    const photoFiles = photos.filter((file): file is File => file instanceof File && file.size > 0)
    if (photoFiles.length > 5 || photoFiles.some(file => !imageTypes.has(file.type) || file.size > maxPhotoSize)) {
      return NextResponse.json({ error: 'Add up to 5 JPG, PNG, or WebP photos, each smaller than 5 MB.' }, { status: 400 })
    }
    if (music !== null && (!(music instanceof File) || music.size > maxMusicSize || !musicTypes.has(music.type))) {
      return NextResponse.json({ error: 'Add an MP3, WAV, or M4A song smaller than 10 MB.' }, { status: 400 })
    }

    cardId = crypto.randomUUID().replaceAll('-', '')
    for (const file of photoFiles) uploaded.push(await uploadAsset(file, cardId))
    const musicAsset = music instanceof File && music.size > 0 ? await uploadAsset(music, cardId) : undefined
    if (musicAsset) uploaded.push(musicAsset)

    await supabaseRequest('/rest/v1/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        public_id: cardId,
        template_slug: template,
        recipient_name: recipient.trim(),
        sender_name: sender.trim(),
        message: message.trim(),
        music_url: musicAsset?.url ?? null,
        status: premiumTemplates.has(template) ? 'draft' : 'published',
        expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      }),
    })

    if (uploaded.length > (musicAsset ? 1 : 0)) {
      await supabaseRequest('/rest/v1/card_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(uploaded.filter(asset => asset !== musicAsset).map((asset, sort_order) => ({
          card_id: cardId,
          image_url: asset.url,
          sort_order,
        }))),
      })
    }

    return NextResponse.json({ id: cardId, premium: premiumTemplates.has(template) }, { status: 201 })
  } catch (error) {
    console.error('Could not create birthday card.', error)
    if (cardId) {
      try {
        await supabaseRequest(`/rest/v1/cards?public_id=eq.${cardId}`, { method: 'DELETE' })
      } catch (cleanupError) {
        console.error('Could not remove the incomplete birthday card.', cleanupError)
      }
    }
    await removeAssets(uploaded)
    const message = error instanceof Error && error.message.includes('not configured')
      ? 'Card sharing needs Supabase configuration. Add the required Supabase environment variables and run the database migrations.'
      : 'We could not save your card. Please try again.'
    return NextResponse.json({ error: message }, { status: message.startsWith('Card sharing') ? 503 : 500 })
  }
}

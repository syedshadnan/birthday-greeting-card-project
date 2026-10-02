import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { isSameOriginRequest } from '../../../lib/admin-auth'
import { cardLetterMaxLength, isCardConfig, isCardTheme, sanitizeCardText } from '../../../lib/cards/themes'
import { hashCardPassword } from '../../../lib/cards/password'
import { isPremium } from '../../../lib/cards/features'
import { checkRateLimit } from '../../../lib/rate-limit'
import { getSupabaseConfig, supabaseRequest } from '../../../lib/supabase/server'

const legacyTemplates = new Set(['romantic', 'cute', 'friend', 'elegant', 'funny', 'minimal', 'cinematic', 'party'])
const selectableThemes = new Set(['cute', 'rose-romantic', 'friend', 'elegant', 'funny', 'minimal', 'cinematic', 'party'])
const maxMusicSize = 1_000_000
const cardLifetimeMs = 7 * 24 * 60 * 60 * 1000
type UploadedAsset = { path: string; url: string }

async function hasMp3Signature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  return bytes.some((byte, index) => byte === 0xff && index + 1 < bytes.length && (bytes[index + 1] & 0xe0) === 0xe0)
}

function safeSlug() {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz'
  const random = new Uint8Array(24)
  crypto.getRandomValues(random)
  return Array.from(random, value => alphabet[value % alphabet.length]).join('')
}

function claimTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function uploadPhoto(file: File, id: string): Promise<UploadedAsset> {
  if (file.type !== 'image/webp') throw new Error('Photos must be compressed to WebP before upload.')
  const { url } = getSupabaseConfig()
  const path = `${id}/${crypto.randomUUID()}.webp`
  await supabaseRequest(`/storage/v1/object/birthday-cards/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/webp', 'x-upsert': 'false' },
    body: file,
  })
  return { path, url: `${url}/storage/v1/object/public/birthday-cards/${path}` }
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
  let uploadedMusic: UploadedAsset | undefined
  let cardId: string | undefined

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Card creation request was rejected.' }, { status: 403 })
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 4_000_000) {
      return NextResponse.json({ error: 'The upload is too large. Compress photos and try again.' }, { status: 413 })
    }
    if (!await checkRateLimit(request, 'create-card', 8, 600)) {
      return NextResponse.json({ error: 'Too many cards from this connection. Please try again in 10 minutes.' }, { status: 429 })
    }

    const form = await request.formData()
    const template = form.get('template')
    const rawTheme = form.get('theme')
    const theme = isCardTheme(rawTheme) ? rawTheme : null
    const access = form.get('access')
    const recipient = form.get('recipient')
    const sender = form.get('sender')
    const message = form.get('message')
    const language = form.get('language')
    const rawConfig = form.get('config')
    const password = form.get('password')
    const passwordHint = form.get('passwordHint')
    const photos = form.getAll('photos').filter((file): file is File => file instanceof File && file.size > 0)
    const rawMusic = form.get('music')
    const musicFile = rawMusic instanceof File && rawMusic.size > 0 ? rawMusic : undefined
    const musicRightsConfirmed = form.get('musicRightsConfirmed') === 'true'

    if (
      typeof template !== 'string' || (!legacyTemplates.has(template) && !selectableThemes.has(template)) ||
      (theme && (template !== theme || !selectableThemes.has(theme))) ||
      (access !== 'free' && access !== 'premium') ||
      typeof recipient !== 'string' || sanitizeCardText(recipient, 40).length < 1 || recipient.length > 40 ||
      typeof sender !== 'string' || sender.length > 60 ||
      typeof message !== 'string' || message.length > cardLetterMaxLength ||
      (language !== 'en' && language !== 'bn') ||
      typeof rawConfig !== 'string'
      || (isPremium && (typeof password !== 'string' || password.length < 6 || password.length > 128))
      || (password !== null && typeof password !== 'string')
      || (passwordHint !== null && (typeof passwordHint !== 'string' || passwordHint.length > 100))
    ) {
      return NextResponse.json({ error: 'Check the card details and choose a valid theme and access level.' }, { status: 400 })
    }

    let config: unknown
    try {
      config = JSON.parse(rawConfig)
    } catch {
      return NextResponse.json({ error: 'The card details could not be read. Please review the form and try again.' }, { status: 400 })
    }

    if (
      !isCardConfig(config) ||
      config.letter.length > cardLetterMaxLength ||
      config.openingLine.length > 180 ||
      config.keepsakeNote.length > 300 ||
      config.finalWish.length > 500 ||
      config.relationship.length > 80 ||
      config.photos.length !== photos.length ||
      config.photos.some(photo => photo.caption.length > 70) ||
      (config.songId === 'custom') !== !!musicFile
    ) {
      return NextResponse.json({ error: 'Check the length of each card section and photo caption, then try again.' }, { status: 400 })
    }
    if (photos.length > 8 || photos.some(file => file.type !== 'image/webp' || file.size > 320_000)) {
      return NextResponse.json({ error: 'Add up to 8 compressed WebP photos, each no larger than 320 KB.' }, { status: 400 })
    }
    if (rawMusic && !(rawMusic instanceof File)) {
      return NextResponse.json({ error: 'Choose an MP3 audio file.' }, { status: 400 })
    }
    if (musicFile && (
      musicFile.type !== 'audio/mpeg' ||
      musicFile.size > maxMusicSize ||
      !await hasMp3Signature(musicFile)
    )) {
      return NextResponse.json({ error: 'Choose an MP3 file no larger than 1 MB.' }, { status: 400 })
    }
    if (musicFile && !musicRightsConfirmed) {
      return NextResponse.json({ error: 'Confirm that you own or have permission to use this music.' }, { status: 400 })
    }

    cardId = safeSlug()
    const claimToken = randomBytes(32).toString('base64url')
    for (const photo of photos) uploaded.push(await uploadPhoto(photo, cardId))
    if (musicFile) {
      const { url } = getSupabaseConfig()
      const path = `${cardId}/music.mp3`
      await supabaseRequest(`/storage/v1/object/birthday-cards/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mpeg', 'x-upsert': 'false' },
        body: musicFile,
      })
      uploadedMusic = { path, url: `${url}/storage/v1/object/public/birthday-cards/${path}` }
    }
    const cleanConfig = {
      relationship: sanitizeCardText(config.relationship, 80),
      nickname: sanitizeCardText(config.nickname ?? '', 80),
      language,
      openingLine: sanitizeCardText(config.openingLine, 180),
      letter: sanitizeCardText(config.letter, cardLetterMaxLength),
      reasons: config.reasons.map(reason => sanitizeCardText(reason, 180)).filter(Boolean),
      keepsakeNote: sanitizeCardText(config.keepsakeNote, 300),
      finalWish: sanitizeCardText(config.finalWish, 500),
      quote: sanitizeCardText(config.quote ?? '', 300),
      closingLine: sanitizeCardText(config.closingLine ?? '', 300),
      memories: (config.memories ?? []).map(memory => ({
        date: sanitizeCardText(memory.date, 40),
        text: sanitizeCardText(memory.text, 240),
      })).filter(memory => memory.text),
      musicChoice: config.musicChoice ?? 'signature',
      photos: uploaded.map((asset, index) => ({
        url: asset.url,
        caption: sanitizeCardText(config.photos[index].caption, 70),
      })),
      songId: musicFile ? 'custom' : 'none',
    }
    const cleanMessage = sanitizeCardText(message, cardLetterMaxLength)
    const cleanRecipient = sanitizeCardText(recipient, 40)
    const cleanSender = sanitizeCardText(sender, 60)
    const passwordHash = typeof password === 'string' && password.length >= 6
      ? await hashCardPassword(password)
      : null
    const now = Date.now()
    const expiry = now + cardLifetimeMs

    const cardResponse = await supabaseRequest('/rest/v1/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        public_id: cardId,
        template_slug: theme ?? template,
        theme: theme ?? template,
        language,
        card_config: cleanConfig,
        paid: false,
        recipient_name: cleanRecipient,
        sender_name: cleanSender,
        message: cleanMessage,
        music_url: uploadedMusic?.url ?? null,
        status: 'published',
        expires_at: new Date(expiry).toISOString(),
        password_salt: passwordHash?.salt ?? null,
        password_hash: passwordHash?.hash ?? null,
        password_hint: typeof passwordHint === 'string' ? sanitizeCardText(passwordHint, 100) || null : null,
        claim_token_hash: claimTokenHash(claimToken),
      }),
    })
    const [createdCard] = await cardResponse.json() as { id: string }[]
    if (!createdCard || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdCard.id)) {
      throw new Error('The database did not return the new card ID.')
    }

    if (uploaded.length) {
      await supabaseRequest('/rest/v1/card_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(uploaded.map((asset, sort_order) => ({
          card_id: createdCard.id,
          image_url: asset.url,
          sort_order,
        }))),
      })
    }

    const result = NextResponse.json({ id: cardId, premium: false }, { status: 201 })
    result.cookies.set(`wishwell_card_claim_${cardId}`, claimToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(cardLifetimeMs / 1000),
    })
    return result
  } catch (error) {
    console.error('Could not create birthday card.', error)
    if (cardId) {
      try {
        await supabaseRequest(`/rest/v1/cards?public_id=eq.${cardId}`, { method: 'DELETE' })
      } catch (cleanupError) {
        console.error('Could not remove the incomplete birthday card.', cleanupError)
      }
    }
    await removeAssets([...uploaded, ...(uploadedMusic ? [uploadedMusic] : [])])
    const message = error instanceof Error && error.message.includes('not configured')
      ? 'Card creation needs the Supabase database, storage bucket, and rate-limit migration configured.'
      : 'We could not save your card. Please try again.'
    return NextResponse.json({ error: message }, { status: message.startsWith('Card creation') ? 503 : 500 })
  }
}

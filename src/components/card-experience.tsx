'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cardThemes, isCardConfig, isCardTheme, type CardConfig, type CardTheme } from '../lib/cards/themes'
import { defaultBirthdayMusic } from '../lib/cards/music'
import Fireworks from './fireworks'
import { formatBirthdayDate, safePhotoUrl } from './premium-cards/shared/content'
import gateStyles from './premium-cards/password-gate.module.css'
import { premiumCardFeatures } from '../lib/cards/features'

export type CardPayload = {
  id: string
  recipient: string
  sender: string
  message: string
  musicUrl?: string
  musicCredit: boolean
  theme: CardTheme
  language: 'en' | 'bn'
  fullAccess: boolean
  config: CardConfig
}

type LockedCard = { theme: CardTheme; language: 'en' | 'bn'; hint: string }
type SoftMusicPlayer = { context: AudioContext; source: AudioBufferSourceNode }

function createSoftWishBuffer(context: AudioContext) {
  const sampleRate = context.sampleRate
  const duration = 8.5
  const buffer = context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate)
  const samples = buffer.getChannelData(0)
  const melody = [
    [523.25, 0], [659.25, 0.68], [783.99, 1.36], [659.25, 2.04],
    [587.33, 2.72], [698.46, 3.4], [880, 4.08], [698.46, 4.76],
    [523.25, 5.44], [587.33, 6.12], [659.25, 6.8], [783.99, 7.48],
  ]
  const addTone = (frequency: number, start: number, noteLength: number, volume: number) => {
    const firstSample = Math.floor(start * sampleRate)
    const lastSample = Math.min(samples.length, Math.floor((start + noteLength) * sampleRate))
    for (let index = firstSample; index < lastSample; index++) {
      const time = index / sampleRate - start
      const envelope = Math.min(1, time / 0.025) * Math.exp(-3.2 * time)
      const fundamental = Math.sin(2 * Math.PI * frequency * time)
      const secondHarmonic = Math.sin(4 * Math.PI * frequency * time) * 0.22
      const thirdHarmonic = Math.sin(6 * Math.PI * frequency * time) * 0.08
      samples[index] += (fundamental + secondHarmonic + thirdHarmonic) * envelope * volume
    }
  }

  melody.forEach(([frequency, start]) => addTone(frequency, start, 0.58, 0.13))
  ;[130.81, 146.83, 164.81, 130.81].forEach((frequency, index) => addTone(frequency, index * 2.04, 1.15, 0.045))
  return buffer
}

function mapCardPayload(result: Record<string, unknown>): CardPayload {
  if (typeof result.id !== 'string' || !isCardTheme(result.theme) || typeof result.recipient !== 'string') {
    throw new Error('The birthday card returned incomplete details.')
  }
  const initialConfig = isCardConfig(result.config) ? result.config : templateConfig()
  const photos = Array.isArray(result.photos)
    ? result.photos
      .filter((photo: unknown): photo is string => typeof photo === 'string')
      .map((photo: string) => safePhotoUrl(photo))
      .filter((photo): photo is string => !!photo)
    : []
  const config = photos.length
    ? { ...initialConfig, photos: photos.map((url: string, index: number) => ({ ...initialConfig.photos[index], url })) }
    : initialConfig

  return {
    id: result.id,
    recipient: result.recipient,
    sender: typeof result.sender === 'string' ? result.sender : '',
    message: typeof result.message === 'string' ? result.message : '',
    musicUrl: typeof result.music === 'string' ? result.music : undefined,
    musicCredit: result.musicCredit === true,
    theme: result.theme,
    language: result.language === 'bn' ? 'bn' : 'en',
    fullAccess: result.fullAccess === true,
    config,
  }
}

const demoConfig: CardConfig = {
  relationship: 'বন্ধু · best friend',
  language: 'bn',
  openingLine: 'তোমার হাসিতে দিনটা একটু বেশি সুন্দর।',
  letter: 'প্রিয় মায়া, তোমার সঙ্গে কাটানো ছোট ছোট মুহূর্তগুলোই সবচেয়ে বড় উপহার। নতুন বছরটা হোক আনন্দ, সাহস আর মজার গল্পে ভরা।',
  reasons: ['তুমি মন দিয়ে শোনো', 'তোমার হাসি contagious', 'তুমি সবসময় পাশে থাকো'],
  keepsakeNote: 'যেদিন একটু ভালোবাসা দরকার, মনে রেখো—তুমি খুব আপন।',
  finalWish: 'সামনের বছরটা তোমার সব সুন্দর স্বপ্নের মতো হোক। Happy birthday — with all my love!',
  photos: [],
  songId: 'none',
}
const demoCard: CardPayload = {
  id: 'demo', recipient: 'মায়া · Maya', sender: 'রিয়া · Rhea', message: demoConfig.letter,
  musicUrl: defaultBirthdayMusic.url, musicCredit: true,
  theme: 'rose-romantic', language: 'bn', fullAccess: true, config: demoConfig,
}
const sceneNames = ['A little surprise', 'Your birthday', 'Make a wish', 'The words', 'Our memories', 'A few reasons', 'A little note for later', 'Pick a birthday wish', 'For the year ahead']

function templateConfig(): CardConfig {
  return {
    relationship: '',
    language: 'en',
    openingLine: 'A little birthday surprise, made just for you.',
    letter: 'Here’s to all the lovely moments still to come.',
    reasons: ['You make ordinary days brighter.', 'You always know how to make me laugh.', 'You make people feel at home.'],
    keepsakeNote: 'Keep this little reminder close: you are loved, always.',
    finalWish: 'May this year bring you more joy than you can imagine.',
    photos: [],
    songId: 'none',
  }
}

export default function CardExperience({ slug, adminPreviewId, previewCard, onExitPreview }: {
  slug: string
  adminPreviewId?: string
  previewCard?: CardPayload
  onExitPreview?: () => void
}) {
  const [card, setCard] = useState<CardPayload | null>(previewCard ?? (slug === 'demo' ? demoCard : null))
  const [error, setError] = useState('')
  const [lockedCard, setLockedCard] = useState<LockedCard | null>(null)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [scene, setScene] = useState(0)
  const [litCandles, setLitCandles] = useState(3)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicMessage, setMusicMessage] = useState('')
  const [celebrationCount, setCelebrationCount] = useState(0)
  const [wishMessage, setWishMessage] = useState('')
  const [noteOpened, setNoteOpened] = useState(false)
  const [pickedWish, setPickedWish] = useState('')
  const [brokenPhotoUrls, setBrokenPhotoUrls] = useState<Set<string>>(() => new Set())
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; caption: string } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const softMusicRef = useRef<SoftMusicPlayer | null>(null)
  const photoDialogRef = useRef<HTMLDialogElement>(null)
  const touchX = useRef<number | null>(null)
  const labels = card?.language === 'bn'
    ? ['ছোট্ট চমক', 'শুভ জন্মদিন', 'একটা ইচ্ছে করো', 'তোমার জন্য চিঠি', 'আমাদের স্মৃতি', 'তোমাকে ভালোবাসার কারণ', 'পরে পড়ার জন্য ছোট্ট চিঠি', 'একটা শুভেচ্ছা বেছে নাও', 'সামনের বছরের জন্য']
    : sceneNames
  const floatingWishes = card?.language === 'bn'
    ? ['শুভ জন্মদিন ✨', 'অনেক ভালোবাসা ❤️', 'হাসিখুশি থেকো 😊', 'আজ শুধু তোমার দিন 🎂']
    : [`Happy birthday, ${card?.recipient ?? ''} ✨`, 'All the love today 💛', 'Keep shining ✨', 'Today is all yours 🎈']
  const decorationMarks = ['✦', '✧']
  const celebrationParticles = ['✦', '♥', '✧', '●', '🎉']

  useEffect(() => {
    if (previewCard || slug === 'demo') return
    const controller = new AbortController()
    setBrokenPhotoUrls(new Set())
    const cardUrl = adminPreviewId
      ? `/api/admin/cards/${encodeURIComponent(adminPreviewId)}`
      : `/api/cards/${encodeURIComponent(slug)}`
    fetch(cardUrl, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json() as Record<string, unknown>
        if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'We could not open this birthday card.')
        if (result.locked === true && isCardTheme(result.theme)) {
          setLockedCard({
            theme: result.theme,
            language: result.language === 'bn' ? 'bn' : 'en',
            hint: typeof result.passwordHint === 'string' ? result.passwordHint : '',
          })
          return
        }
        setLockedCard(null)
        setCard(mapCardPayload(result))
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'We could not open this birthday card.')
      })
    return () => controller.abort()
  }, [slug, adminPreviewId, previewCard])

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (unlocking || unlockPassword.length === 0) return
    setUnlocking(true)
    setUnlockError('')
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(slug)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassword }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'That password did not unlock this card.')

      const cardResponse = await fetch(`/api/cards/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      const cardResult = await cardResponse.json() as Record<string, unknown>
      if (!cardResponse.ok || cardResult.locked === true) {
        throw new Error(typeof cardResult.error === 'string' ? cardResult.error : 'This card could not be opened after unlock.')
      }
      setCard(mapCardPayload(cardResult))
      setLockedCard(null)
      setUnlockPassword('')
    } catch (cause) {
      setUnlockError(cause instanceof Error ? cause.message : 'We could not check that password.')
    } finally {
      setUnlocking(false)
    }
  }

  const maxScene = card?.fullAccess ? sceneNames.length - 1 : 1
  const move = useCallback((direction: number) => setScene(current => Math.max(0, Math.min(maxScene, current + direction))), [maxScene])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (selectedPhoto) return
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [move, selectedPhoto])

  useEffect(() => {
    const dialog = photoDialogRef.current
    if (!dialog || !selectedPhoto || dialog.open) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [selectedPhoto])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        audioRef.current?.pause()
        const player = softMusicRef.current
        if (player?.context.state === 'running') void player.context.suspend()
        setMusicPlaying(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => () => {
    audioRef.current?.pause()
    const player = softMusicRef.current
    softMusicRef.current = null
    if (player) void player.context.close()
  }, [slug])

  const themeClass = card ? cardThemes[card.theme]?.className ?? 'theme-pastel' : 'theme-pastel'
  const config = card?.config
  const photoItems = useMemo(() => config?.photos ?? [], [config])
  const wishes = config?.reasons.filter(reason => reason.trim()) ?? []

  if (lockedCard) return <main className={gateStyles.page}><section className={gateStyles.card} lang={lockedCard.language}>
    <a className={gateStyles.brand} href="/"><img src="/images/birthday-smile-logo.png" alt="BirthdaySmile" /> BirthdaySmile</a>
    <div className={gateStyles.seal} aria-hidden="true">✦</div>
    <span className={gateStyles.eyebrow}>{lockedCard.language === 'bn' ? 'শুধু তোমার জন্য' : 'A PRIVATE BIRTHDAY SURPRISE'}</span>
    <h1>{lockedCard.language === 'bn' ? 'একটি ছোট্ট চমক' : 'A little surprise'}</h1>
    <p>{lockedCard.language === 'bn' ? 'এই কার্ডটি খুলতে প্রেরকের দেওয়া পাসওয়ার্ড লিখুন।' : 'Enter the password from the sender to open your birthday story.'}</p>
    {lockedCard.hint && <p className={gateStyles.hint}><strong>{lockedCard.language === 'bn' ? 'ইঙ্গিত:' : 'A hint:'}</strong> {lockedCard.hint}</p>}
    <form className={gateStyles.form} onSubmit={event => void unlock(event)}>
      <label>{lockedCard.language === 'bn' ? 'পাসওয়ার্ড' : 'CARD PASSWORD'}
        <input type="password" value={unlockPassword} onChange={event => setUnlockPassword(event.target.value)} autoComplete="current-password" aria-describedby="unlock-error" required/>
      </label>
      <p id="unlock-error" className={gateStyles.error} role="alert">{unlockError}</p>
      <button type="submit" disabled={unlocking || !unlockPassword}>{unlocking ? 'Opening your card…' : lockedCard.language === 'bn' ? 'চমকটি খোলো →' : 'Open your card →'}</button>
    </form>
    <p className={gateStyles.footer}>The password is never part of the link.</p>
  </section></main>
  if (!card) return <main className="story-loading"><span>✦</span><h1>{error||'A little surprise is on its way…'}</h1>{error&&<a href="/">Back to Wishwell</a>}</main>
  const usesSoftMusic = !card.musicUrl && card.config.musicChoice === 'soft'
  const playSoftMusic = async () => {
    let player = softMusicRef.current
    if (!player || player.context.state === 'closed') {
      const context = new AudioContext()
      const source = context.createBufferSource()
      source.buffer = createSoftWishBuffer(context)
      source.loop = true
      source.connect(context.destination)
      source.start()
      player = { context, source }
      softMusicRef.current = player
    }
    await player.context.resume()
  }

  const start = () => {
    setScene(1)
    setLitCandles(3)
    setCelebrationCount(count => count + 1)
    setWishMessage('')
    setNoteOpened(false)
    setPickedWish('')
    setSelectedPhoto(null)
    if (usesSoftMusic) {
      void playSoftMusic()
        .then(() => { setMusicPlaying(true); setMusicMessage('') })
        .catch(() => { setMusicPlaying(false); setMusicMessage('Music could not start. Tap the music button to try again.') })
    } else if (audioRef.current) {
      const audio = audioRef.current
      void audio.play()
        .then(() => { setMusicPlaying(true); setMusicMessage('') })
        .catch(() => { setMusicPlaying(false); setMusicMessage('Music could not start. Tap the music button to try again.') })
    }
  }

  const makeWish = () => {
    setLitCandles(0)
    setWishMessage(card.language === 'bn'
      ? 'তোমার সব সুন্দর ইচ্ছে সত্যি হোক! ✨'
      : 'May your sweetest wish come true! ✨')
    setCelebrationCount(count => count + 1)
  }

  const replay = () => {
    setScene(0)
    setLitCandles(3)
    setWishMessage('')
    setNoteOpened(false)
    setPickedWish('')
    setSelectedPhoto(null)
    setCelebrationCount(0)
    audioRef.current?.pause()
    const player = softMusicRef.current
    if (player?.context.state === 'running') void player.context.suspend()
    setMusicPlaying(false)
  }

  const toggleMusic = () => {
    if (usesSoftMusic) {
      const player = softMusicRef.current
      if (player?.context.state === 'running') {
        void player.context.suspend()
          .then(() => setMusicPlaying(false))
          .catch(() => setMusicMessage('Music could not be paused. Please try again.'))
      } else {
        void playSoftMusic()
          .then(() => { setMusicPlaying(true); setMusicMessage('') })
          .catch(() => { setMusicPlaying(false); setMusicMessage('Music could not start. Try tapping again.') })
      }
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
        .then(() => { setMusicPlaying(true); setMusicMessage('') })
        .catch(() => { setMusicPlaying(false); setMusicMessage('Music could not start. Try tapping again.') })
    } else {
      audio.pause()
      setMusicPlaying(false)
    }
  }
  const shareCard = async () => {
    const shareData = { title: `A birthday card for ${card.recipient}`, url: window.location.href }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (cause) {
        // Cancelling the native dialog is intentional, so do not replace it
        // with an unexpected clipboard action.
        if (cause instanceof DOMException && cause.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(shareData.url)
      setMusicMessage('Card link copied. You can share it anywhere.')
    } catch {
      setMusicMessage('Copying is unavailable in this browser. Copy the address from the address bar.')
    }
  }
  const nextLabel = card.language === 'bn' ? 'পরের পাতা →' : 'Next page →'
  const surpriseReveal = card.theme === 'surprise-reveal'
  const gateText = surpriseReveal
    ? card.language === 'bn' ? 'একটা চমক অপেক্ষায়' : 'A little secret is waiting'
    : card.language === 'bn' ? 'তোমার জন্য একটা ছোট্ট চমক' : 'A little birthday surprise for you'
  const heroMotif = <div className="story-balloons" aria-hidden="true"><i>♥</i><i>✦</i><i>✧</i></div>
  const gateInteraction = <button className="story-primary" type="button" onClick={start}>{surpriseReveal?(card.language==='bn'?'চমকটা খোলো':'Reveal the secret'):(card.language==='bn'?'উপহারটি খোলো':'Open your surprise')} <span>→</span></button>

  return <main className={`story-experience ${themeClass} ${card.language==='bn'?'language-bn':''}`} onTouchStart={event=>{touchX.current=event.touches[0]?.clientX??null}} onTouchEnd={event=>{
    if(touchX.current===null)return
    const difference=(event.changedTouches[0]?.clientX??touchX.current)-touchX.current
    if(Math.abs(difference)>55)move(difference<0?1:-1)
    touchX.current=null
  }}>
    <div className={`story-decoration story-decoration-one decoration-${card.theme}`} aria-hidden="true">{decorationMarks[0]}</div><div className={`story-decoration story-decoration-two decoration-${card.theme}`} aria-hidden="true">{decorationMarks[1]}</div>
    <div className="story-wishes" aria-hidden="true">{floatingWishes.map((wish,index)=><span key={`wish-${index}-${wish}`}>{wish}</span>)}</div>
    {celebrationCount>0&&<div className={`birthday-confetti celebration-${card.theme}`} key={`celebration-${celebrationCount}`} aria-hidden="true">{Array.from({length:24},(_,index)=><i key={`particle-${index}`} style={{'--particle-index':index} as React.CSSProperties}>{celebrationParticles[index%celebrationParticles.length]}</i>)}</div>}
    <header className="story-controls">
      {onExitPreview ? (
        <button className="brand" type="button" onClick={onExitPreview}>← Back to editing</button>
      ) : (
        <a className="brand" href={adminPreviewId?'/admin':'/'}>{adminPreviewId?'← Back to admin':<><img src="/images/birthday-smile-logo.png" alt="BirthdaySmile" /> BirthdaySmile</>}</a>
      )}
      <div className="story-controls-right">
        {card.musicUrl || usesSoftMusic
          ? <button className="story-music-toggle" type="button" onClick={toggleMusic} aria-label={musicPlaying?'Pause music':'Play music'}>{musicPlaying?'♫ Music on':card.musicCredit?'♫ Birthday song':usesSoftMusic?'♫ Soft Wish':'♫ Your music'}</button>
          : <span className="story-music-off">♫ No music</span>}
        {!adminPreviewId&&!onExitPreview&&<button className="story-icon-button" type="button" aria-label="Share this card" onClick={()=>void shareCard()}>↗</button>}
      </div>
    </header>
    {card.musicCredit&&<details className="story-music-credit"><summary aria-label="Music credits" title="Music credits">ⓘ</summary><div><span>{defaultBirthdayMusic.title} by {defaultBirthdayMusic.artist}</span><a href={defaultBirthdayMusic.source} target="_blank" rel="noreferrer">Source</a><a href={defaultBirthdayMusic.licenseUrl} target="_blank" rel="noreferrer">{defaultBirthdayMusic.license}</a></div></details>}
    <section className="story-scene" key={scene}>
      {scene===0&&<div className="story-gate"><div className="story-gift" aria-hidden="true">🎁</div><span className="story-kicker">{gateText}</span><h1>{surpriseReveal?(card.language==='bn'?'তোমার জন্য':'Just for you'):(card.language==='bn'?'শুভ জন্মদিন,':'Happy Birthday,')}<br/><i>{surpriseReveal?(card.language==='bn'?'একটা গোপন চিঠি':'a birthday secret'):card.recipient}</i></h1><p className="story-gift-note">{config?.openingLine||'A little surprise, made just for you.'}</p>{gateInteraction}</div>}
      {scene===1&&<div className={`story-hero hero-${card.theme}`}><span className="story-kicker">{labels[1]}</span>{heroMotif}<h1>{card.language==='bn'?'শুভ জন্মদিন,':'Happy birthday,'}<br/><i>{card.recipient}</i></h1><div className="story-detail-badges">{config?.nickname&&<span className="detail-nickname"><i aria-hidden="true">♡</i>{card.language==='bn'?'ডাকনাম':'Also known as'} · {config.nickname}</span>}{config?.age&&<span className="detail-age"><i aria-hidden="true">✦</i>{card.language==='bn'?'বয়স':'Age'} · {config.age}</span>}{config?.date&&<span className="detail-date"><i aria-hidden="true">✧</i>{formatBirthdayDate(config.date,card.language)}</span>}{config?.relationship&&<span className="detail-relationship"><i aria-hidden="true">♥</i>{card.language==='bn'?'আমার':'My'} {config.relationship}</span>}</div>{config?.openingLine&&<p className="story-opening-line">{config.openingLine}</p>}</div>}
      {scene===2&&<div className="story-cake"><span className="story-kicker">{labels[2]}</span><h2>{card.language==='bn'?'তোমার জন্য কেক':'A cake, just for you'}</h2><div className="cake-illustration"><div className="cake-candles">{[0,1,2].map(candle=><button type="button" key={`candle-${candle}`} aria-label={`${litCandles>candle?'Extinguish':'Light'} candle ${candle+1}`} onClick={()=>setLitCandles(current=>current>candle?candle:Math.max(current,candle+1))}><i className={litCandles>candle?'flame':''}/></button>)}</div><div className="cake-top"/><div className="cake-bottom"/></div><p>{wishMessage|| (litCandles?(card.language==='bn'?'শিখাগুলোতে ট্যাপ করে একটা ইচ্ছে করো।':'Tap a flame, then make a wish.'):(card.language==='bn'?'তোমার ইচ্ছেটা সত্যি হোক!':'Your wish is on its way.'))}</p><button className="story-primary" onClick={makeWish}>{card.language==='bn'?'ইচ্ছে করো ✦':'Make a wish ✦'}</button></div>}
      {scene===3&&<article className="story-letter"><span className="story-kicker">{labels[3]}</span><div className="letter-paper"><small>{card.language==='bn'?`প্রিয় ${config?.nickname||card.recipient},`:`Dear ${config?.nickname||card.recipient},`}</small>{(config?.letter||card.message)&&<p>{config?.letter||card.message}</p>}{config?.quote&&<blockquote>“{config.quote}”</blockquote>}{card.sender&&<span>{card.language==='bn'?'ভালোবাসাসহ,':'With love,'} {card.sender}</span>}</div></article>}
      {scene===4&&<div className="story-memories"><span className="story-kicker">{labels[4]}</span><h2>{card.language==='bn'?<>ছোট ছোট মুহূর্ত,<br/><i>কাছে থাকুক।</i></>:<>Little moments,<br/><i>kept close.</i></>}</h2>{config?.memories?.some(memory=>memory.text.trim())&&<ol className="memory-timeline">{config.memories.filter(memory=>memory.text.trim()).map((memory,index)=><li key={`timeline-${index}`}><time>{memory.date||'A day to remember'}</time><p>{memory.text}</p></li>)}</ol>}{photoItems.length?<><p className="memory-intro">{card.language==='bn'?'ছবিতে ধরা আমাদের প্রিয় সময়গুলো। যেকোনো ছবিতে ট্যাপ করো।':'A few favorite moments, kept right here. Tap a photo to take a closer look.'}</p><div className="memory-stack">{photoItems.map((photo,index)=><figure key={`${photo.url}-${index}`} style={{'--photo-index':index} as React.CSSProperties}>      {brokenPhotoUrls.has(photo.url)?<div className="memory-photo-fallback" role="img" aria-label={photo.caption||`Birthday memory ${index+1}`}><span aria-hidden="true">✧</span><small>{card.language==='bn'?'ছবিটি লোড হয়নি':'Photo unavailable'}</small></div>:<button type="button" className="memory-photo" onClick={()=>setSelectedPhoto(photo)} aria-label={`Open photo ${index+1}: ${photo.caption||'Birthday memory'}`}><img src={photo.url} alt={photo.caption||`Birthday memory ${index+1}`} loading={index<2?'eager':'lazy'} onError={()=>setBrokenPhotoUrls(current=>new Set(current).add(photo.url))}/><span aria-hidden="true">↗</span></button>}<figcaption>{photo.caption||'A moment worth keeping'}</figcaption></figure>)}</div></>:<div className="memory-empty"><div className="memory-empty-art" aria-hidden="true"><span>▧</span><span>✦</span><span>▧</span></div><p>{card.language==='bn'?'ছবিগুলো এখানে ছোট্ট অ্যালবাম হয়ে থাকত।':'Your favorite photos would make this little album even more special.'}</p><small>{card.language==='bn'?'কার্ড বানানোর সময় সর্বোচ্চ ৮টি ছবি যোগ করা যাবে':'Add up to 8 photos while creating a card.'}</small></div>}</div>}
      {scene===5&&<div className="story-reasons"><span className="story-kicker">{labels[5]}</span><h2>{card.language==='bn'?<>তোমাকে ভালোবাসার<br/><i>কারণগুলো।</i></>:<>Because you’re<br/><i>you.</i></>}</h2>{wishes.length?<div className="reason-list">{wishes.map((reason,index)=><article key={`${index}-${reason}`}><span>{String(index+1).padStart(2,'0')}</span><p>{reason}</p></article>)}</div>:<div className="story-empty-note"><span aria-hidden="true">✧</span><p>{card.language==='bn'?'এই পাতায় তোমার জন্য লেখা শুভেচ্ছাগুলো থাকত।':'This page is ready for the wishes you want to give.'}</p></div>}</div>}
      {scene===6&&<div className={`story-keepsake ${noteOpened?'is-open':''}`}><span className="story-kicker">{labels[6]}</span><h2>{card.language==='bn'?<>যেদিন একটু<br/><i>ভালোবাসা দরকার।</i></>:<>For a day when<br/><i>you need a little love.</i></>}</h2><div className="keepsake-envelope" aria-live="polite"><span className="keepsake-star">✦</span><span className="keepsake-label">{card.language==='bn'?'তোমার জন্য, সবসময়':'A little note, just for you'}</span><div className="keepsake-letter">{config?.keepsakeNote||(card.language==='bn'?'তোমার ছোট্ট নোটের জন্য এই জায়গাটুকু।':'A little space for a note from you.')}</div></div><button className="story-primary" type="button" onClick={()=>setNoteOpened(opened=>!opened)}>{noteOpened?(card.language==='bn'?'চিঠিটা আবার ভাঁজ করো':'Fold the note again'):(card.language==='bn'?'চিঠিটা খোলো ✉':'Open your note ✉')}</button></div>}
      {scene===7&&<div className="story-wish-pick"><span className="story-kicker">{labels[7]}</span><h2>{card.language==='bn'?<>শুভেচ্ছার বয়াম,<br/><i>শুধু তোমার জন্য।</i></>:<>A little jar of<br/><i>good things.</i></>}</h2><div className={`wish-token ${pickedWish?'has-wish':''}`} key={pickedWish||'empty-wish'} aria-live="polite">{pickedWish?<><span>✦</span><p>{pickedWish}</p></>:<><span>✧</span><p>{wishes.length?(card.language==='bn'?'একটা ছোট্ট শুভেচ্ছা বেছে নাও':'Pick a little wish to carry with you'):(card.language==='bn'?'প্রেরকের লেখা শুভেচ্ছা এখানে আসবে':'Wishes from the sender will appear here')}</p></>}</div><button className="story-primary" type="button" disabled={!wishes.length} onClick={()=>{const options=pickedWish?wishes.filter(wish=>wish!==pickedWish):wishes;const next=options.length?options:wishes;setPickedWish(next[Math.floor(Math.random()*next.length)]);setCelebrationCount(count=>count+1)}}>{pickedWish?(card.language==='bn'?'আরেকটা শুভেচ্ছা তোলো ✨':'Pick another wish ✨'):(card.language==='bn'?'একটা শুভেচ্ছা তোলো ✨':'Pick a wish ✨')}</button></div>}
      {scene===8&&<div className="story-finale"><Fireworks/><div className="finale-sparks" aria-hidden="true">✦　✧　✦</div><span className="story-kicker">{labels[8]}</span><h2>{card.language==='bn'?'সামনের বছরটা':'May your next year'}<br/><i>{card.language==='bn'?'হোক দারুণ':'be wonderful.'}</i></h2><p>{config?.finalWish||'Wishing you more good things than you can count.'}</p>{config?.closingLine&&<p>{config.closingLine}</p>}<strong>{card.sender&&`— ${card.sender}`}</strong><button className="story-primary" onClick={replay}>↻ {card.language==='bn'?'আবার দেখো':'Replay your story'}</button></div>}
    </section>
    {selectedPhoto&&<dialog ref={photoDialogRef} className="memory-lightbox" aria-label={selectedPhoto.caption||'Birthday photo'} onClose={()=>setSelectedPhoto(null)} onClick={event=>{if(event.target===event.currentTarget)setSelectedPhoto(null)}}><figure><button type="button" className="memory-lightbox-close" aria-label="Close photo" onClick={()=>setSelectedPhoto(null)}>×</button><img src={selectedPhoto.url} alt={selectedPhoto.caption||'Birthday memory'}/>{selectedPhoto.caption&&<figcaption>{selectedPhoto.caption}</figcaption>}</figure></dialog>}
    {scene>0&&<footer className="story-navigation"><button type="button" disabled={scene===0} onClick={()=>move(-1)}>← Back</button><span>{scene+1} / {maxScene+1}</span>{scene<maxScene&&<button type="button" onClick={()=>move(1)}>{nextLabel}</button>}</footer>}
    {musicMessage&&<p className="story-music-message" role="status">{musicMessage}</p>}
    {card.musicUrl&&<audio ref={audioRef} src={card.musicUrl} preload="auto" loop/>}
  </main>
}

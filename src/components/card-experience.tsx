'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cardThemes, type CardConfig, type CardTheme } from '../lib/cards/themes'
import { defaultBirthdayMusic } from '../lib/cards/music'
import Fireworks from './fireworks'

type CardPayload = {
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

export default function CardExperience({ slug }: { slug: string }) {
  const [card, setCard] = useState<CardPayload | null>(slug === 'demo' ? demoCard : null)
  const [error, setError] = useState('')
  const [scene, setScene] = useState(0)
  const [litCandles, setLitCandles] = useState(3)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicMessage, setMusicMessage] = useState('')
  const [celebrationCount, setCelebrationCount] = useState(0)
  const [wishMessage, setWishMessage] = useState('')
  const [noteOpened, setNoteOpened] = useState(false)
  const [pickedWish, setPickedWish] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; caption: string } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const photoDialogRef = useRef<HTMLDialogElement>(null)
  const touchX = useRef<number | null>(null)
  const labels = card?.language === 'bn'
    ? ['ছোট্ট চমক', 'শুভ জন্মদিন', 'একটা ইচ্ছে করো', 'তোমার জন্য চিঠি', 'আমাদের স্মৃতি', 'তোমাকে ভালোবাসার কারণ', 'পরে পড়ার জন্য ছোট্ট চিঠি', 'একটা শুভেচ্ছা বেছে নাও', 'সামনের বছরের জন্য']
    : sceneNames
  const floatingWishes = card?.language === 'bn'
    ? ['শুভ জন্মদিন ✨', 'অনেক ভালোবাসা ❤️', 'হাসিখুশি থেকো 😊', 'আজ শুধু তোমার দিন 🎂']
    : [`Happy birthday, ${card?.recipient ?? ''} ✨`, 'All the love today 💛', 'Keep shining ✨', 'Today is all yours 🎈']

  useEffect(() => {
    if (slug === 'demo') return
    const controller = new AbortController()
    fetch(`/api/cards/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'We could not open this birthday card.')
        const config = result.config && Array.isArray(result.config.reasons)
          ? result.config as CardConfig
          : templateConfig()
        setCard({
          id: result.id,
          recipient: result.recipient,
          sender: result.sender,
          message: result.message,
          musicUrl: typeof result.music === 'string' ? result.music : undefined,
          musicCredit: result.musicCredit === true,
          theme: result.theme,
          language: result.language,
          fullAccess: result.fullAccess === true,
          config,
        })
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'We could not open this birthday card.')
      })
    return () => controller.abort()
  }, [slug])

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
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [scene])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        audioRef.current?.pause()
        setMusicPlaying(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const themeClass = card ? cardThemes[card.theme]?.className ?? 'theme-pastel' : 'theme-pastel'
  const config = card?.config
  const photoItems = useMemo(() => config?.photos ?? [], [config])

  if (!card) return <main className="story-loading"><span>✦</span><h1>{error||'A little surprise is on its way…'}</h1>{error&&<a href="/">Back to Wishwell</a>}</main>

  const start = () => {
    setScene(1)
    setLitCandles(3)
    setCelebrationCount(count => count + 1)
    setWishMessage('')
    setNoteOpened(false)
    setPickedWish('')
    setSelectedPhoto(null)
    const audio = audioRef.current
    if (audio) {
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
    setMusicPlaying(false)
  }

  const toggleMusic = () => {
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
  const gateText = card.language === 'bn' ? 'তোমার জন্য একটা ছোট্ট চমক' : 'A little birthday surprise for you'

  return <main className={`story-experience ${themeClass} ${card.language==='bn'?'language-bn':''}`} onTouchStart={event=>{touchX.current=event.touches[0]?.clientX??null}} onTouchEnd={event=>{
    if(touchX.current===null)return
    const difference=(event.changedTouches[0]?.clientX??touchX.current)-touchX.current
    if(Math.abs(difference)>55)move(difference<0?1:-1)
    touchX.current=null
  }}>
    <div className="story-decoration story-decoration-one">✦</div><div className="story-decoration story-decoration-two">✧</div>
    <div className="story-wishes" aria-hidden="true">{floatingWishes.map((wish,index)=><span key={`wish-${index}-${wish}`}>{wish}</span>)}</div>
    {celebrationCount>0&&<div className="birthday-confetti" key={`celebration-${celebrationCount}`} aria-hidden="true">{Array.from({length:18},(_,index)=><i key={`particle-${index}`} style={{'--particle-index':index} as React.CSSProperties}>{['✦','♥','✧','●','🎉'][index%5]}</i>)}</div>}
    <header className="story-controls">
      <a className="brand" href="/">✦ wishwell</a>
      <div className="story-controls-right">
        {card.musicUrl
          ? <button className="story-music-toggle" type="button" onClick={toggleMusic} aria-label={musicPlaying?'Pause music':'Play music'}>{musicPlaying?'♫ Music on':card.musicCredit?'♫ Birthday song':'♫ Your music'}</button>
          : <span className="story-music-off">♫ No music</span>}
        <button className="story-icon-button" type="button" aria-label="Share this card" onClick={()=>void shareCard()}>↗</button>
      </div>
    </header>
    {card.musicCredit&&<details className="story-music-credit"><summary aria-label="Music credits" title="Music credits">ⓘ</summary><div><span>{defaultBirthdayMusic.title} by {defaultBirthdayMusic.artist}</span><a href={defaultBirthdayMusic.source} target="_blank" rel="noreferrer">Source</a><a href={defaultBirthdayMusic.licenseUrl} target="_blank" rel="noreferrer">{defaultBirthdayMusic.license}</a></div></details>}
    <section className="story-scene" key={scene}>
      {scene===0&&<div className="story-gate"><div className="story-gift" aria-hidden="true">🎁</div><span className="story-kicker">{gateText}</span><h1>{card.language==='bn'?'শুভ জন্মদিন,':'Happy Birthday,'}<br/><i>{card.recipient}</i></h1><p className="story-gift-note">{config?.openingLine||'A little surprise, made just for you.'}</p><button className="story-primary" onClick={start}>{card.language==='bn'?'উপহারটি খোলো':'Open your surprise'} <span>→</span></button></div>}
      {scene===1&&<div className="story-hero"><span className="story-kicker">{labels[1]}</span><div className="story-balloons" aria-hidden="true"><i>♥</i><i>✦</i><i>✧</i></div><h1>{card.language==='bn'?'শুভ জন্মদিন,':'Happy birthday,'}<br/><i>{card.recipient}</i></h1><p>{config?.openingLine||card.message}</p></div>}
      {scene===2&&<div className="story-cake"><span className="story-kicker">{labels[2]}</span><h2>{card.language==='bn'?'তোমার জন্য কেক':'A cake, just for you'}</h2><div className="cake-illustration"><div className="cake-candles">{[0,1,2].map(candle=><button type="button" key={`candle-${candle}`} aria-label={`${litCandles>candle?'Extinguish':'Light'} candle ${candle+1}`} onClick={()=>setLitCandles(current=>current>candle?candle:Math.max(current,candle+1))}><i className={litCandles>candle?'flame':''}/></button>)}</div><div className="cake-top"/><div className="cake-bottom"/></div><p>{wishMessage|| (litCandles?(card.language==='bn'?'শিখাগুলোতে ট্যাপ করে একটা ইচ্ছে করো।':'Tap a flame, then make a wish.'):(card.language==='bn'?'তোমার ইচ্ছেটা সত্যি হোক!':'Your wish is on its way.'))}</p><button className="story-primary" onClick={makeWish}>{card.language==='bn'?'ইচ্ছে করো ✦':'Make a wish ✦'}</button></div>}
      {scene===3&&<article className="story-letter"><span className="story-kicker">{labels[3]}</span><div className="letter-paper"><small>dear {card.recipient},</small><p>{config?.letter||card.message}</p><span>With love, {card.sender}</span></div></article>}
      {scene===4&&<div className="story-memories"><span className="story-kicker">{labels[4]}</span><h2>{card.language==='bn'?<>ছোট ছোট মুহূর্ত,<br/><i>কাছে থাকুক।</i></>:<>Little moments,<br/><i>kept close.</i></>}</h2>{photoItems.length?<><p className="memory-intro">{card.language==='bn'?'ছবিতে ধরা আমাদের প্রিয় সময়গুলো। যেকোনো ছবিতে ট্যাপ করো।':'A few favorite moments, kept right here. Tap a photo to take a closer look.'}</p><div className="memory-stack">{photoItems.map((photo,index)=><figure key={`${photo.url}-${index}`} style={{'--photo-index':index} as React.CSSProperties}><button type="button" className="memory-photo" onClick={()=>setSelectedPhoto(photo)} aria-label={`Open photo ${index+1}: ${photo.caption||'Birthday memory'}`}><img src={photo.url} alt={photo.caption||`Birthday memory ${index+1}`}/><span aria-hidden="true">↗</span></button><figcaption>{photo.caption||'A moment worth keeping'}</figcaption></figure>)}</div></>:<div className="memory-empty"><div className="memory-empty-art" aria-hidden="true"><span>▧</span><span>✦</span><span>▧</span></div><p>{card.language==='bn'?'ছবিগুলো এখানে ছোট্ট অ্যালবাম হয়ে থাকত।':'Your favorite photos would make this little album even more special.'}</p><small>{card.language==='bn'?'কার্ড বানানোর সময় সর্বোচ্চ ৬টি ছবি যোগ করা যাবে':'Add up to 6 photos while creating a card.'}</small></div>}</div>}
      {scene===5&&<div className="story-reasons"><span className="story-kicker">{labels[5]}</span><h2>Because you’re<br/><i>you.</i></h2><div className="reason-list">{(config?.reasons.length?config.reasons:templateConfig().reasons).map((reason,index)=><article key={`${index}-${reason}`}><span>0{index+1}</span><p>{reason}</p></article>)}</div></div>}
      {scene===6&&<div className={`story-keepsake ${noteOpened?'is-open':''}`}><span className="story-kicker">{labels[6]}</span><h2>{card.language==='bn'?<>যেদিন একটু<br/><i>ভালোবাসা দরকার।</i></>:<>For a day when<br/><i>you need a little love.</i></>}</h2><div className="keepsake-envelope" aria-live="polite"><span className="keepsake-star">✦</span><span className="keepsake-label">{card.language==='bn'?'তোমার জন্য, সবসময়':'A little note, just for you'}</span><div className="keepsake-letter">{config?.keepsakeNote||'Keep this little reminder close: you are loved, always.'}</div></div><button className="story-primary" type="button" onClick={()=>setNoteOpened(opened=>!opened)}>{noteOpened?(card.language==='bn'?'চিঠিটা আবার ভাঁজ করো':'Fold the note again'):(card.language==='bn'?'চিঠিটা খোলো ✉':'Open your note ✉')}</button></div>}
      {scene===7&&<div className="story-wish-pick"><span className="story-kicker">{labels[7]}</span><h2>{card.language==='bn'?<>শুভেচ্ছার বয়াম,<br/><i>শুধু তোমার জন্য।</i></>:<>A little jar of<br/><i>good things.</i></>}</h2><div className={`wish-token ${pickedWish?'has-wish':''}`} key={pickedWish||'empty-wish'} aria-live="polite">{pickedWish?<><span>✦</span><p>{pickedWish}</p></>:<><span>✧</span><p>{card.language==='bn'?'একটা ছোট্ট শুভেচ্ছা বেছে নাও':'Pick a little wish to carry with you'}</p></>}</div><button className="story-primary" type="button" onClick={()=>{const wishes=config?.reasons.filter(Boolean)??[];const options=wishes.length?wishes:[card.language==='bn'?'অনেক আনন্দের দিন আসুক':'May the year bring you more laughter.'];const next=options.length>1&&pickedWish?options.filter(wish=>wish!==pickedWish):options;setPickedWish(next[Math.floor(Math.random()*next.length)]);setCelebrationCount(count=>count+1)}}>{pickedWish?(card.language==='bn'?'আরেকটা শুভেচ্ছা তোলো ✨':'Pick another wish ✨'):(card.language==='bn'?'একটা শুভেচ্ছা তোলো ✨':'Pick a wish ✨')}</button></div>}
      {scene===8&&<div className="story-finale"><Fireworks/><div className="finale-sparks" aria-hidden="true">✦　✧　✦</div><span className="story-kicker">{labels[8]}</span><h2>{card.language==='bn'?'সামনের বছরটা':'May your next year'}<br/><i>{card.language==='bn'?'হোক দারুণ':'be wonderful.'}</i></h2><p>{config?.finalWish||'Wishing you more good things than you can count.'}</p><strong>— {card.sender}</strong><button className="story-primary" onClick={replay}>↻ {card.language==='bn'?'আবার দেখো':'Replay your story'}</button></div>}
    </section>
    {selectedPhoto&&<dialog ref={photoDialogRef} className="memory-lightbox" aria-label={selectedPhoto.caption||'Birthday photo'} onClose={()=>setSelectedPhoto(null)} onClick={event=>{if(event.target===event.currentTarget)setSelectedPhoto(null)}}><figure><button type="button" className="memory-lightbox-close" aria-label="Close photo" onClick={()=>setSelectedPhoto(null)}>×</button><img src={selectedPhoto.url} alt={selectedPhoto.caption||'Birthday memory'}/>{selectedPhoto.caption&&<figcaption>{selectedPhoto.caption}</figcaption>}</figure></dialog>}
    {scene>0&&<footer className="story-navigation"><button type="button" disabled={scene===0} onClick={()=>move(-1)}>← Back</button><span>{scene+1} / {maxScene+1}</span>{scene<maxScene&&<button type="button" onClick={()=>move(1)}>{nextLabel}</button>}</footer>}
    {musicMessage&&<p className="story-music-message" role="status">{musicMessage}</p>}
    {card.musicUrl&&<audio ref={audioRef} src={card.musicUrl} preload="none" loop/>}
  </main>
}

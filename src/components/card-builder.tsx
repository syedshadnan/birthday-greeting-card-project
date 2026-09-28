'use client'

import { useEffect, useMemo, useState } from 'react'
import { cardThemes, type CardConfig, type CardLanguage, type CardTheme } from '../lib/cards/themes'

type BuilderPhoto = { file: File; preview: string; caption: string }
type CardBuilderProps = { initialTheme?: CardTheme }

const steps = ['Theme', 'Your words', 'Photos', 'Preview']
const maxMusicSize = 1_000_000
const mp3FrameScanLimit = 256_000
const mpeg1Layer3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
const blankConfig = (language: CardLanguage): CardConfig => ({
  relationship: '',
  language,
  openingLine: '',
  letter: '',
  reasons: ['', '', ''],
  finalWish: '',
  photos: [],
  songId: 'none',
})

function mp3FrameLength(bytes: Uint8Array, offset: number) {
  if (offset + 4 > bytes.length) return 0
  const header = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  if (((header & 0xffe00000) >>> 0) !== 0xffe00000) return 0

  const version = (header >>> 19) & 3
  const layer = (header >>> 17) & 3
  const bitrateIndex = (header >>> 12) & 15
  const sampleRateIndex = (header >>> 10) & 3
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return 0

  const baseSampleRates = [44100, 48000, 32000]
  const sampleRate = baseSampleRates[sampleRateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4)
  const bitrates = version === 3 ? mpeg1Layer3Bitrates : mpeg2Layer3Bitrates
  const bitrate = bitrates[bitrateIndex] * 1000
  const padding = (header >>> 9) & 1
  return Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + padding
}

function findMp3FrameStart(bytes: Uint8Array) {
  for (let offset = 0; offset + 8 <= bytes.length; offset++) {
    const frameLength = mp3FrameLength(bytes, offset)
    if (!frameLength || offset + frameLength + 4 > bytes.length) continue
    if (mp3FrameLength(bytes, offset + frameLength)) return offset
  }
  return -1
}

async function trimMp3ToLimit(file: File) {
  if (file.size <= maxMusicSize) {
    return file.type === 'audio/mpeg' ? file : new File([file], file.name, { type: 'audio/mpeg' })
  }
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer())
  let audioStart = 0
  let hasId3Tag = header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33

  if (hasId3Tag && header.length === 10) {
    const tagSize = ((header[6] & 0x7f) << 21) | ((header[7] & 0x7f) << 14) | ((header[8] & 0x7f) << 7) | (header[9] & 0x7f)
    audioStart = 10 + tagSize + (header[3] === 4 && (header[5] & 0x10) !== 0 ? 10 : 0)
    if (audioStart >= file.size) {
      audioStart = 0
      hasId3Tag = false
    }
  }

  const scanSize = Math.min(file.size - audioStart, maxMusicSize + mp3FrameScanLimit)
  const bytes = new Uint8Array(await file.slice(audioStart, audioStart + scanSize).arrayBuffer())
  const frameStart = findMp3FrameStart(bytes)
  if (frameStart < 0 || frameStart > mp3FrameScanLimit) {
    throw new Error('Could not find MP3 audio frames to trim. Please try exporting the file as a standard MP3.')
  }

  const firstFrameLength = mp3FrameLength(bytes, frameStart)
  let keepId3Tag = hasId3Tag && frameStart === 0 && audioStart + firstFrameLength <= maxMusicSize
  let frameBudget = maxMusicSize - (keepId3Tag ? audioStart : 0)
  let frameOffset = frameStart
  let trimmedEnd = frameStart
  let frameCount = 0

  while (frameOffset + 4 <= bytes.length) {
    const frameLength = mp3FrameLength(bytes, frameOffset)
    if (!frameLength || frameOffset + frameLength > frameStart + frameBudget) break
    frameOffset += frameLength
    trimmedEnd = frameOffset
    frameCount++
  }

  if (!frameCount && keepId3Tag) {
    keepId3Tag = false
    frameBudget = maxMusicSize
    frameOffset = frameStart
    trimmedEnd = frameStart
    while (frameOffset + 4 <= bytes.length) {
      const frameLength = mp3FrameLength(bytes, frameOffset)
      if (!frameLength || frameOffset + frameLength > frameStart + frameBudget) break
      frameOffset += frameLength
      trimmedEnd = frameOffset
      frameCount++
    }
  }

  if (!frameCount) throw new Error('Could not find MP3 audio frames to trim. Please try exporting the file as a standard MP3.')
  const prefix = keepId3Tag ? [file.slice(0, audioStart)] : []
  return new File([...prefix, bytes.subarray(frameStart, trimmedEnd)], file.name, { type: 'audio/mpeg' })
}

async function compressPhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const maxDimension = 1800
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot prepare photos for upload.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.68, 0.54, 0.4, 0.28]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
      if (blob && blob.size <= 200_000) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'memory'}.webp`, { type: 'image/webp' })
      }
    }
    throw new Error(`${file.name} is still too large after compression. Try a smaller photo.`)
  } finally {
    bitmap.close()
  }
}

export default function CardBuilder({ initialTheme = 'pastel-cute' }: CardBuilderProps) {
  const [step, setStep] = useState(0)
  const [theme, setTheme] = useState<CardTheme>(initialTheme)
  const [language, setLanguage] = useState<CardLanguage>('en')
  const [config, setConfig] = useState<CardConfig>(() => blankConfig('en'))
  const [recipient, setRecipient] = useState('')
  const [sender, setSender] = useState('')
  const [photos, setPhotos] = useState<BuilderPhoto[]>([])
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicRightsConfirmed, setMusicRightsConfirmed] = useState(false)
  const [musicNotice, setMusicNotice] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    const queryTheme = new URLSearchParams(window.location.search).get('theme')
    if (queryTheme && Object.hasOwn(cardThemes, queryTheme)) setTheme(queryTheme as CardTheme)
  }, [])
  useEffect(() => () => photos.forEach(photo => URL.revokeObjectURL(photo.preview)), [photos])

  const updateConfig = <K extends keyof CardConfig>(key: K, value: CardConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }))
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    const selected = Array.from(files)
    if (selected.length + photos.length > 6) {
      setError('Choose up to 6 photos.')
      return
    }
    if (selected.some(file => !file.type.startsWith('image/') || file.size > 15_000_000)) {
      setError('Choose image files smaller than 15 MB each.')
      return
    }

    setError('')
    setCompressing(true)
    try {
      const prepared = await Promise.all(selected.map(compressPhoto))
      setPhotos(current => [...current, ...prepared.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        caption: '',
      }))])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare these photos.')
    } finally {
      setCompressing(false)
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(current => {
      URL.revokeObjectURL(current[index].preview)
      return current.filter((_, photoIndex) => photoIndex !== index)
    })
  }

  const save = async () => {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      if (musicFile && !musicRightsConfirmed) {
        throw new Error('Confirm that you own or have permission to use this music.')
      }
      const form = new FormData()
      form.set('template', theme)
      form.set('theme', theme)
      form.set('access', 'free')
      form.set('recipient', recipient)
      form.set('sender', sender)
      form.set('message', config.letter)
      form.set('language', language)
      form.set('config', JSON.stringify({
        ...config,
        language,
        songId: musicFile ? 'custom' : 'none',
        photos: photos.map(photo => ({ url: '', caption: photo.caption })),
      }))
      photos.forEach(photo => form.append('photos', photo.file))
      if (musicFile) {
        form.set('music', musicFile)
        form.set('musicRightsConfirmed', 'true')
      }

      const response = await fetch('/api/cards', { method: 'POST', body: form })
      const result: { id?: string; error?: string } = await response.json()
      if (!response.ok || !result.id) throw new Error(result.error || 'Could not save your card.')

      const url = `${window.location.origin}/card/${result.id}`
      setShareUrl(url)
      setStep(4)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your card.')
    } finally {
      setSaving(false)
    }
  }

  const reasons = useMemo(() => config.reasons, [config.reasons])

  if (shareUrl) {
    return <main className="builder-page"><section className="builder-success">
      <span className="eyebrow">YOUR FREE BIRTHDAY STORY IS READY</span>
      <h1>Share a little <i>love.</i></h1>
      <p>All nine scenes are ready to share, completely free.</p>
      <div className="url"><span>{shareUrl}</span><button onClick={() => void navigator.clipboard?.writeText(shareUrl)}>Copy</button></div>
      <a href={`https://wa.me/?text=${encodeURIComponent(`A birthday surprise for you: ${shareUrl}`)}`} target="_blank" rel="noreferrer">Share preview on WhatsApp ↗</a>
    </section></main>
  }

  return <main className="builder-page">
    <header className="builder-header"><a className="brand" href="/">✦ wishwell</a><span>All 9 scenes · Free</span></header>
    <section className="builder-shell">
      <div className="builder-title"><span className="eyebrow">A CARD MADE BY YOU</span><h1>Make their day<br/><i>feel like yours.</i></h1><p>Write it in English, বাংলা, or a little of both.</p></div>
      <ol className="builder-progress" aria-label="Card creation steps">{steps.map((label, index)=><li className={index===step?'current':index<step?'complete':''} key={label}><span>{index+1}</span>{label}</li>)}</ol>
      <div className="builder-grid">
        <section className="builder-form" aria-label={steps[step]}>
          {step===0&&<><h2>Pick a feeling</h2><p>Four illustrated palettes; every card is free to create and share.</p><div className="theme-choices">{(Object.keys(cardThemes) as CardTheme[]).map(id=><button type="button" className={`theme-choice ${cardThemes[id].className} ${theme===id?'selected':''}`} key={id} onClick={()=>setTheme(id)}><span>✦</span><strong>{cardThemes[id].label}</strong><small>All 9 scenes · Free</small></button>)}</div><label className="builder-label">CARD LANGUAGE<select value={language} onChange={event=>{const next=event.target.value as CardLanguage;setLanguage(next);updateConfig('language',next)}}><option value="en">English</option><option value="bn">বাংলা</option></select></label></>}
          {step===1&&<><h2>The words that matter</h2><label className="builder-label">FOR SOMEONE WHO…<input value={recipient} onChange={event=>setRecipient(event.target.value)} maxLength={40} placeholder="Their name" required/></label><label className="builder-label">YOUR NAME<input value={sender} onChange={event=>setSender(event.target.value)} maxLength={60} placeholder="Who it’s from"/></label><label className="builder-label">YOUR RELATIONSHIP<input value={config.relationship} onChange={event=>updateConfig('relationship',event.target.value)} maxLength={80} placeholder="Best friend, sister, my person…"/></label><label className="builder-label">OPENING LINE<input value={config.openingLine} onChange={event=>updateConfig('openingLine',event.target.value)} maxLength={180} placeholder={language==='bn'?'তোমার জন্য ছোট্ট একটা চমক…':'A little surprise, just for you…'}/></label><label className="builder-label">YOUR LETTER<textarea value={config.letter} onChange={event=>updateConfig('letter',event.target.value)} maxLength={5000} rows={5} placeholder={language==='bn'?'মনের কথা লিখুন…':'Write it like you’re talking to them.'}/><small>{config.letter.length}/5000</small></label>
          <fieldset className="reasons-field"><legend>THREE TO SIX REASONS YOU LOVE THEM</legend>{reasons.map((reason,index)=><input aria-label={`Reason ${index+1}`} key={`reason-${index}`} value={reason} onChange={event=>updateConfig('reasons',reasons.map((item,i)=>i===index?event.target.value:item))} maxLength={180} placeholder={`Reason ${index+1}`}/ >)}{reasons.length<6&&<button type="button" className="upload" onClick={()=>updateConfig('reasons',[...reasons,''])}>＋ Add another reason</button>}{reasons.length>3&&<button type="button" className="upload" onClick={()=>updateConfig('reasons',reasons.slice(0,-1))}>Remove last reason</button>}</fieldset>
          <label className="builder-label">ONE LAST WISH<textarea value={config.finalWish} onChange={event=>updateConfig('finalWish',event.target.value)} maxLength={500} rows={2} placeholder="All the good things I hope this year brings you…"/></label></>}
          {step===2&&<><h2>Keep a few memories</h2><p>Up to 6 photos. They’re resized in your browser to WebP, at most 200 KB each.</p><label className="photo-picker">＋ {compressing?'Preparing photos…':'Choose photos'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden disabled={compressing||photos.length>=6} onChange={event=>{void addPhotos(event.target.files);event.target.value=''}}/></label><div className="builder-photos">{photos.map((photo,index)=><article key={photo.preview}><img src={photo.preview} alt={`Memory ${index+1}`}/><input value={photo.caption} maxLength={160} onChange={event=>setPhotos(current=>current.map((item,i)=>i===index?{...item,caption:event.target.value}:item))} aria-label={`Caption for memory ${index+1}`} placeholder="A little caption"/><button type="button" aria-label={`Remove photo ${index+1}`} onClick={()=>removePhoto(index)}>×</button><small>{Math.round(photo.file.size/1024)} KB WebP</small></article>)}</div><label className="builder-label">ADD YOUR OWN MUSIC (OPTIONAL)<input type="file" accept=".mp3,audio/mpeg" disabled={compressing} onChange={event=>{const file=event.target.files?.[0];event.target.value='';setError('');setMusicNotice('');setMusicRightsConfirmed(false);if(!file){setMusicFile(null);return}if(file.type!=='audio/mpeg'&&!file.name.toLowerCase().endsWith('.mp3')){setMusicFile(null);setError('Choose an MP3 audio file.');return}setCompressing(true);void trimMp3ToLimit(file).then(trimmed=>{setMusicFile(trimmed);if(trimmed.size<file.size)setMusicNotice(`Trimmed to ${Math.ceil(trimmed.size/1024)} KB to fit the 1 MB upload limit.`)}).catch(cause=>{setMusicFile(null);setError(cause instanceof Error?cause.message:'Could not trim this MP3 file.')}).finally(()=>setCompressing(false))}}/><small>The free default is the “Happy Birthday to You” song. Uploading your own MP3 automatically replaces it on this card; files over 1 MB are trimmed to fit.</small></label>{musicNotice&&<p className="music-notice" role="status">{musicNotice}</p>}{musicFile&&<div className="music-selected"><span>♫ {musicFile.name} · {Math.ceil(musicFile.size/1024)} KB</span><button type="button" className="upload" onClick={()=>{setMusicFile(null);setMusicRightsConfirmed(false);setMusicNotice('')}}>Remove music</button><label><input type="checkbox" checked={musicRightsConfirmed} onChange={event=>setMusicRightsConfirmed(event.target.checked)}/> I own this music or have permission to use it.</label></div>}</>}
          {step===3&&<><h2>Read it once more</h2><p>Your complete nine-scene birthday story is free to create and share.</p><div className={`builder-preview ${cardThemes[theme].className}`}><span>✦ {cardThemes[theme].label} ✦</span><h3>Happy birthday,<br/><i>{recipient||'your favorite person'}</i></h3><p>{config.openingLine||config.letter||'A little birthday wish, made with love.'}</p><small>{sender?'With love, '+sender:'Made with love'}</small></div><div className="builder-summary"><span>{photos.length} photos · {language==='bn'?'বাংলা':'English'}</span><span>{reasons.filter(Boolean).length} reasons</span></div></>}
          {error&&<p className="form-error" role="alert">{error}</p>}
          <div className="builder-actions">{step>0&&<button type="button" className="button outline" disabled={saving||compressing} onClick={()=>setStep(current=>current-1)}>← Back</button>}{step<3?<button type="button" className="button dark" disabled={saving||compressing||(step===1&&(!recipient.trim()||reasons.filter(item=>item.trim()).length<3))} onClick={()=>{setError('');setStep(current=>current+1)}}>{step===2?'Preview card':'Continue'} →</button>:<button type="button" className="button dark" disabled={saving||compressing} onClick={()=>void save()}>{saving?'Saving…':'Create my free card'}</button>}</div>
        </section>
        <aside className={`builder-art ${cardThemes[theme].className}`} aria-label="Live theme preview"><span className="art-orbit">✦</span><span className="art-spark">✧</span><div><small>{cardThemes[theme].label}</small><strong>{recipient||'Your person'}</strong><em>{config.openingLine||'A day that’s all about you.'}</em></div><span className="art-watermark">a little wishwell magic</span></aside>
      </div>
    </section>
  </main>
}

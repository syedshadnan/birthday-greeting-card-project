'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import styles from './delivery.module.css'

type DeliveryProps = { cardId: string; password?: string; template: string }

export default function CardDelivery({ cardId, password, template }: DeliveryProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [svg, setSvg] = useState('')
  const [png, setPng] = useState('')
  const [svgUrl, setSvgUrl] = useState('')
  const [hidePassword, setHidePassword] = useState(true)
  const [separateSlip, setSeparateSlip] = useState(false)
  const [paper, setPaper] = useState<'A5' | 'A6'>('A5')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)

  const authorizeShare = async () => {
    if (claimed) return true
    if (claiming) return false
    setClaiming(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        window.location.href = `/login?next=${encodeURIComponent(`/share/${cardId}`)}`
        return false
      }

      const claimResponse = await fetch(`/api/cards/${encodeURIComponent(cardId)}/claim`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!claimResponse.ok && claimResponse.status !== 403 && claimResponse.status !== 409) {
        const result = await claimResponse.json() as { error?: string }
        throw new Error(result.error || 'This card could not be attached to your account.')
      }

      const shareResponse = await fetch(`/api/cards/${encodeURIComponent(cardId)}/share`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const result = await shareResponse.json() as { url?: string; error?: string }
      if (!shareResponse.ok || !result.url) throw new Error(result.error || 'This card is not authorized for sharing.')
      setUrl(result.url)
      setClaimed(true)
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This card could not be attached to your account.')
      return false
    } finally {
      setClaiming(false)
    }
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void authorizeShare()
    })
  }, [])

  useEffect(() => {
    if (!url) return
    let current = true
    Promise.all([
      QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, width: 1024, color: { dark: '#171514', light: '#ffffff' } }),
      QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 4, width: 1024, color: { dark: '#171514', light: '#ffffff' } }),
    ]).then(([nextSvg, nextPng]) => {
      if (current) {
        setSvg(nextSvg)
        setPng(nextPng)
      }
    }).catch(error => {
      console.error('Could not generate the birthday-card QR code.', error)
      if (current) setNotice('The QR code could not be generated. You can still share the link above.')
    })
    return () => { current = false }
  }, [url])

  useEffect(() => {
    if (!svg) return
    const nextUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    setSvgUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [svg])

  const copy = async () => {
    if (!await authorizeShare() || !url) return
    setCopied(false)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setNotice('Share link copied.')
    } catch {
      setNotice('Copy is unavailable here. Select and copy the link above.')
    }
  }

  const share = async () => {
    if (!await authorizeShare() || !url) return
    if (!navigator.share) {
      await copy()
      return
    }
    try {
      await navigator.share({ title: `A ${template} birthday card`, url })
    } catch (error) {
      if (error instanceof DOMException && error.name !== 'AbortError') setNotice('Sharing is unavailable in this browser.')
    }
  }

  const printShare = async () => {
    if (await authorizeShare() && url) window.print()
  }

  const requestShareAccess = () => {
    void authorizeShare()
  }

  return (
    <main className={styles.delivery}>
      <section className={styles.intro}>
        <span className={styles.eyebrow}>READY TO SEND</span>
        <h1>Your little surprise<br/><i>is ready.</i></h1>
        <p>{password ? 'The recipient will need the password to open the card. Send the link and password separately for privacy.' : 'Your share link is ready. Keep it somewhere you can find it again.'}</p>
        <label className={styles.linkLabel}>PRIVATE SHARE LINK
          <span className={styles.linkRow}><input readOnly value={url ?? 'Sign in to unlock the share link'} aria-label="Card share link"/><button type="button" onClick={() => void copy()} disabled={claiming}>{copied?'Copied!':'Copy link'}</button></span>
        </label>
        {password && <div className={styles.passwordBox}><div><span>RECIPIENT PASSWORD</span><strong>{password}</strong></div><small>Share this separately from the QR printout.</small></div>}
        <div className={styles.shareActions}>
          <button type="button" onClick={() => void share()} disabled={claiming}>{claiming ? 'Checking access…' : 'Share link'}</button>
          <button type="button" className={styles.secondary} onClick={() => void printShare()} disabled={claiming}>Print card sheet</button>
        </div>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
      </section>
      <section className={styles.qrPanel} aria-label="Share QR code">
        <div className={styles.qrHeading}><span>SCAN TO OPEN</span><strong>{template}</strong></div>
        <div className={styles.qrCode} aria-label="QR code for the card link">
          {svg ? <div dangerouslySetInnerHTML={{ __html: svg }}/> : url ? <span>Preparing QR…</span> : <button type="button" onClick={requestShareAccess} disabled={claiming}>{claiming ? 'Checking access…' : 'Sign in to unlock QR sharing'}</button>}
        </div>
        <p>QR code contains the link only — never the password.</p>
        <div className={styles.downloads}>
          <a href={png || undefined} download="birthday-card-qr.png" aria-disabled={!png || !url} onClick={event => { if (!png || !url) { event.preventDefault(); void authorizeShare() } }}>Download PNG · 1024px</a>
          <a href={svgUrl || undefined} download="birthday-card-qr.svg" aria-disabled={!svgUrl || !url} onClick={event => { if (!svgUrl || !url) { event.preventDefault(); void authorizeShare() } }}>Download SVG</a>
        </div>
        <fieldset className={styles.printOptions}>
          <legend>PRINT OPTIONS</legend>
          {password && <label><input type="checkbox" checked={hidePassword} onChange={event => setHidePassword(event.target.checked)}/> Hide password on printed sheet</label>}
          {password && <label><input type="checkbox" checked={separateSlip} onChange={event => setSeparateSlip(event.target.checked)}/> Print password slip separately</label>}
          <label>Paper size <select value={paper} onChange={event => setPaper(event.target.value as 'A5' | 'A6')}><option>A5</option><option>A6</option></select></label>
        </fieldset>
      </section>
      <div className={`${styles.printArea} ${hidePassword ? styles.hidePrintedPassword : ''} ${separateSlip ? styles.withSlip : ''}`} data-paper={paper}>
        <article className={styles.printCard}>
          <span>✦ WISHWELL · {template.toUpperCase()} ✦</span>
          <h2>Scan to open your<br/><i>birthday card.</i></h2>
          {svg && <div className={styles.printQr} dangerouslySetInnerHTML={{ __html: svg }}/>}
          <p>{url ?? 'Sign in to unlock the share link.'}</p>
          {password && <div className={styles.printPassword}><small>CARD PASSWORD</small><strong>{password}</strong></div>}
          <footer>For a little more birthday magic, made just for you.</footer>
        </article>
        {password && separateSlip && <article className={styles.passwordSlip}><span>WISHWELL · PRIVATE</span><h2>Card password</h2><strong>{password}</strong><p>Keep this separate from the QR code.</p></article>}
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'

export default function AccountCardActions({ cardId, paymentStatus, shareEnabled }: { cardId: string; paymentStatus: 'none' | 'pending' | 'submitted' | 'paid'; shareEnabled: boolean }) {
  const [notice, setNotice] = useState('')

  const copyLink = async () => {
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}/share`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || 'The share link could not be loaded.')
      await navigator.clipboard.writeText(result.url)
      setNotice('Link copied.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Copy is unavailable here. Open the card to copy its link.')
    }
  }

  return (
    <div className="account-card-actions">
      {shareEnabled ? (
        <>
          <a className="button outline" href={`/card/${cardId}`}>View card</a>
          <a className="button outline" href={`/share/${cardId}`}>Share</a>
          <button className="button outline" type="button" onClick={() => void copyLink()}>Copy link</button>
        </>
      ) : <div>
        <a className="button outline" href={`/card/${cardId}`}>View card</a>
        {paymentStatus === 'none' && <><p>Verified payment is required before sharing this card.</p><a className="button outline" href={`/payment/premium?cardId=${cardId}`}>Pay 99 BDT to unlock sharing</a></>}
        {paymentStatus === 'pending' && <><p>Payment pending.</p><a className="button outline" href={`/payment/premium?cardId=${cardId}`}>Continue payment</a></>}
        {paymentStatus === 'submitted' && <><p>Payment submitted — awaiting verification.</p><a className="button outline" href={`/payment/premium?cardId=${cardId}`}>View payment status</a></>}
        {paymentStatus === 'paid' && <><p>Payment verified. Sharing is ready to be authorized.</p><a className="button outline" href={`/share/${cardId}`}>Unlock sharing</a></>}
      </div>}
      {notice && <span role="status">{notice}</span>}
    </div>
  )
}

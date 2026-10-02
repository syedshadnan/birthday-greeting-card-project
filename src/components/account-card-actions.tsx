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
          <div className="account-card-action-row"><a className="button outline" href={`/card/${cardId}`}>View card</a><a className="button dark" href={`/share/${cardId}`}>Share card</a></div>
          <button className="account-card-copy" type="button" onClick={() => void copyLink()}>Copy link</button>
        </>
      ) : <div className="account-card-locked-actions">
        <p>{paymentStatus === 'submitted' ? 'Payment submitted — awaiting verification.' : paymentStatus === 'pending' ? 'Payment is pending. Complete payment to continue.' : 'Verified payment is required before sharing this card.'}</p>
        <div className="account-card-action-row"><a className="button outline" href={`/card/${cardId}`}>View card</a>{paymentStatus === 'none' && <a className="button dark" href={`/payment/premium?cardId=${cardId}`}>Pay 99 BDT</a>}{paymentStatus === 'pending' && <a className="button dark" href={`/payment/premium?cardId=${cardId}`}>Continue payment</a>}{paymentStatus === 'submitted' && <a className="button dark" href={`/payment/premium?cardId=${cardId}`}>View payment status</a>}</div>
      </div>}
      {notice && <span role="status">{notice}</span>}
    </div>
  )
}

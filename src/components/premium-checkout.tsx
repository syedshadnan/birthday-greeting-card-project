'use client'

import { useEffect, useState } from 'react'

type PaymentAccount = { method: 'bkash' | 'nagad'; label: string; number: string }

export default function PremiumCheckout({ template }: { template: string }) {
  const [cardId, setCardId] = useState('')
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [customerName, setCustomerName] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const price = template === 'romantic' || template === 'cinematic' ? 49 : 0
  const templateName = template === 'cinematic' ? 'Cinematic' : 'Romantic'

  useEffect(() => {
    setCardId(new URLSearchParams(window.location.search).get('card') ?? '')
    fetch('/api/payments/config')
      .then(async response => {
        const result: { accounts?: PaymentAccount[]; error?: string } = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load the payment numbers.')
        setAccounts(result.accounts ?? [])
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load the payment numbers.'))
      .finally(() => setLoading(false))
  }, [])

  const account = accounts.find(item => item.method === paymentMethod)
  const cardUrl = typeof window === 'undefined' || !cardId ? '' : `${window.location.origin}/card/${cardId}`

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!cardId) {
      setError('Your saved card link is missing. Go back to the editor and create your card again.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, customerName, payerPhone, transactionId, paymentMethod }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not submit your payment details.')
      setSubmitted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your payment details.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyCardLink = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl)
      setError('Your card link is copied. It will open after admin approval.')
    } catch {
      setError('Copy is unavailable. You can select the card link and copy it manually.')
    }
  }

  return <><nav><a className="brand" href="/">✦ wishwell</a></nav><main className="payment-page">
    <button className="back" onClick={() => window.history.back()}>← Back to my card</button>
    {submitted ? <section className="payment-box">
      <span className="eyebrow">PAYMENT DETAILS RECEIVED</span>
      <h1>It’s with the <i>admin.</i></h1>
      <p className="help">Your transfer is pending manual review. Your card will be available as soon as the admin confirms the payment; submitting details does not mean payment has been verified.</p>
      <label htmlFor="submitted-card-link">YOUR CARD LINK</label>
      <div className="url"><span id="submitted-card-link">{cardUrl}</span><button type="button" onClick={copyCardLink}>Copy</button></div>
      {error&&<p className="form-error" role="status">{error}</p>}
      <a className="button dark" href="/">Back to Wishwell</a>
    </section> : <><span className="eyebrow">ONE-TIME PREMIUM ACCESS</span>
      <h1>Make it extra <i>special.</i></h1>
      <p className="sub">Pay by transferring <b>৳{price}</b> to either personal account below. Your card unlocks after the admin checks your transaction.</p>
      <div className="payment-box">
        <div className="payment-price"><span>{templateName} template</span><strong>৳{price}</strong></div>
        {loading ? <p className="help">Loading payment account details…</p> : error&&!accounts.length ? <p className="form-error" role="alert">{error}</p> : <>
          <label htmlFor="payment-method">PAY USING</label>
          <select id="payment-method" value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value as 'bkash'|'nagad')}>
            {accounts.map(item=><option key={item.method} value={item.method}>{item.label}</option>)}
          </select>
          {account&&<div className="bkash-number"><small>{account.label} Personal Number</small><strong>{account.number}</strong><button type="button" onClick={()=>void navigator.clipboard?.writeText(account.number)}>Copy number</button></div>}
          <p className="help">Send exactly ৳{price} using the personal-account transfer option in {account?.label??'your selected app'}. Keep the transaction ID from your receipt.</p>
          <form onSubmit={submit}>
            <label htmlFor="payment-name">YOUR NAME</label><input id="payment-name" value={customerName} onChange={event=>setCustomerName(event.target.value)} maxLength={100} autoComplete="name" required/>
            <label htmlFor="payer-phone">PHONE NUMBER YOU PAID FROM</label><input id="payer-phone" value={payerPhone} onChange={event=>setPayerPhone(event.target.value)} inputMode="numeric" placeholder="01XXXXXXXXX" autoComplete="tel" required/>
            <label htmlFor="transaction-id">TRANSACTION ID</label><input id="transaction-id" value={transactionId} onChange={event=>setTransactionId(event.target.value)} maxLength={20} autoCapitalize="characters" required/>
            <p className="help">Payments are checked manually. The card will not be unlocked until the admin confirms the amount and transaction in their bKash or Nagad account.</p>
            {error&&<p className="form-error" role="alert">{error}</p>}
            <button className="button dark" type="submit" disabled={submitting||!account}>{submitting?'Sending for review…':'I’ve sent the payment →'}</button>
          </form>
        </>}
      </div>
    </>}
  </main></>
}

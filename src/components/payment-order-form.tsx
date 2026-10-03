'use client'

import { useEffect, useMemo, useState } from 'react'

type Method = 'bkash' | 'nagad'
type Account = { method: Method; accountNumber: string }
type Order = {
  id: string
  status: string
  payment_method: Method
  customer_phone: string
  payment_submitted_at?: string | null
}
type PaymentState = { paid: boolean; pending: boolean; submitted: boolean }

const methodDetails: Record<Method, { label: string; accent: string; description: string }> = {
  bkash: { label: 'bKash', accent: 'bkash', description: 'Pay securely using bKash' },
  nagad: { label: 'Nagad', accent: 'nagad', description: 'Pay securely using Nagad' },
}

export default function PaymentOrderForm({ cardId }: { cardId: string }) {
  const [method, setMethod] = useState<Method | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paid, setPaid] = useState(false)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)

  const step = paid ? 4 : order ? 3 : method ? 2 : 1
  const selectedMethod = method ?? 'bkash'
  const detail = methodDetails[selectedMethod]
  const phoneIsValid = /^01[3-9]\d{8}$/.test(phone.replace(/[\s-]/g, ''))
  const progress = useMemo(() => [
    ['1', 'Method'], ['2', 'Your number'], ['3', 'Send payment'], ['4', 'Verification'],
  ] as const, [])

  const claimCardIfNeeded = async () => {
    const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}/claim`, { method: 'POST', credentials: 'include' })
    if (!response.ok && response.status !== 403 && response.status !== 409) {
      const result = await response.json() as { error?: string }
      throw new Error(result.error || 'This card could not be attached to your account.')
    }
  }

  useEffect(() => {
    let active = true
    fetch(`/api/orders/access?cardId=${encodeURIComponent(cardId)}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return
        const access = await response.json() as PaymentState
        if (active && access.paid) setPaid(true)
      })
      .catch(error => {
      if (active) setNotice(error instanceof Error ? error.message : 'The order could not be loaded.')
      })
    return () => { active = false }
  }, [cardId])

  useEffect(() => {
    if (!order || paid) return
    const check = async () => {
      const response = await fetch(`/api/orders/access?cardId=${encodeURIComponent(cardId)}`, { cache: 'no-store' })
      if (!response.ok) return
      const result = await response.json() as PaymentState
      if (result.paid) setPaid(true)
    }
    const timer = window.setInterval(() => void check(), 10000)
    return () => window.clearInterval(timer)
  }, [cardId, order, paid])

  const chooseMethod = (nextMethod: Method) => {
    setMethod(nextMethod)
    setNotice('')
  }

  const createOrder = async () => {
    if (!method || !phoneIsValid) {
      setNotice('Enter a valid Bangladesh mobile number, such as 01XXXXXXXXX.')
      return
    }
    setCreating(true)
    setNotice('')
    try {
      await claimCardIfNeeded()
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, paymentMethod: method, customerPhone: phone }),
      })
      const result = await response.json() as { order?: Order; account?: Account; error?: string }
      if (!response.ok || !result.order || !result.account) throw new Error(result.error || 'The receiving account could not be confirmed.')
      setOrder(result.order)
      setAccount(result.account)
      setPhone(result.order.customer_phone ?? phone)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The order could not be created.')
    } finally {
      setCreating(false)
    }
  }

  const submitted = async () => {
    if (!order) return
    setSubmitting(true)
    setNotice('')
    try {
      const response = await fetch(`/api/orders/${order.id}/submitted`, { method: 'POST' })
      const result = await response.json() as { order?: Order; error?: string }
      if (!response.ok || !result.order) throw new Error(result.error || 'The payment submission could not be recorded.')
      setOrder(result.order)
      setNotice('Payment submitted — waiting for automatic verification.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The payment submission could not be recorded.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyNumber = async () => {
    if (!account) return
    try {
      await navigator.clipboard.writeText(account.accountNumber)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setNotice('Copy is unavailable here. Please copy the number manually.')
    }
  }

  return (
    <div className="payment-checkout">
      <div className="payment-progress" aria-label={`Payment step ${step} of 4`}>
        {progress.map(([number, label], index) => <div className={index + 1 < step ? 'complete' : index + 1 === step ? 'current' : ''} key={number}><span>{index + 1 < step ? '✓' : number}</span><small>{label}</small></div>)}
      </div>

      {step === 1 && <section className="payment-step payment-method-step" aria-labelledby="payment-method-heading">
        <span className="payment-step-label">STEP 1 · METHOD</span>
        <h2 id="payment-method-heading">Choose payment method</h2>
        <p>Pick the wallet you will use to send your one-time payment.</p>
        <div className="payment-methods">
          {(Object.keys(methodDetails) as Method[]).map(item => <button className={`payment-method-card ${methodDetails[item].accent} ${method === item ? 'selected' : ''}`} type="button" onClick={() => chooseMethod(item)} key={item}>
            <span className="payment-method-mark">{item === 'bkash' ? 'b' : 'N'}</span>
            <span><strong>{methodDetails[item].label}</strong><small>{methodDetails[item].description}</small></span><b aria-hidden="true">→</b>
          </button>)}
        </div>
      </section>}

      {step === 2 && <section className="payment-step" aria-labelledby="wallet-heading">
        <button className="payment-back" type="button" onClick={() => setMethod(null)}>← Change payment method</button>
        <span className="payment-step-label">STEP 2 · YOUR NUMBER</span>
        <h2 id="wallet-heading">Your {detail.label} number</h2>
        <p>Enter the wallet number you’ll use to send exactly 99 BDT.</p>
        <label className="payment-phone-label" htmlFor="customer-wallet">WALLET NUMBER</label>
        <input id="customer-wallet" value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" />
        <button className="button dark payment-continue" type="button" onClick={() => void createOrder()} disabled={creating || !phoneIsValid}>{creating ? 'Preparing payment…' : 'Continue →'}</button>
      </section>}

      {step === 3 && account && order && <section className="payment-step" aria-labelledby="send-payment-heading">
        <button className="payment-back" type="button" onClick={() => { setOrder(null); setAccount(null); setNotice('') }}>← Change payment method</button>
        <span className="payment-step-label">STEP 3 · SEND PAYMENT</span>
        <h2 id="send-payment-heading">Send exactly ৳99</h2>
        <p>Use {detail.label} Send Money. The receiving number below is provided securely by BirthdaySmile.</p>
        <div className={`payment-instruction-card ${detail.accent}`}><small>SEND MONEY VIA {detail.label.toUpperCase()}</small><strong>৳99</strong><span>Send Money to</span><b>{account.accountNumber}</b><button type="button" onClick={() => void copyNumber()}>{copied ? 'Copied ✓' : 'Copy number'}</button></div>
        <ol className="payment-instructions"><li>Open your {detail.label} app.</li><li>Select Send Money.</li><li>Send exactly ৳99 to the number above.</li><li>Return here after sending.</li></ol>
        {order.payment_submitted_at ? <p className="payment-status" role="status">✓ Payment submitted<br /><small>Waiting for automatic verification.</small></p> : <button className="button dark payment-continue" type="button" onClick={() => void submitted()} disabled={submitting}>{submitting ? 'Checking submission…' : 'I Have Sent Payment'}</button>}
      </section>}

      {step === 4 && <section className="payment-step payment-success-step" aria-labelledby="verification-heading"><span className="payment-success-icon">✓</span><span className="payment-step-label">STEP 4 · VERIFICATION</span><h2 id="verification-heading">Payment verified</h2><p>Your card is ready to share.</p><div className="payment-success-actions"><a className="button dark" href={`/share/${cardId}`}>Share card</a><a className="button outline" href={`/card/${cardId}`}>View card</a></div></section>}
      {notice && <p className="form-error payment-notice" role="alert">{notice}</p>}
    </div>
  )
}

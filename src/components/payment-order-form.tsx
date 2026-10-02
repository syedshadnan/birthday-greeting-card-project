'use client'

import { useEffect, useState } from 'react'

type Method = 'bkash' | 'nagad'
type Account = { method: Method; accountNumber: string }
type Order = {
  id: string
  status: string
  payment_method: Method
  customer_phone: string
  payment_submitted_at?: string | null
}

export default function PaymentOrderForm({ cardId }: { cardId: string }) {
  const [method, setMethod] = useState<Method>('bkash')
  const [account, setAccount] = useState<Account | null>(null)
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  const claimCardIfNeeded = async () => {
    const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}/claim`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok && response.status !== 403 && response.status !== 409) {
      const result = await response.json() as { error?: string }
      throw new Error(result.error || 'This card could not be attached to your account.')
    }
  }

  useEffect(() => {
    let active = true
    claimCardIfNeeded()
      .then(() => fetch(`/api/orders?cardId=${encodeURIComponent(cardId)}`, { cache: 'no-store' }))
      .then(async response => {
        const result = await response.json() as { order?: Order | null; account?: Account | null; error?: string }
        if (!response.ok) throw new Error(result.error || 'The order could not be loaded.')
        if (!active || !result.order) return
        setOrder(result.order)
        setAccount(result.account ?? null)
        setMethod(result.order.payment_method)
        setPhone(result.order.customer_phone)
      })
      .catch(error => {
        if (active) setNotice(error instanceof Error ? error.message : 'The order could not be loaded.')
      })
    return () => { active = false }
  }, [cardId])

  const createOrder = async () => {
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
      setMethod(result.order.payment_method as Method)
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
      setNotice('Payment submitted — awaiting verification.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The payment submission could not be recorded.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="payment-box">
      <p><strong>Price:</strong> 99 BDT</p>
      {!order && <>
        <fieldset>
          <legend>PAYMENT METHOD</legend>
          <label><input type="radio" checked={method === 'bkash'} onChange={() => setMethod('bkash')} /> bKash</label>
          <label><input type="radio" checked={method === 'nagad'} onChange={() => setMethod('nagad')} /> Nagad</label>
        </fieldset>
        <label>Your {method === 'bkash' ? 'bKash' : 'Nagad'} number
          <input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" />
        </label>
        <button className="button dark" type="button" onClick={() => void createOrder()} disabled={creating}>
          {creating ? 'Creating…' : 'Continue / Create payment order'}
        </button>
      </>}
      {order && account && <div>
        <p><strong>Send 99 BDT to:</strong></p>
        <p><strong>{account.accountNumber}</strong></p>
        <label>Your {method === 'bkash' ? 'bKash' : 'Nagad'} number
          <input readOnly value={phone} aria-label={`Your ${method === 'bkash' ? 'bKash' : 'Nagad'} number`} />
        </label>
        {order.payment_submitted_at ? <p role="status"><strong>Payment submitted — awaiting verification.</strong><br/>You do not need to submit it again.</p> : <>
          <p>1. Open {method === 'bkash' ? 'bKash' : 'Nagad'}.</p>
          <p>2. Send exactly 99 BDT to the receiving number above.</p>
          <p>3. Return here and confirm that you sent the payment.</p>
          <button className="button dark" type="button" onClick={() => void submitted()} disabled={submitting}>
            {submitting ? 'Submitting…' : 'I Have Sent Payment'}
          </button>
        </>}
      </div>}
      {notice && <p className="form-error" role="status">{notice}</p>}
    </div>
  )
}

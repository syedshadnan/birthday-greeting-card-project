'use client'

import { useCallback, useEffect, useState } from 'react'

type PaymentRow = {
  id: string
  card_id: string | null
  customer_name: string
  bkash_number: string
  payment_method: 'bkash' | 'nagad'
  payer_phone: string
  transaction_id: string
  amount: number
  status: 'pending' | 'verified' | 'rejected'
  created_at: string
  verified_at: string | null
  cards: null | { public_id: string; template_slug: string; recipient_name: string }
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const loadPayments = useCallback(async () => {
    const response = await fetch('/api/admin/payments')
    const result: { payments?: PaymentRow[]; error?: string } = await response.json()
    if (response.status === 401) {
      setAuthenticated(false)
      return
    }
    if (!response.ok) throw new Error(result.error || 'Could not load payment requests.')
    setPayments(result.payments ?? [])
  }, [])

  useEffect(() => {
    fetch('/api/admin/session')
      .then(async response => {
        const result: { authenticated?: boolean; error?: string } = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not check the admin session.')
        setAuthenticated(result.authenticated === true)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not check the admin session.'))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (authenticated) {
      loadPayments().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load payment requests.'))
    }
  }, [authenticated, loadPayments])

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoggingIn(true)
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not sign in.')
      setPassword('')
      setAuthenticated(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.')
    } finally {
      setLoggingIn(false)
    }
  }

  const review = async (payment: PaymentRow, status: 'verified' | 'rejected') => {
    setBusyId(payment.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not review this payment.')
      await loadPayments()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not review this payment.')
    } finally {
      setBusyId('')
    }
  }

  const signOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' })
    setAuthenticated(false)
    setPayments([])
  }

  if (checking) return <main className="payment-page"><p>Checking admin sign-in…</p></main>

  if (!authenticated) return <><nav><a className="brand" href="/">✦ wishwell</a></nav><main className="payment-page">
    <span className="eyebrow">PRIVATE ADMIN AREA</span>
    <h1>Good to <i>see you.</i></h1>
    <p className="sub">All card themes and scenes are free right now. No payment review is needed.</p>
    <form className="payment-box" onSubmit={signIn}>
      <label htmlFor="admin-email">ADMIN EMAIL</label><input id="admin-email" type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" required/>
      <label htmlFor="admin-password">ADMIN PASSWORD</label><input id="admin-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" required/>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button dark" type="submit" disabled={loggingIn}>{loggingIn?'Signing in…':'Sign in →'}</button>
    </form>
  </main></>

  return <><nav><a className="brand" href="/">✦ wishwell</a><button className="upload" onClick={signOut}>Sign out</button></nav>
    <main className="admin-page">
      <div className="admin-heading"><div><span className="eyebrow">PRIVATE ADMIN AREA</span><h1>All cards are <i>free.</i></h1><p>All nine scenes are available on every card. Payments and approvals are disabled.</p></div></div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {!payments.length?<div className="payment-box"><p>No payment is needed. Create and share any card for free.</p></div>:<div className="admin-payments">{payments.map(payment=>{
        const card=Array.isArray(payment.cards)?payment.cards[0]:payment.cards
        return <article className="admin-payment" key={payment.id}>
          <div className="admin-payment-heading"><div><span className="eyebrow">{payment.payment_method.toUpperCase()} · ৳{payment.amount}</span><h2>{payment.customer_name}</h2></div><span className={'payment-status '+payment.status}>{payment.status}</span></div>
          <dl><div><dt>Transaction ID</dt><dd>{payment.transaction_id}</dd></div><div><dt>Paid from</dt><dd>{payment.payer_phone||payment.bkash_number}</dd></div><div><dt>Submitted</dt><dd>{new Date(payment.created_at).toLocaleString()}</dd></div><div><dt>Card for</dt><dd>{card?.recipient_name??'Card unavailable'} · {card?.template_slug??'—'}</dd></div></dl>
          {card&&<a href={`/card/${card.public_id}`} target="_blank" rel="noreferrer">Open card link ↗</a>}
          {payment.status==='pending'&&<div className="admin-payment-actions"><button className="button dark" disabled={busyId===payment.id||!card} onClick={()=>void review(payment,'verified')}>{busyId===payment.id?'Saving…':'Verify payment and publish card'}</button><button className="button outline" disabled={busyId===payment.id} onClick={()=>void review(payment,'rejected')}>Reject</button></div>}
        </article>
      })}</div>}
    </main>
  </>
}

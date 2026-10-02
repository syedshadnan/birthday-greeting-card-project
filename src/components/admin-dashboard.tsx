'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminPaymentAccounts from './admin-payment-accounts'

type AdminCard = {
  id: string
  public_id: string
  recipient_name: string
  sender_name: string
  message: string
  theme: string
  status: string
  created_at: string
  expires_at: string
  card_photos: { image_url: string; sort_order: number }[]
}
type PendingOrder = {
  id: string
  user_id: string
  amount_bdt: number
  currency: string
  payment_method: string
  customer_phone: string
  payment_submitted_at: string | null
  created_at: string
  card: { public_id: string; recipient_name: string | null } | null
  payment_account: { account_number: string } | null
  customer: { email: string | null; full_name: string | null }
}

const pageSize = 50

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cards, setCards] = useState<AdminCard[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loadingCards, setLoadingCards] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const loadCards = useCallback(async (nextOffset: number) => {
    setLoadingCards(true)
    try {
      const response = await fetch(`/api/admin/cards?offset=${nextOffset}`, { cache: 'no-store' })
      const result: { cards?: AdminCard[]; total?: number; error?: string } = await response.json()
      if (response.status === 401) {
        setAuthenticated(false)
        return
      }
      if (!response.ok) throw new Error(result.error || 'Could not load generated cards.')
      setCards(result.cards ?? [])
      setTotal(result.total ?? 0)
      setOffset(nextOffset)
    } finally {
      setLoadingCards(false)
    }
  }, [])

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' })
      const result: { orders?: PendingOrder[]; error?: string } = await response.json()
      if (response.status === 401) {
        setAuthenticated(false)
        return
      }
      if (!response.ok) throw new Error(result.error || 'Could not load pending orders.')
      setOrders(result.orders ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load pending orders.')
    } finally {
      setLoadingOrders(false)
    }
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
      loadCards(0).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load generated cards.'))
      void loadOrders()
    }
  }, [authenticated, loadCards, loadOrders])

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

  const deleteCard = async (card: AdminCard) => {
    if (!window.confirm(`Permanently delete the card for ${card.recipient_name}? Its photos and uploaded music will also be deleted.`)) return

    setBusyId(card.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/cards/${card.id}`, { method: 'DELETE' })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not delete this card.')
      if (cards.length === 1 && offset > 0) {
        await loadCards(Math.max(0, offset - pageSize))
      } else {
        await loadCards(offset)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this card.')
    } finally {
      setBusyId('')
    }
  }

  const signOut = async () => {
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not sign out. Please try again.')
      setAuthenticated(false)
      setCards([])
      setTotal(0)
      setOrders([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.')
    }
  }

  if (checking) return <main className="payment-page"><p>Checking admin sign-in…</p></main>

  if (!authenticated) return <><nav><a className="brand" href="/">✦ wishwell</a></nav><main className="payment-page">
    <span className="eyebrow">PRIVATE ADMIN AREA</span>
    <h1>Good to <i>see you.</i></h1>
    <p className="sub">Manage generated birthday cards, check their expiry dates, and remove cards when needed.</p>
    <form className="payment-box" onSubmit={signIn}>
      <label htmlFor="admin-email">ADMIN EMAIL</label><input id="admin-email" type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" required/>
      <label htmlFor="admin-password">ADMIN PASSWORD</label><input id="admin-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" required/>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="button dark" type="submit" disabled={loggingIn}>{loggingIn?'Signing in…':'Sign in →'}</button>
    </form>
  </main></>

  return <><nav><a className="brand" href="/">✦ wishwell</a><button className="upload" onClick={()=>void signOut()}>Sign out</button></nav>
    <main className="admin-page">
      <AdminPaymentAccounts />
      <section className="admin-payments">
        <div className="admin-heading"><div><span className="eyebrow">PHASE 7 PAYMENTS</span><h2>Pending orders</h2><p>Payment attempts awaiting trusted verification. No payment status can be changed here.</p></div><button className="button outline" type="button" disabled={loadingOrders} onClick={() => void loadOrders()}>{loadingOrders ? 'Loading…' : 'Refresh'}</button></div>
        {!orders.length ? <div className="payment-box"><p>{loadingOrders ? 'Loading pending orders…' : 'No pending orders.'}</p></div> : <div className="admin-payments">{orders.map(order => <article className="admin-payment" key={order.id}>
          <div className="admin-payment-heading"><div><span className="eyebrow">{order.payment_method} · pending</span><h3>{order.card?.recipient_name || 'Unknown card'}</h3><p>{order.customer.full_name || order.customer.email || order.user_id}</p></div><span className="payment-status">{order.amount_bdt} {order.currency}</span></div>
          <dl>
            <div><dt>Order ID</dt><dd>{order.id}</dd></div>
            <div><dt>Customer wallet</dt><dd>{order.customer_phone}</dd></div>
            <div><dt>Receiving account</dt><dd>{order.payment_account?.account_number || 'Unavailable'}</dd></div>
            <div><dt>Submitted</dt><dd>{order.payment_submitted_at ? displayDate(order.payment_submitted_at) : 'Not submitted'}</dd></div>
            <div><dt>Created</dt><dd>{displayDate(order.created_at)}</dd></div>
          </dl>
        </article>)}</div>}
      </section>
      <div className="admin-heading"><div><span className="eyebrow">PRIVATE ADMIN AREA</span><h1>Generated <i>cards.</i></h1><p>Review each card, check when it expires, or permanently delete its database record and uploaded assets.</p></div></div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="admin-cards-toolbar">
        <strong>{total} {total === 1 ? 'card' : 'cards'}</strong>
        <button className="button outline" type="button" disabled={loadingCards} onClick={()=>void loadCards(offset)}>{loadingCards?'Loading…':'Refresh'}</button>
      </div>
      {loadingCards&&!cards.length?<div className="payment-box"><p>Loading generated cards…</p></div>:!cards.length?<div className="payment-box"><p>No generated cards yet.</p></div>:<div className="admin-payments">{cards.map(card=>{
        const expired = new Date(card.expires_at).getTime() <= Date.now() || card.status === 'expired'
        const photos = [...(card.card_photos ?? [])].sort((a,b)=>a.sort_order-b.sort_order)
        return <article className="admin-payment admin-card" key={card.id}>
          <div className="admin-payment-heading"><div><span className="eyebrow">{card.theme} · {card.status}</span><h2>{card.recipient_name}</h2><p className="admin-card-byline">From {card.sender_name}</p></div><span className={'payment-status '+(expired?'rejected':'verified')}>{expired?'Expired':'Active'}</span></div>
          <dl>
            <div><dt>Created</dt><dd><time dateTime={card.created_at}>{displayDate(card.created_at)}</time></dd></div>
            <div><dt>Expires</dt><dd><time dateTime={card.expires_at}>{displayDate(card.expires_at)}</time></dd></div>
            <div className="admin-card-message"><dt>Message</dt><dd>{card.message}</dd></div>
          </dl>
          {photos.length>0&&<div className="admin-card-photos" aria-label={`${photos.length} card photos`}>{photos.map((photo,index)=><img key={photo.image_url} src={photo.image_url} alt={`Photo ${index+1} for ${card.recipient_name}`} loading="lazy"/>)}</div>}
          <div className="admin-payment-actions">
            <a className="button outline" href={`/admin/preview/${card.id}`} target="_blank" rel="noreferrer">Open card ↗</a>
            <button className="button outline admin-delete-button" type="button" disabled={busyId===card.id} onClick={()=>void deleteCard(card)}>{busyId===card.id?'Deleting…':'Delete card'}</button>
          </div>
        </article>
      })}</div>}
      <div className="admin-cards-pagination">
        <button className="button outline" type="button" disabled={loadingCards||offset===0} onClick={()=>void loadCards(Math.max(0,offset-pageSize))}>← Previous</button>
        <span>{total ? `${offset+1}–${Math.min(offset+cards.length,total)} of ${total}` : '0 cards'}</span>
        <button className="button outline" type="button" disabled={loadingCards||offset+cards.length>=total} onClick={()=>void loadCards(offset+pageSize)}>Next →</button>
      </div>
    </main>
  </>
}

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
  cleanup: { eligible: boolean; reason: string }
}
type Verification = {
  id: string
  verification_status: string
  reason_code: string
  reason: string
  provider: string | null
  amount_bdt: number | null
  sender_phone: string | null
  transaction_id: string | null
  provider_timestamp: string | null
  trusted_source: string | null
  trusted_receiving_account: string | null
  event: { raw_message: string | null; received_at: string; processed_at: string | null } | null
  order: { id: string; payment_method: string; customer_phone: string; amount_bdt: number; status: string } | null
}
type AccountSummary = { method: 'bkash' | 'nagad'; account_number: string; is_active: boolean }
type AdminSection = 'home' | 'accounts' | 'verification' | 'orders' | 'legacy' | 'audit' | 'cards'

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
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loadingVerifications, setLoadingVerifications] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [cleaningOrders, setCleaningOrders] = useState(false)
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([])
  const [activeSection, setActiveSection] = useState<AdminSection>('home')

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

  const loadVerifications = useCallback(async () => {
    setLoadingVerifications(true)
    try {
      const response = await fetch('/api/admin/verifications', { cache: 'no-store' })
      const result: { verifications?: Verification[]; error?: string } = await response.json()
      if (response.status === 401) { setAuthenticated(false); return }
      if (!response.ok) throw new Error(result.error || 'Could not load verification evidence.')
      setVerifications(result.verifications ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load verification evidence.')
    } finally {
      setLoadingVerifications(false)
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
      void loadVerifications()
      fetch('/api/admin/payment-accounts', { cache: 'no-store' }).then(async response => {
        const result: { accounts?: AccountSummary[] } = await response.json()
        if (response.ok) setAccountSummaries(result.accounts ?? [])
      }).catch(() => setAccountSummaries([]))
    }
  }, [authenticated, loadCards, loadOrders, loadVerifications])

  useEffect(() => {
    const validSections: AdminSection[] = ['home', 'accounts', 'verification', 'orders', 'legacy', 'audit', 'cards']
    const syncSection = () => {
      const section = new URLSearchParams(window.location.search).get('section')
      setActiveSection(section && validSections.includes(section as AdminSection) ? section as AdminSection : 'home')
    }
    syncSection()
    if (!window.location.search && !window.history.state?.adminSection) {
      window.history.replaceState({ adminSection: 'home' }, '', '/admin')
    }
    window.addEventListener('popstate', syncSection)
    return () => window.removeEventListener('popstate', syncSection)
  }, [])

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
      setVerifications([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.')
    }
  }

  const deleteSelectedOrders = async () => {
      const eligible = orders.filter(order => selectedOrders.includes(order.id) && order.cleanup.eligible)
      if (!eligible.length) {
        setError('Select at least one eligible pending test order.')
        return
      }
      if (!window.confirm(`Delete exactly these pending test order(s)?\n\n${eligible.map(order => order.id).join('\n')}\n\nOrders with evidence, paid orders, and all webhook/payment evidence will be protected.`)) return
      setCleaningOrders(true)
      setError('')
      try {
        const response = await fetch('/api/admin/orders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: eligible.map(order => order.id) }),
        })
        const result: { error?: string; blockedOrderIds?: string[] } = await response.json()
        if (!response.ok) throw new Error(result.error || 'Selected orders could not be deleted.')
        setSelectedOrders([])
        await loadOrders()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Selected orders could not be deleted.')
      } finally {
        setCleaningOrders(false)
      }
    }

  const overview = {
    paid: verifications.filter(item => item.verification_status === 'verified').length,
    pending: orders.length,
    review: verifications.filter(item => item.verification_status === 'needs_review').length,
    unmatchedInvalid: verifications.filter(item => item.verification_status === 'unmatched' || item.verification_status === 'invalid').length,
    revenue: verifications.filter(item => item.verification_status === 'verified').reduce((sum, item) => sum + (item.amount_bdt ?? 0), 0),
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

  const sectionLabels: Record<Exclude<AdminSection, 'home'>, string> = {
    accounts: 'Payment Accounts',
    verification: 'Payment Verification',
    orders: 'Pending Orders',
    legacy: 'Legacy Payments',
    audit: 'Audit / Security Logs',
    cards: 'Cards',
  }
  const openSection = (section: AdminSection) => {
    const query = section === 'home' ? '' : `?section=${section}`
    window.history.pushState({ adminSection: section }, '', `/admin${query}`)
    setActiveSection(section)
  }
  const backToDashboard = () => {
    if (window.history.state?.adminSection === activeSection) {
      window.history.back()
      return
    }
    window.location.assign('/admin')
  }

  return <><nav><a className="brand" href="/">✦ wishwell</a><button className="upload" onClick={()=>void signOut()}>Sign out</button></nav>
    <main className="admin-page">
      {activeSection !== 'home' && <header className="admin-section-header">
        <button className="button outline admin-back" type="button" onClick={backToDashboard}>← Back to Admin Dashboard</button>
        <div className="admin-breadcrumb" aria-label="Breadcrumb"><span>Admin Dashboard</span><b>/</b><strong>{sectionLabels[activeSection]}</strong></div>
      </header>}
      {activeSection === 'home' && <section className="admin-section admin-overview">
        <div className="admin-heading"><div><span className="eyebrow">OVERVIEW</span><h1>Payment <i>control room.</i></h1><p>Verification evidence, payment attempts, and trusted receiving accounts in one place.</p></div></div>
        <div className="admin-summary-grid">
          <div className="admin-summary-card"><span>Verified revenue</span><strong>{overview.revenue} BDT</strong></div>
          <div className="admin-summary-card"><span>Verified bKash</span><strong>{verifications.filter(item => item.verification_status === 'verified' && item.provider === 'bkash').reduce((sum, item) => sum + (item.amount_bdt ?? 0), 0)} BDT</strong></div>
          <div className="admin-summary-card"><span>Verified Nagad</span><strong>{verifications.filter(item => item.verification_status === 'verified' && item.provider === 'nagad').reduce((sum, item) => sum + (item.amount_bdt ?? 0), 0)} BDT</strong></div>
          <div className="admin-summary-card"><span>Pending verification</span><strong>{overview.review + overview.pending}</strong></div>
          <div className="admin-summary-card"><span>Active bKash</span><strong>{accountSummaries.find(account => account.method === 'bkash' && account.is_active)?.account_number ?? 'Not configured'}</strong></div>
          <div className="admin-summary-card"><span>Active Nagad</span><strong>{accountSummaries.find(account => account.method === 'nagad' && account.is_active)?.account_number ?? 'Not configured'}</strong></div>
        </div>
        <div className="admin-nav-grid">
          {([['accounts', 'Payment Accounts', 'Manage active and historical receiving numbers.'], ['verification', 'Payment Verification', 'Review evidence and server-produced outcomes.'], ['orders', 'Pending Orders', 'Inspect payment attempts awaiting verification.'], ['legacy', 'Legacy Payments', 'View preserved historical payment records.'], ['audit', 'Audit / Security Logs', 'Review protected administrative evidence.'], ['cards', 'Cards', 'Manage generated birthday cards.']] as const).map(([id, title, description]) => <button className="admin-nav-card" type="button" key={id} onClick={() => openSection(id)}><strong>{title}</strong><span>{description}</span><b>Open →</b></button>)}
        </div>
      </section>}
      {activeSection === 'accounts' && <AdminPaymentAccounts />}
      {activeSection === 'verification' && <section className="admin-payments">
        <div className="admin-heading"><div><span className="eyebrow">PHASE 9 VERIFICATION</span><h2>Webhook evidence</h2><p>Permanent evidence and server-produced verification outcomes. Unsupported or untrusted events are never auto-approved.</p></div><button className="button outline" type="button" disabled={loadingVerifications} onClick={() => void loadVerifications()}>{loadingVerifications ? 'Loading…' : 'Refresh'}</button></div>
        {!verifications.length ? <div className="payment-box"><p>{loadingVerifications ? 'Loading verification evidence…' : 'No webhook verification evidence.'}</p></div> : <div className="admin-payments">{verifications.map(item => {
          const label = item.verification_status === 'verified' ? '✅ AUTO VERIFIED / PAID' : item.verification_status === 'duplicate' ? '♻️ DUPLICATE' : item.verification_status === 'invalid' ? '❌ INVALID' : item.verification_status === 'unmatched' ? '⚠️ UNMATCHED' : '⚠️ NEEDS REVIEW'
          return <article className="admin-payment" key={item.id}>
            <div className="admin-payment-heading"><div><span className="eyebrow">{label}</span><h3>{item.reason_code}</h3><p>{item.reason}</p></div><span className="payment-status">{item.verification_status}</span></div>
            <dl>
              <div><dt>Raw SMS</dt><dd>{item.event?.raw_message || 'Unavailable'}</dd></div>
              <div><dt>Provider / amount</dt><dd>{item.provider || 'Unknown'} / {item.amount_bdt ?? 'Unknown'} BDT</dd></div>
              <div><dt>Customer phone</dt><dd>{item.sender_phone || 'Unknown'}</dd></div>
              <div><dt>Transaction ID</dt><dd>{item.transaction_id || 'Missing'}</dd></div>
              <div><dt>SMS timestamp</dt><dd>{item.provider_timestamp || 'Unknown'}</dd></div>
              <div><dt>Trusted source / receiving account</dt><dd>{item.trusted_source || 'Unknown'} / {item.trusted_receiving_account || 'Unknown'}</dd></div>
              <div><dt>Matched order</dt><dd>{item.order ? `${item.order.id} · ${item.order.payment_method} · ${item.order.customer_phone} · ${item.order.amount_bdt} BDT · ${item.order.status}` : 'None'}</dd></div>
              <div><dt>Received / processed</dt><dd>{item.event ? `${displayDate(item.event.received_at)} / ${item.event.processed_at ? displayDate(item.event.processed_at) : 'Not processed'}` : 'Unknown'}</dd></div>
            </dl>
            {item.verification_status === 'needs_review' && item.order && <button className="button outline" type="button" onClick={() => {
              const reason = window.prompt('Enter the evidence supporting this approval (minimum 10 characters).')
              if (!reason) return
              void fetch('/api/admin/verifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verificationId: item.id, reason }) }).then(() => void loadVerifications())
            }}>Approve with evidence</button>}
          </article>
        })}</div>}
      </section>}
      {activeSection === 'orders' && <section className="admin-section admin-payments">
        <div className="admin-heading"><div><span className="eyebrow">PHASE 7 PAYMENTS</span><h2>Pending orders</h2><p>Payment attempts awaiting trusted verification. No payment status can be changed here.</p></div><button className="button outline" type="button" disabled={loadingOrders} onClick={() => void loadOrders()}>{loadingOrders ? 'Loading…' : 'Refresh'}</button></div>
        {orders.some(order => order.cleanup.eligible) && <div className="admin-cleanup-bar"><p>Selected cleanup is limited to pending orders with no verification, audit, or webhook evidence.</p><button className="button outline" type="button" disabled={cleaningOrders || !selectedOrders.length} onClick={() => void deleteSelectedOrders()}>{cleaningOrders ? 'Deleting…' : 'Delete selected test orders'}</button></div>}
        {!orders.length ? <div className="payment-box"><p>{loadingOrders ? 'Loading pending orders…' : 'No pending orders.'}</p></div> : <div className="admin-payments">{orders.map(order => <article className="admin-payment" key={order.id}>
          <label className="admin-order-select"><input type="checkbox" checked={selectedOrders.includes(order.id)} disabled={!order.cleanup.eligible} onChange={event => setSelectedOrders(current => event.target.checked ? [...current, order.id] : current.filter(id => id !== order.id))}/><span>{order.cleanup.eligible ? 'Eligible test-order cleanup' : `Protected: ${order.cleanup.reason}`}</span></label>
          <div className="admin-payment-heading"><div><span className="eyebrow">{order.payment_method} · pending</span><h3>{order.card?.recipient_name || 'Unknown card'}</h3><p>{order.customer.full_name || order.customer.email || order.user_id}</p></div><span className="payment-status">{order.amount_bdt} {order.currency}</span></div>
          <dl>
            <div><dt>Order ID</dt><dd>{order.id}</dd></div>
            <div><dt>Customer wallet</dt><dd>{order.customer_phone}</dd></div>
            <div><dt>Receiving account</dt><dd>{order.payment_account?.account_number || 'Unavailable'}</dd></div>
            <div><dt>Submitted</dt><dd>{order.payment_submitted_at ? displayDate(order.payment_submitted_at) : 'Not submitted'}</dd></div>
            <div><dt>Created</dt><dd>{displayDate(order.created_at)}</dd></div>
          </dl>
        </article>)}</div>}
      </section>}
      {activeSection === 'legacy' && <section className="admin-section admin-legacy"><div className="admin-section-heading"><div><span className="eyebrow">LEGACY PAYMENTS</span><h2>Historical records</h2><p>Legacy payment records are preserved and are not modified by this dashboard.</p></div></div><div className="payment-box"><p>Legacy payment management remains read-only/disabled. Historical records are retained.</p></div></section>}
      {activeSection === 'audit' && <section className="admin-section admin-legacy"><div className="admin-section-heading"><div><span className="eyebrow">AUDIT / SECURITY LOGS</span><h2>Protected evidence</h2><p>Administrative approval audit records remain protected on the server and are not editable from this dashboard.</p></div></div><div className="payment-box"><p>Audit records are retained with payment evidence. No deletion or mutation actions are available here.</p></div></section>}
      {activeSection === 'cards' && <section className="admin-section admin-cards-section">
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
      </section>}
    </main>
  </>
}

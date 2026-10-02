import { redirect } from 'next/navigation'
import AccountActions from '../../components/account-actions'
import AccountCardActions from '../../components/account-card-actions'
import { getCurrentOwnedCards, getCurrentProfile, getCurrentUser } from '../../lib/auth'

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login?next=%2Faccount')
  }
  const profile = await getCurrentProfile()
  const { cards, error } = await getCurrentOwnedCards()

  const name = profile?.full_name?.trim() || user.email?.split('@')[0] || 'there'
  const initials = name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()
  const ready = cards.filter(card => card.payment_status === 'paid' && Boolean(card.share_enabled_at)).length
  const pending = cards.filter(card => card.payment_status === 'pending' || card.payment_status === 'submitted').length
  const locked = cards.filter(card => !(card.payment_status === 'paid' && Boolean(card.share_enabled_at))).length

  return (
    <main className="account-dashboard">
      <header className="account-hero">
        <div><span className="eyebrow">YOUR ACCOUNT</span><h1>Welcome back, <i>{name}.</i></h1><p>Your personalized birthday cards, payment status, and sharing controls in one place.</p></div>
        <a className="button dark account-primary-cta" href="/create">Create new card <span aria-hidden="true">→</span></a>
      </header>
      <section className="account-profile-card" aria-label="Profile">
        <div className="account-avatar" aria-hidden="true">{initials}</div>
        <div className="account-profile-details"><span className="eyebrow">PROFILE</span><h2>{name}</h2><p>{user.email ?? 'Email unavailable'}</p><span className="account-role">{profile?.role === 'admin' ? 'Admin' : 'Member'}</span></div>
        <div className="account-profile-action"><AccountActions /></div>
      </section>
      <section className="account-stats" aria-label="Account summary">
        <div><span>Total cards</span><strong>{cards.length}</strong><small>Created or claimed</small></div>
        <div><span>Ready to share</span><strong>{ready}</strong><small>Payment verified</small></div>
        <div><span>Payment pending</span><strong>{pending}</strong><small>Awaiting verification</small></div>
        <div><span>Sharing locked</span><strong>{locked}</strong><small>Payment required</small></div>
      </section>
      <section className="account-cards-section" aria-labelledby="owned-cards-heading">
        <div className="account-section-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2 id="owned-cards-heading">My cards</h2></div><span>{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span></div>
        {error ? <p className="form-error" role="alert">{error}</p> : cards.length === 0 ? (
          <div className="account-empty-state"><div className="account-empty-icon" aria-hidden="true">✦</div><h3>No cards yet</h3><p>Create your first personalized greeting card.</p><a className="button dark" href="/create">Create your first card</a></div>
        ) : (
          <div className="account-card-grid">
            {cards.map(card => {
              const shared = card.payment_status === 'paid' && Boolean(card.share_enabled_at)
              const paymentLabel = shared ? 'Paid / Ready' : card.payment_status === 'pending' || card.payment_status === 'submitted' ? 'Pending' : 'Locked'
              return <article className="account-card-premium" key={card.public_id}>
                <div className="account-card-art"><span>{(card.recipient_name || 'Birthday').slice(0, 1).toUpperCase()}</span><small>{card.status}</small></div>
                <div className="account-card-content"><div className="account-card-title-row"><h3>{card.recipient_name || 'Untitled birthday card'}</h3><span className={`account-status-badge ${shared ? 'paid' : card.payment_status === 'pending' || card.payment_status === 'submitted' ? 'pending' : 'locked'}`}>{paymentLabel}</span></div><p className="account-card-date">Created {new Date(card.created_at).toLocaleDateString()}</p><AccountCardActions cardId={card.public_id} paymentStatus={card.payment_status} shareEnabled={shared} /></div>
              </article>
            })}
          </div>
        )}
      </section>
    </main>
  )
}

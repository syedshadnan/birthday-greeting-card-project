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

  return (
    <main className="payment-page">
      <span className="eyebrow">ACCOUNT</span>
      <h1>Welcome back.</h1>
      <div className="payment-box">
        <p><strong>Email:</strong> {user.email ?? 'Not available'}</p>
        <p><strong>Name:</strong> {profile?.full_name ?? 'Not set'}</p>
        <p><strong>Role:</strong> {profile?.role ?? 'user'}</p>
        <div className="account-actions">
          <a className="button dark" href="/create">Create a card</a>
          <AccountActions />
        </div>
        <section aria-labelledby="owned-cards-heading">
          <h2 id="owned-cards-heading">Your cards</h2>
          {error ? <p className="form-error" role="alert">{error}</p> : cards.length === 0 ? (
            <div className="payment-box">
              <p>You have not claimed or created any cards yet.</p>
              <a className="button dark" href="/create">Make your first card</a>
            </div>
          ) : (
            <div className="account-card-list">
              {cards.map(card => {
                const shared = card.payment_status === 'paid' && Boolean(card.share_enabled_at)
                return (
                  <article className="account-card" key={card.public_id}>
                    <div>
                      <h3>{card.recipient_name || 'Untitled birthday card'}</h3>
                      <p>Created {new Date(card.created_at).toLocaleDateString()}</p>
                      <p>Status: {card.status} · Sharing: {shared ? 'Enabled' : 'Locked'}</p>
                    </div>
                    <AccountCardActions cardId={card.public_id} paymentStatus={card.payment_status} shareEnabled={shared} />
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

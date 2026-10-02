import { redirect } from 'next/navigation'
import { getCurrentOwnedCards, getCurrentProfile, getCurrentUser } from '../../lib/auth'

export default async function AccountPage() {
  const user = await getCurrentUser()
  const profile = await getCurrentProfile()
  const cards = await getCurrentOwnedCards()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="payment-page">
      <span className="eyebrow">ACCOUNT</span>
      <h1>Welcome back.</h1>
      <div className="payment-box">
        <p><strong>Email:</strong> {user.email ?? 'Not available'}</p>
        <p><strong>Name:</strong> {profile?.full_name ?? 'Not set'}</p>
        <p><strong>Role:</strong> {profile?.role ?? 'user'}</p>
        <a className="button dark" href="/login">Manage account</a>
        {cards.length > 0 ? (
          <div>
            <h2>Your cards</h2>
            <ul>
              {cards.map(card => (
                <li key={card.public_id}>
                  <a href={`/card/${card.public_id}`}>{card.recipient_name}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  )
}

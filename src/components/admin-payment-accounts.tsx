'use client'

import { useEffect, useState } from 'react'

type Account = { id: string; method: 'bkash' | 'nagad'; account_number: string; label: string | null; is_active: boolean }

export default function AdminPaymentAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [method, setMethod] = useState<'bkash' | 'nagad'>('bkash')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const response = await fetch('/api/admin/payment-accounts', { cache: 'no-store' })
    const result = await response.json() as { accounts?: Account[]; error?: string }
    if (!response.ok) throw new Error(result.error || 'Could not load payment accounts.')
    setAccounts(result.accounts ?? [])
  }
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load payment accounts.')) }, [])

  const add = async () => {
    setError('')
    const response = await fetch('/api/admin/payment-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, accountNumber: number, isActive: false }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) { setError(result.error || 'Could not add payment account.'); return }
    setNumber('')
    await load()
  }

  const setActive = async (account: Account, active: boolean) => {
    setError('')
    const response = await fetch(`/api/admin/payment-accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: active }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) { setError(result.error || 'Could not update payment account.'); return }
    await load()
  }

  return <section className="payment-box">
    <h2>Payment receiving accounts</h2>
    <p>Historical numbers remain stored; only one number per method can be active.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div>
      {accounts.map(account => <p key={account.id}><strong>{account.method}</strong> · {account.account_number} · {account.is_active ? 'Active' : 'Inactive'} <button className="button outline" type="button" onClick={() => void setActive(account, !account.is_active)}>{account.is_active ? 'Deactivate' : 'Activate'}</button></p>)}
    </div>
    <label>Method<select value={method} onChange={event => setMethod(event.target.value as 'bkash' | 'nagad')}><option value="bkash">bKash</option><option value="nagad">Nagad</option></select></label>
    <label>Receiving number<input value={number} onChange={event => setNumber(event.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" /></label>
    <button className="button dark" type="button" onClick={() => void add()}>Add account</button>
  </section>
}

'use client'

import { useEffect, useState } from 'react'

type Account = { id: string; method: 'bkash' | 'nagad'; account_number: string; label: string | null; is_active: boolean; webhook_source: string | null; provider_account_number: string | null }
type Modal = 'add' | 'metadata' | 'delete' | null

export default function AdminPaymentAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [provider, setProvider] = useState<'bkash' | 'nagad'>('bkash')
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<Account | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [method, setMethod] = useState<'bkash' | 'nagad'>('bkash')
  const [number, setNumber] = useState('')
  const [webhookSource, setWebhookSource] = useState('')
  const [providerAccountNumber, setProviderAccountNumber] = useState('')
  const [initialActive, setInitialActive] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const response = await fetch('/api/admin/payment-accounts', { cache: 'no-store' })
    const result = await response.json() as { accounts?: Account[]; error?: string }
    if (!response.ok) throw new Error(result.error || 'Could not load payment accounts.')
    setAccounts(result.accounts ?? [])
  }
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load payment accounts.')) }, [])

  const closeModal = () => { if (!busy) { setModal(null); setSelected(null) } }
  const openMetadata = (account: Account) => {
    setSelected(account)
    setWebhookSource(account.webhook_source ?? '')
    setProviderAccountNumber(account.provider_account_number ?? '')
    setError('')
    setMessage('')
    setModal('metadata')
  }
  const openAdd = () => {
    setMethod(provider)
    setNumber('')
    setWebhookSource('')
    setProviderAccountNumber('')
    setInitialActive(false)
    setError('')
    setMessage('')
    setModal('add')
  }

  const add = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/payment-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, accountNumber: number, webhookSource, providerAccountNumber, isActive: initialActive }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not add payment account.')
      await load(); setMessage('Payment account added.'); closeModal()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add payment account.') }
    finally { setBusy(false) }
  }

  const saveMetadata = async () => {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/payment-accounts/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookSource, providerAccountNumber }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not update trust metadata.')
      await load(); closeModal(); setMessage('Trust metadata saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update trust metadata.') }
    finally { setBusy(false) }
  }

  const setActive = async (account: Account, active: boolean) => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/payment-accounts/${account.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: active }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not update payment account.')
      await load(); setMessage(active ? `${account.method} account activated.` : `${account.method} account archived.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update payment account.') }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/payment-accounts/${selected.id}`, { method: 'DELETE' })
      const result = await response.json() as { error?: string; requiresArchive?: boolean }
      if (response.status === 409 && result.requiresArchive) {
        const archive = await fetch(`/api/admin/payment-accounts/${selected.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: false }),
        })
        const archiveResult = await archive.json() as { error?: string }
        if (!archive.ok) throw new Error(archiveResult.error || 'Could not archive payment account.')
        await load(); closeModal(); setMessage('This account is linked to historical payment records, so it cannot be permanently deleted. It has been archived instead.')
        return
      }
      if (!response.ok) throw new Error(result.error || 'Could not delete payment account.')
      await load(); closeModal(); setMessage('Payment account deleted.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete payment account.') }
    finally { setBusy(false) }
  }

  const providerAccounts = accounts.filter(account => account.method === provider)
  const active = providerAccounts.find(account => account.is_active) ?? null
  const historical = providerAccounts.filter(account => !account.is_active)

  return <section className="admin-accounts">
    <div className="admin-section-heading"><div><span className="eyebrow">PAYMENT ACCOUNTS</span><h2>Receiving accounts</h2><p>Manage the active receiving number and retain historical accounts safely.</p></div><button className="button dark" type="button" onClick={openAdd}>+ Add payment account</button></div>
    {(error || message) && <p className={error ? 'form-error' : 'admin-success'} role={error ? 'alert' : 'status'}>{error || message}</p>}
    <div className="admin-provider-tabs" role="tablist">
      <button className={`admin-provider-tab${provider === 'bkash' ? ' active' : ''}`} type="button" onClick={() => { setProvider('bkash'); setShowHistory(false) }}>bKash</button>
      <button className={`admin-provider-tab${provider === 'nagad' ? ' active' : ''}`} type="button" onClick={() => { setProvider('nagad'); setShowHistory(false) }}>Nagad</button>
    </div>
    <div className="admin-active-account">
      <div className="admin-account-title"><span className="eyebrow">ACTIVE {provider.toUpperCase()}</span><span className={`payment-status ${active ? 'verified' : ''}`}>{active ? 'Active' : 'Not configured'}</span></div>
      {active ? <><strong className="admin-account-number">{active.account_number}</strong><dl><div><dt>Webhook source</dt><dd>{active.webhook_source || 'Not configured'}</dd></div><div><dt>Provider account</dt><dd>{active.provider_account_number || 'Not configured'}</dd></div></dl><div className="admin-payment-actions"><button className="button outline" type="button" disabled={busy} onClick={() => openMetadata(active)}>Edit trust metadata</button><button className="button outline admin-delete-button" type="button" disabled={busy} onClick={() => void setActive(active, false)}>Deactivate</button></div></> : <p>No active {provider} account is configured.</p>}
    </div>
    <div className="admin-history"><button className="admin-history-toggle" type="button" onClick={() => setShowHistory(value => !value)}>Historical accounts ({historical.length}) <span>{showHistory ? 'Hide history' : 'Show history'}</span></button>{showHistory && historical.map(account => <div className="admin-history-row" key={account.id}><div><strong>{account.account_number}</strong><span>Inactive · {account.webhook_source || 'No source configured'}</span></div><div className="admin-payment-actions"><button className="button outline" type="button" disabled={busy} onClick={() => setActive(account, true)}>Activate</button><button className="button outline" type="button" disabled={busy} onClick={() => { setSelected(account); setModal('delete') }}>Delete / archive</button></div></div>)}</div>
    {modal && <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeModal() }}><div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      {modal === 'add' && <><h3 id="admin-modal-title">Add payment account</h3><label>Method<select value={method} onChange={event => setMethod(event.target.value as 'bkash' | 'nagad')}><option value="bkash">bKash</option><option value="nagad">Nagad</option></select></label><label>Receiving number<input value={number} onChange={event => setNumber(event.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" /></label><label>Webhook source<input value={webhookSource} onChange={event => setWebhookSource(event.target.value)} maxLength={100} /></label><label>Provider account number<input value={providerAccountNumber} onChange={event => setProviderAccountNumber(event.target.value)} maxLength={100} /></label><label className="admin-checkbox"><input type="checkbox" checked={initialActive} onChange={event => setInitialActive(event.target.checked)} /> Initial active</label><div className="admin-modal-actions"><button className="button outline" type="button" onClick={closeModal}>Cancel</button><button className="button dark" type="button" disabled={busy} onClick={() => void add()}>{busy ? 'Adding…' : 'Add account'}</button></div></>}
      {modal === 'metadata' && <><h3 id="admin-modal-title">Edit trust metadata</h3><label>Webhook source<input value={webhookSource} onChange={event => setWebhookSource(event.target.value)} maxLength={100} /></label><label>Provider account number<input value={providerAccountNumber} onChange={event => setProviderAccountNumber(event.target.value)} maxLength={100} /></label><div className="admin-modal-actions"><button className="button outline" type="button" onClick={closeModal}>Cancel</button><button className="button dark" type="button" disabled={busy} onClick={() => void saveMetadata()}>{busy ? 'Saving…' : 'Save changes'}</button></div></>}
      {modal === 'delete' && selected && <><h3 id="admin-modal-title">Delete payment account?</h3><p><strong>{selected.method}</strong><br />{selected.account_number}</p><p>This account may be linked to orders, verification evidence, or audit records. The server will permanently delete it only when no historical dependency exists; otherwise it will be archived.</p><div className="admin-modal-actions"><button className="button outline" type="button" onClick={closeModal}>Cancel</button><button className="button dark admin-delete-button" type="button" disabled={busy} onClick={() => void remove()}>{busy ? 'Checking…' : 'Delete / archive'}</button></div></>}
    </div></div>}
  </section>
}

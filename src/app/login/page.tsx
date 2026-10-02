'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { getSiteUrl } from '../../lib/site-url'

export default function LoginPage() {
  const [nextPath, setNextPath] = useState('/account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [status, setStatus] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const requestedNext = new URLSearchParams(window.location.search).get('next')
    if (requestedNext?.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\')) {
      setNextPath(requestedNext)
    }
    const supabase = createSupabaseBrowserClient()
    void supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleAuthEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (emailLoading || googleLoading) return
    const form = new FormData(event.currentTarget)
    const submittedEmail = String(form.get('email') ?? '').trim()
    const submittedPassword = String(form.get('password') ?? '')
    if (!submittedEmail || !submittedPassword) {
      setStatus('Enter your email and password.')
      return
    }
    setEmail(submittedEmail)
    setPassword(submittedPassword)
    setEmailLoading(true)
    setStatus('')

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`

      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({
          email: submittedEmail,
          password: submittedPassword,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName || null,
            },
          },
        })

        if (error) throw error
        setStatus('Check your email to confirm your account.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword })
        if (error) throw error
        window.location.href = nextPath
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign in.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    if (emailLoading || googleLoading) return
    setGoogleLoading(true)
    setStatus('')

    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      })

      if (error) throw error
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Google sign-in could not start.')
      setGoogleLoading(false)
    }
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setStatus('')

    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUserEmail(null)
      setStatus('Signed out.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign out.')
    } finally {
      setSigningOut(false)
    }
  }

  if (userEmail) {
    return (
      <main className="payment-page">
        <span className="eyebrow">ACCOUNT</span>
        <h1>Signed in.</h1>
        <div className="payment-box">
          <p><strong>Email:</strong> {userEmail}</p>
          <button className="button dark" type="button" onClick={() => void handleSignOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          <a className="button outline" href="/account">Open account</a>
        </div>
      </main>
    )
  }

  return (
    <main className="payment-page">
      <span className="eyebrow">WELCOME</span>
      <h1>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h1>
      <div className="payment-box">
        <button className="button outline" type="button" onClick={() => void handleGoogleSignIn()} disabled={emailLoading || googleLoading}>{googleLoading ? 'Connecting…' : 'Continue with Google'}</button>

        <div style={{ margin: '18px 0', borderTop: '1px solid #ddd', paddingTop: '18px' }}>
          <button
            className="button outline"
            type="button"
            onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            disabled={emailLoading || googleLoading}
          >
            {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>

        <form onSubmit={(event) => void handleAuthEmail(event)}>
        <label htmlFor="auth-name">Full name</label>
        <input id="auth-name" name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Optional" autoComplete="name" />

        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} onInput={(event) => setEmail(event.currentTarget.value)} placeholder="you@example.com" autoComplete="email" required />

        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onInput={(event) => setPassword(event.currentTarget.value)} placeholder="At least 6 characters" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required />

        {status ? <p className="form-error" role="alert">{status}</p> : null}

        <button className="button dark" type="submit" disabled={emailLoading || googleLoading}>
          {emailLoading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
        </form>
      </div>
    </main>
  )
}

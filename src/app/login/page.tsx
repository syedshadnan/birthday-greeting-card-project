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
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const requestedNext = new URLSearchParams(window.location.search).get('next')
    const safeNext = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\') ? requestedNext : '/account'
    setNextPath(safeNext)
    const supabase = createSupabaseBrowserClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.replace(safeNext)
        return
      }
      setUserEmail(null)
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
    <main className="auth-page">
      <div className="auth-brand"><a className="brand" href="/"><img src="/images/birthday-smile-logo.png" alt="BirthdaySmile" /></a></div>
      <section className="auth-card">
        <span className="eyebrow">WELCOME</span>
        <h1>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">Sign in to create and share beautiful personalized greeting cards.</p>
        <button className="google-button" type="button" onClick={() => void handleGoogleSignIn()} disabled={emailLoading || googleLoading}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.74-.07-1.45-.21-2.13H12v4.03h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.29Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.54 13.83A5.86 5.86 0 0 1 6.23 12c0-.64.11-1.26.31-1.83V7.64H3.3A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.06 1.05 4.36l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.12 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.86 9.46 6.14 12 6.14Z"/></svg>{googleLoading ? 'Connecting…' : 'Continue with Google'}</button>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form onSubmit={(event) => void handleAuthEmail(event)}>
          {mode === 'sign-up' && <label htmlFor="auth-name">Full name <span>Optional</span><input id="auth-name" name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>}
          <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} onInput={(event) => setEmail(event.currentTarget.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          <label htmlFor="auth-password">Password<div className="auth-password-field"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} onInput={(event) => setPassword(event.currentTarget.value)} placeholder="At least 6 characters" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
          {status ? <p className="auth-error" role="alert"><strong>Unable to continue</strong><span>{status}</span></p> : null}
          <button className="button dark auth-submit" type="submit" disabled={emailLoading || googleLoading}>{emailLoading ? 'Signing in…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">{mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} disabled={emailLoading || googleLoading}>{mode === 'sign-in' ? 'Sign up' : 'Sign in'}</button></p>
      </section>
    </main>
  )
}

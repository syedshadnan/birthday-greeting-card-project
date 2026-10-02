'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '../lib/supabase/client'

export default function AccountActions() {
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setError('')
    const { error } = await createSupabaseBrowserClient().auth.signOut()
    if (error) {
      setError('Could not sign out. Please try again.')
      setSigningOut(false)
      return
    }
    window.location.href = '/'
  }

  return (
    <>
      <button className="button outline" type="button" onClick={() => void signOut()} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  )
}

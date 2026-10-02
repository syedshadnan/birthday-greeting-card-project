import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedNext = requestUrl.searchParams.get('next')
  const next = requestedNext?.startsWith('/')
    && !requestedNext.startsWith('//')
    && !requestedNext.includes('\\')
    ? requestedNext
    : '/account'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_auth_code', requestUrl.origin))
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=auth_not_configured', requestUrl.origin))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin))
  }

  const claimPath = next.startsWith('/share/') ? next : null
  if (claimPath) {
    return NextResponse.redirect(new URL(claimPath, requestUrl.origin))
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
